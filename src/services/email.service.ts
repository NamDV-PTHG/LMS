import { getSmtpTransporter, getSmtpFrom, getCompanyEmailBranding } from '@/lib/email';
import type { Transporter } from 'nodemailer';

interface SendResult {
  success: boolean;
  error?: string;
}

async function send(
  to: string,
  subject: string,
  html: string,
  companyId?: string | null,
): Promise<SendResult> {
  try {
    let transporter: Transporter | null;
    let from: string;

    if (companyId) {
      const branding = await getCompanyEmailBranding(companyId);
      transporter = branding.transporter;
      from = branding.fromString;
    } else {
      transporter = await getSmtpTransporter();
      from = await getSmtpFrom();
    }

    if (!transporter) {
      console.warn('[Email] SMTP chưa được cấu hình — bỏ qua gửi mail');
      return { success: false, error: 'SMTP chưa cấu hình' };
    }
    await transporter.sendMail({ from, to, subject, html });
    return { success: true };
  } catch (err) {
    console.error('[Email] Gửi mail thất bại:', err);
    return { success: false, error: (err as Error).message };
  }
}

// ── Templates ─────────────────────────────────────────────────

export async function sendWelcomeEmail(
  to: string,
  fullName: string,
  password: string,
  loginUrl: string,
  appUrl?: string,
  companyId?: string | null,
): Promise<SendResult> {
  const { brandName } = await getCompanyEmailBranding(companyId);

  const appSection = appUrl ? `
    <div style="background:#f0f7ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;margin:16px 0">
      <p style="margin:0 0 6px;color:#1e40af;font-size:13px;font-weight:600">📱 Ứng dụng di động (PWA)</p>
      <p style="margin:0 0 10px;color:#374151;font-size:13px">Bạn cũng có thể học mọi lúc mọi nơi qua ứng dụng trên điện thoại:</p>
      <a href="${appUrl}" style="display:inline-block;padding:10px 20px;background:#1a56db;color:#fff;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600">Mở ứng dụng</a>
      <p style="margin:8px 0 0;color:#6b7280;font-size:12px">Hoặc truy cập: <a href="${appUrl}" style="color:#1a56db">${appUrl}</a></p>
      <p style="margin:6px 0 0;color:#6b7280;font-size:12px">💡 Thêm vào màn hình chính điện thoại để trải nghiệm như app native.</p>
    </div>` : '';

  const html = `
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#f9fafb;padding:24px;border-radius:12px">
  <div style="background:#1a56db;padding:20px 24px;border-radius:8px 8px 0 0">
    <h1 style="color:#fff;margin:0;font-size:20px">${brandName}</h1>
  </div>
  <div style="background:#fff;padding:24px;border-radius:0 0 8px 8px;border:1px solid #e5e7eb;border-top:none">
    <p style="color:#374151;font-size:15px">Xin chào <strong>${fullName}</strong>,</p>
    <p style="color:#374151;font-size:15px">Tài khoản học tập của bạn đã được tạo. Dưới đây là thông tin đăng nhập:</p>
    <div style="background:#f3f4f6;border-radius:8px;padding:16px;margin:16px 0">
      <p style="margin:0 0 8px;color:#6b7280;font-size:13px">Trang đăng nhập (máy tính):</p>
      <p style="margin:0 0 16px"><a href="${loginUrl}" style="color:#1a56db">${loginUrl}</a></p>
      <p style="margin:0 0 8px;color:#6b7280;font-size:13px">Email:</p>
      <p style="margin:0 0 16px;font-weight:600;color:#111827">${to}</p>
      <p style="margin:0 0 8px;color:#6b7280;font-size:13px">Mật khẩu tạm thời:</p>
      <p style="margin:0;font-weight:700;font-size:18px;color:#1a56db;letter-spacing:2px">${password}</p>
    </div>
    <p style="color:#ef4444;font-size:13px">⚠ Vui lòng đổi mật khẩu ngay sau khi đăng nhập lần đầu.</p>
    <a href="${loginUrl}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#1a56db;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Đăng nhập ngay</a>
    ${appSection}
  </div>
  <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:16px">Email này được gửi tự động từ hệ thống ${brandName}.</p>
</div>`;
  return send(to, `Chào mừng bạn đến với ${brandName} — Thông tin tài khoản`, html, companyId);
}

export async function sendExternalLearnerInviteEmail(
  to: string,
  fullName: string,
  password: string,
  loginUrl: string,
  groupName: string,
  courseNames: string[],
  companyId?: string | null,
): Promise<SendResult> {
  const { brandName } = await getCompanyEmailBranding(companyId);

  const courseList =
    courseNames.length > 0
      ? `<ul style="margin:8px 0;padding-left:20px;color:#374151">${courseNames.map((c) => `<li style="margin-bottom:4px">${c}</li>`).join('')}</ul>`
      : '<p style="color:#6b7280;font-size:13px;margin:4px 0">Chưa có khóa học nào được gán.</p>';

  const html = `
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#f9fafb;padding:24px;border-radius:12px">
  <div style="background:#1a56db;padding:20px 24px;border-radius:8px 8px 0 0">
    <h1 style="color:#fff;margin:0;font-size:20px">${brandName}</h1>
  </div>
  <div style="background:#fff;padding:24px;border-radius:0 0 8px 8px;border:1px solid #e5e7eb;border-top:none">
    <p style="color:#374151;font-size:15px">Xin chào <strong>${fullName}</strong>,</p>
    <p style="color:#374151;font-size:15px">Bạn đã được mời tham gia nhóm học tập <strong>"${groupName}"</strong> trên hệ thống ${brandName}.</p>

    <div style="background:#f3f4f6;border-radius:8px;padding:16px;margin:16px 0">
      <p style="margin:0 0 8px;color:#6b7280;font-size:13px">Khóa học trong nhóm:</p>
      ${courseList}
    </div>

    <div style="background:#f3f4f6;border-radius:8px;padding:16px;margin:16px 0">
      <p style="margin:0 0 8px;color:#6b7280;font-size:13px">Trang đăng nhập:</p>
      <p style="margin:0 0 16px"><a href="${loginUrl}" style="color:#1a56db">${loginUrl}</a></p>
      <p style="margin:0 0 8px;color:#6b7280;font-size:13px">Email:</p>
      <p style="margin:0 0 16px;font-weight:600;color:#111827">${to}</p>
      <p style="margin:0 0 8px;color:#6b7280;font-size:13px">Mật khẩu tạm thời:</p>
      <p style="margin:0;font-weight:700;font-size:18px;color:#1a56db;letter-spacing:2px">${password}</p>
    </div>

    <p style="color:#ef4444;font-size:13px">⚠ Vui lòng đổi mật khẩu ngay sau khi đăng nhập lần đầu.</p>
    <a href="${loginUrl}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#1a56db;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Đăng nhập ngay</a>
  </div>
  <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:16px">Email này được gửi tự động từ hệ thống ${brandName}.</p>
</div>`;
  return send(to, `Bạn được mời tham gia khóa học — ${groupName}`, html, companyId);
}

export async function sendPasswordResetEmail(
  to: string,
  fullName: string,
  resetUrl: string,
  companyId?: string | null,
): Promise<SendResult> {
  const { brandName } = await getCompanyEmailBranding(companyId);

  const html = `
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#f9fafb;padding:24px;border-radius:12px">
  <div style="background:#1a56db;padding:20px 24px;border-radius:8px 8px 0 0">
    <h1 style="color:#fff;margin:0;font-size:20px">${brandName}</h1>
  </div>
  <div style="background:#fff;padding:24px;border-radius:0 0 8px 8px;border:1px solid #e5e7eb;border-top:none">
    <p style="color:#374151;font-size:15px">Xin chào <strong>${fullName}</strong>,</p>
    <p style="color:#374151;font-size:15px">Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.</p>
    <p style="color:#374151;font-size:15px">Nhấn vào nút bên dưới để đặt lại mật khẩu. Liên kết sẽ hết hạn sau <strong>1 giờ</strong>.</p>
    <a href="${resetUrl}" style="display:inline-block;margin:20px 0;padding:14px 28px;background:#1a56db;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">Đặt lại mật khẩu</a>
    <p style="color:#6b7280;font-size:13px">Hoặc copy đường dẫn này vào trình duyệt:<br>
      <a href="${resetUrl}" style="color:#1a56db;word-break:break-all">${resetUrl}</a>
    </p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">
    <p style="color:#9ca3af;font-size:13px">Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này. Tài khoản của bạn vẫn an toàn.</p>
  </div>
  <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:16px">Email này được gửi tự động từ hệ thống ${brandName}.</p>
</div>`;
  return send(to, `Đặt lại mật khẩu — ${brandName}`, html, companyId);
}
