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
