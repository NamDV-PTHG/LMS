import { verifyCertificate } from '@/services/certificate.service';

interface Props {
  params: { code: string };
}

export default async function VerifyCertificatePage({ params }: Props) {
  const cert = await verifyCertificate(params.code);

  if (!cert) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-xl shadow p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">❌</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Chứng chỉ không hợp lệ</h1>
          <p className="text-muted-foreground text-sm">
            Mã chứng chỉ <code className="bg-gray-100 px-1 rounded">{params.code}</code> không tồn tại trong hệ thống.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-lg w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">{cert.isValid ? '🏆' : '⚠️'}</div>
          <h1 className="text-2xl font-bold text-gray-900">
            {cert.isValid ? 'Chứng chỉ hợp lệ' : 'Chứng chỉ đã hết hạn'}
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Mã xác thực: <code className="bg-gray-100 px-1 rounded font-mono">{cert.code}</code>
          </p>
        </div>

        {/* Certificate details */}
        <div className="border rounded-lg p-5 space-y-3 bg-gray-50">
          <Row label="Học viên" value={cert.learnerName} />
          <Row label="Khóa học" value={cert.courseTitle} />
          <Row label="Tổ chức cấp" value={cert.issuingOrg} />
          {cert.courseHours && (
            <Row label="Thời lượng" value={`${cert.courseHours} giờ`} />
          )}
          <Row
            label="Ngày hoàn thành"
            value={cert.completedAt
              ? new Date(cert.completedAt).toLocaleDateString('vi-VN', {
                  year: 'numeric', month: 'long', day: 'numeric',
                })
              : '—'}
          />
          <Row
            label="Ngày cấp"
            value={new Date(cert.issuedAt).toLocaleDateString('vi-VN', {
              year: 'numeric', month: 'long', day: 'numeric',
            })}
          />
          {cert.expiresAt && (
            <Row
              label="Hết hạn"
              value={new Date(cert.expiresAt).toLocaleDateString('vi-VN', {
                year: 'numeric', month: 'long', day: 'numeric',
              })}
            />
          )}
        </div>

        <p className="text-xs text-center text-muted-foreground mt-4">
          Được xác thực bởi hệ thống LMS Tập đoàn
        </p>

        {cert.hasPdf && (
          <div className="mt-4 text-center">
            <a
              href={`/api/my/certificates/${cert.code}`}
              className="inline-block text-sm font-medium text-blue-600 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Tải chứng chỉ PDF ↓
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right max-w-[60%]">{value}</span>
    </div>
  );
}
