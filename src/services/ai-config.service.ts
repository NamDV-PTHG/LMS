import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { NotFoundError } from '@/lib/errors';

// ── Schemas ───────────────────────────────────────────────────

export const upsertAiConfigSchema = z.object({
  name: z.string().min(1).max(100),
  endpoint: z.string().url(),
  modelName: z.string().min(1),
  apiKey: z.string().optional(),
  isActive: z.boolean().optional(),
});

// ── Types ─────────────────────────────────────────────────────

interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
}

interface ConnectionTestResult {
  success: boolean;
  latencyMs: number;
  models?: string[];
  error?: string;
  testedAt: string;
}

// ── Service functions ─────────────────────────────────────────

export async function getAiConfigs(companyId?: string) {
  return prisma.aiServiceConfig.findMany({
    where: {
      OR: [
        { companyId: companyId ?? null },
        { companyId: null }, // global configs
      ],
    },
    orderBy: { name: 'asc' },
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
        ...(data.apiKey !== undefined && { apiKey: data.apiKey }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
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
    },
  });
}

export async function deleteAiConfig(id: string) {
  await prisma.aiServiceConfig.findUniqueOrThrow({ where: { id } });
  await prisma.aiServiceConfig.delete({ where: { id } });
}

/**
 * Test connection to Ollama endpoint.
 * Fetches /api/tags to list available models.
 */
export async function testAiConnection(id: string): Promise<ConnectionTestResult> {
  const cfg = await prisma.aiServiceConfig.findUnique({ where: { id } });
  if (!cfg) throw new NotFoundError('AI Config');

  const start = Date.now();
  const testedAt = new Date().toISOString();

  try {
    // Normalize endpoint: strip trailing slash
    const base = cfg.endpoint.replace(/\/$/, '');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (cfg.apiKey) headers['Authorization'] = `Bearer ${cfg.apiKey}`;

    const res = await fetch(`${base}/api/tags`, {
      headers,
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    const latencyMs = Date.now() - start;

    if (!res.ok) {
      return {
        success: false,
        latencyMs,
        error: `HTTP ${res.status}: ${res.statusText}`,
        testedAt,
      };
    }

    const json = await res.json() as { models?: OllamaModel[] };
    const models = (json.models ?? []).map((m) => m.name);

    return { success: true, latencyMs, models, testedAt };
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
 * List available models from an Ollama endpoint without saving to DB.
 */
export async function getAvailableModels(endpoint: string, apiKey?: string): Promise<string[]> {
  try {
    const base = endpoint.replace(/\/$/, '');
    const headers: Record<string, string> = {};
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);

    const res = await fetch(`${base}/api/tags`, { headers, signal: controller.signal })
      .finally(() => clearTimeout(timeout));

    if (!res.ok) return [];
    const json = await res.json() as { models?: OllamaModel[] };
    return (json.models ?? []).map((m) => m.name);
  } catch {
    return [];
  }
}
