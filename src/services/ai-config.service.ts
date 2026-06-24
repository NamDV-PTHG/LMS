import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { NotFoundError } from '@/lib/errors';

// ── Schemas ───────────────────────────────────────────────────

export const upsertAiConfigSchema = z.object({
  name: z.string().min(1).max(100),
  endpoint: z.string().url(),
  modelName: z.string().min(1),
  apiKey: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  allowedCompanyIds: z.array(z.string().uuid()).optional().nullable(),
});

// ── Types ─────────────────────────────────────────────────────

interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
}

interface OpenAIModel {
  id: string;
  object: string;
}

interface ConnectionTestResult {
  success: boolean;
  latencyMs: number;
  models?: string[];
  error?: string;
  testedAt: string;
}

// ── Helpers ────────────────────────────────────────────────────

/**
 * Try to list models from a given URL.
 * Returns model names on success, null on non-2xx.
 */
async function fetchModels(
  url: string,
  headers: Record<string, string>,
  signal: AbortSignal,
): Promise<string[] | null> {
  const res = await fetch(url, { headers, signal });
  if (!res.ok) return null;

  const json = await res.json() as Record<string, unknown>;

  // Ollama: { models: [{ name }] }
  if (Array.isArray(json.models)) {
    return (json.models as OllamaModel[]).map((m) => m.name);
  }
  // OpenAI-compatible: { data: [{ id }] }
  if (Array.isArray(json.data)) {
    return (json.data as OpenAIModel[]).map((m) => m.id);
  }
  // Minimal success — reachable but unknown response shape
  return [];
}

/**
 * Detect endpoint type and return model list.
 * Tries Ollama /api/tags first, then OpenAI-compatible /models.
 */
async function probeEndpoint(
  base: string,
  headers: Record<string, string>,
  signal: AbortSignal,
): Promise<{ models: string[]; endpointType: 'ollama' | 'openai' } | null> {
  // Ollama
  const ollamaModels = await fetchModels(`${base}/api/tags`, headers, signal).catch(() => null);
  if (ollamaModels !== null) return { models: ollamaModels, endpointType: 'ollama' };

  // OpenAI-compatible (endpoint may already include /v1, so try /models directly)
  const openaiModels = await fetchModels(`${base}/models`, headers, signal).catch(() => null);
  if (openaiModels !== null) return { models: openaiModels, endpointType: 'openai' };

  return null;
}

// ── Service functions ─────────────────────────────────────────

export async function getAiConfigs(companyId?: string, isGroupAdmin = false) {
  // group_admin sees everything — no companyId filter
  if (isGroupAdmin) {
    return prisma.aiServiceConfig.findMany({ orderBy: { name: 'asc' } });
  }

  const all = await prisma.aiServiceConfig.findMany({
    where: {
      OR: [
        { companyId: companyId ?? null },
        { companyId: null }, // global configs
      ],
    },
    orderBy: { name: 'asc' },
  });

  // No companyId context → return as-is
  if (!companyId) return all;

  // company_admin: only configs with no restriction or explicitly allowed
  return all.filter((cfg) => {
    if (!cfg.allowedCompanyIds) return true; // null = tất cả công ty
    const allowed = cfg.allowedCompanyIds as string[];
    return allowed.includes(companyId);
  });
}

export async function getAiConfig(id: string) {
  const cfg = await prisma.aiServiceConfig.findUnique({ where: { id } });
  if (!cfg) throw new NotFoundError('AI Config');
  return cfg;
}

export async function upsertAiConfig(
  data: z.infer<typeof upsertAiConfigSchema>,
  companyId?: string,
  existingId?: string,
) {
  if (existingId) {
    return prisma.aiServiceConfig.update({
      where: { id: existingId },
      data: {
        name: data.name,
        endpoint: data.endpoint,
        modelName: data.modelName,
        ...(data.apiKey !== undefined && { apiKey: data.apiKey ?? null }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.allowedCompanyIds !== undefined && {
          allowedCompanyIds: data.allowedCompanyIds ?? null,
        }),
      },
    });
  }

  return prisma.aiServiceConfig.create({
    data: {
      name: data.name,
      endpoint: data.endpoint,
      modelName: data.modelName,
      apiKey: data.apiKey ?? null,
      isActive: data.isActive ?? true,
      companyId: companyId ?? null,
      allowedCompanyIds: data.allowedCompanyIds ?? null,
    },
  });
}

export async function deleteAiConfig(id: string) {
  await prisma.aiServiceConfig.findUniqueOrThrow({ where: { id } });
  await prisma.aiServiceConfig.delete({ where: { id } });
}

/**
 * Test connection to an AI endpoint (Ollama or OpenAI-compatible).
 * Auto-detects the API type by trying /api/tags then /models.
 */
export async function testAiConnection(id: string): Promise<ConnectionTestResult> {
  const cfg = await prisma.aiServiceConfig.findUnique({ where: { id } });
  if (!cfg) throw new NotFoundError('AI Config');

  const start = Date.now();
  const testedAt = new Date().toISOString();

  try {
    const base = cfg.endpoint.replace(/\/$/, '');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (cfg.apiKey) headers['Authorization'] = `Bearer ${cfg.apiKey}`;

    const result = await probeEndpoint(base, headers, controller.signal)
      .finally(() => clearTimeout(timeout));

    const latencyMs = Date.now() - start;

    if (!result) {
      return {
        success: false,
        latencyMs,
        error: 'Không tìm thấy endpoint hợp lệ (thử /api/tags và /models đều thất bại)',
        testedAt,
      };
    }

    return { success: true, latencyMs, models: result.models, testedAt };
  } catch (err: unknown) {
    const latencyMs = Date.now() - start;
    const errMessage = err instanceof Error ? err.message : 'Unknown error';
    return {
      success: false,
      latencyMs,
      error: errMessage.includes('aborted') ? 'Connection timed out (10s)' : errMessage,
      testedAt,
    };
  }
}

/**
 * List available models from an AI endpoint (Ollama or OpenAI-compatible).
 */
export async function getAvailableModels(endpoint: string, apiKey?: string): Promise<string[]> {
  try {
    const base = endpoint.replace(/\/$/, '');
    const headers: Record<string, string> = {};
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);

    const result = await probeEndpoint(base, headers, controller.signal)
      .finally(() => clearTimeout(timeout));

    return result?.models ?? [];
  } catch {
    return [];
  }
}
