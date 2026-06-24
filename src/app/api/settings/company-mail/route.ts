import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withRole } from '@/middleware/require-role';
import { handleApiError } from '@/app/api/error-handler';
import { ValidationError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import nodemailer from 'nodemailer';

const smtpSchema = z.object({
  host:      z.string().min(1, 'Host không được trống'),
  port:      z.number().int().min(1).max(65535).default(587),
  secure:    z.boolean().default(false),
  user:      z.string().min(1, 'Username không được trống'),
  pass:      z.string().min(1, 'Password không được trống'),
  fromName:  z.string().min(1).default('LMS'),
  fromEmail: z.string().email('From email không hợp lệ'),
});

export const GET = withRole(
  ['group_admin', 'company_admin'],
  async (_req, { companyId }) => {
    const config = await prisma.companySmtpConfig.findUnique({ where: { companyId } });
    if (!config) return NextResponse.json({ success: true, data: null });
    return NextResponse.json({ success: true, data: { ...config, pass: config.pass ? '••••••••' : '' } });
  },
);

export const PUT = withRole(
  ['group_admin', 'company_admin'],
  async (req: NextRequest, { companyId }) => {
    try {
      const body = await req.json();
      const parsed = smtpSchema.safeParse(body);
      if (!parsed.success) {
        throw new ValidationError('Dữ liệu không hợp lệ', parsed.error.flatten().fieldErrors);
      }

      const data = parsed.data;

      if (body.testConnection) {
        try {
          const transporter = nodemailer.createTransport({
            host: data.host,
            port: data.port,
            secure: data.secure,
            auth: { user: data.user, pass: data.pass },
            connectionTimeout: 15000,
            greetingTimeout: 15000,
            socketTimeout: 20000,
            tls: { rejectUnauthorized: false },
          });
          await transporter.verify();
        } catch (err) {
          const msg = (err as Error).message ?? '';
          let hint = '';
          if (msg.includes('ECONNRESET') || msg.includes('ECONNREFUSED')) {
            hint = ` — Kiểm tra: host/port đúng chưa, port ${data.port} có được mở trên firewall chưa, và chọn đúng chế độ SSL (port 465 = bật SSL, port 587 = tắt SSL dùng STARTTLS)`;
          } else if (msg.includes('ETIMEDOUT')) {
            hint = ` — Server không phản hồi. Kiểm tra hostname và kết nối mạng`;
          } else if (msg.includes('ENOTFOUND')) {
            hint = ` — Không tìm thấy hostname "${data.host}". Kiểm tra lại địa chỉ mail server`;
          } else if (msg.includes('auth') || msg.includes('535') || msg.includes('534')) {
            hint = ` — Sai tài khoản / mật khẩu. Với Gmail hãy dùng App Password thay mật khẩu thông thường`;
          }
          return NextResponse.json(
            {
              success: false,
              error: `Kết nối SMTP thất bại: ${msg}${hint}`,
              code: 'SMTP_TEST_FAILED',
            },
            { status: 400 },
          );
        }
      }

      const config = await prisma.companySmtpConfig.upsert({
        where: { companyId },
        update: data,
        create: { companyId, ...data },
      });

      return NextResponse.json({ success: true, data: { ...config, pass: '••••••••' } });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
