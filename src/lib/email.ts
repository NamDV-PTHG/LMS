import nodemailer, { Transporter } from 'nodemailer';
import { prisma } from './prisma';

let cachedTransporter: Transporter | null = null;
let cacheExpiry = 0;

export async function getSmtpTransporter(): Promise<Transporter | null> {
  // Cache transporter for 5 minutes
  if (cachedTransporter && Date.now() < cacheExpiry) {
    return cachedTransporter;
  }

  try {
    const config = await prisma.smtpConfig.findUnique({ where: { id: 'singleton' } });
    if (!config) return null;

    cachedTransporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.pass },
      tls: { rejectUnauthorized: false },
    });

    cacheExpiry = Date.now() + 5 * 60 * 1000;
    return cachedTransporter;
  } catch {
    return null;
  }
}

export function invalidateSmtpCache() {
  cachedTransporter = null;
  cacheExpiry = 0;
}

export async function getSmtpFrom(): Promise<string> {
  const config = await prisma.smtpConfig.findUnique({ where: { id: 'singleton' } });
  if (!config) return '"LMS Tập đoàn" <noreply@lms.local>';
  return `"${config.fromName}" <${config.fromEmail}>`;
}

/**
 * Get SMTP "from" string and brand name for a specific company.
 * Priority: CompanySmtpConfig → global SmtpConfig → fallback defaults.
 */
export async function getCompanyEmailBranding(companyId?: string | null): Promise<{
  fromString: string;
  brandName: string;
  transporter: Transporter | null;
}> {
  // Try company-specific SMTP first
  if (companyId) {
    try {
      const companyCfg = await prisma.companySmtpConfig.findUnique({ where: { companyId } });
      if (companyCfg) {
        const transporter = nodemailer.createTransport({
          host: companyCfg.host,
          port: companyCfg.port,
          secure: companyCfg.secure,
          auth: { user: companyCfg.user, pass: companyCfg.pass },
          tls: { rejectUnauthorized: false },
        });

        // Brand name: siteTitle from org metadata, else fromName
        const org = await prisma.organization.findUnique({
          where: { id: companyId },
          select: { metadata: true, name: true },
        });
        const meta = (org?.metadata ?? {}) as Record<string, string>;
        const brandName = meta.siteTitle || companyCfg.fromName || org?.name || 'LMS';

        return {
          fromString: `"${brandName}" <${companyCfg.fromEmail}>`,
          brandName,
          transporter,
        };
      }
    } catch {
      // fall through to global
    }
  }

  // Fall back to global SMTP config
  const globalTransporter = await getSmtpTransporter();
  const config = await prisma.smtpConfig.findUnique({ where: { id: 'singleton' } });
  const brandName = config?.fromName ?? 'LMS Tập đoàn';

  return {
    fromString: config ? `"${brandName}" <${config.fromEmail}>` : `"${brandName}" <noreply@lms.local>`,
    brandName,
    transporter: globalTransporter,
  };
}
