'use client';

import { useAuth } from '@/components/providers/auth-provider';
import { useToast } from '@/components/ui/toast';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

interface Asset {
  id: string;
  title: string;
  fileType: string;
  processingStatus: string;
  fileSizeBytes: string;
  durationSeconds?: number | null;
  downloadPolicy: string;
  visibility: string;
  createdAt: string;
}

interface LessonInfo {
  id: string;
  title: string;
  contentType: string;
  sectionId: string;
}

const PROCESSING_LABEL: Record<string, { label: string; color: string }> = {
  PENDING:    { label: 'Chờ xử lý',  color: 'bg-yellow-100 text-yellow-700' },
  PROCESSING: { label: 'Đang xử lý', color: 'bg-blue-100 text-blue-700' },
  READY:      { label: 'Sẵn sàng',   color: 'bg-green-100 text-green-700' },
  FAILED:     { label: 'Lỗi',        color: 'bg-red-100 text-red-700' },
};

const DOWNLOAD_LABEL: Record<string, string> = {
  ALLOWED: 'Cho phép tải',
  BLOCKED: 'Chặn tải',
  WATERMARK_ONLY: 'Chỉ tải có watermark',
};

const VISIBILITY_LABEL: Record<string, string> = {
  DEPT_ONLY:    'Phòng ban',
  COMPANY_WIDE: 'Toàn công ty',
  GROUP_WIDE:   'Toàn tập đoàn',
};

export default function LessonContentPage() {
  const { accessToken, user } = useAuth();
  const { toast } = useToast();
  const { id: courseId, lessonId } = useParams<{ id: string; lessonId: string }>();
  const router = useRouter();

  // Determine user's primary organizationId for upload
  const organizationId = useMemo(() => {
    if (!user?.roles?.length) return null;
    // prefer company_admin/instructor role's org, fallback to first
    const preferred = user.roles.find((r) =>
      ['company_admin', 'instructor', 'group_admin'].includes(r.role)
    );
    return preferred?.organizationId ?? user.roles[0]?.organizationId ?? null;
  }, [user]);

  const [lesson, setLesson] = useState<LessonInfo | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const authHeader = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };

  const loadLesson = () => {
    if (!accessToken || !lessonId) return;
    fetch(`/api/courses/${courseId}`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          const course = res.data;
          let found: LessonInfo | null = null;
          for (const sec of course.sections ?? []) {
            for (const les of sec.lessons ?? []) {
              if (les.id === lessonId) {
                found = { id: les.id, title: les.title, contentType: les.contentType, sectionId: sec.id };
              }
            }
          }
          setLesson(found);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  };

  const loadAssets = () => {
    if (!accessToken || !lessonId) return;
    fetch(`/api/assets?lessonId=${lessonId}`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setAssets(res.data ?? []);
      })
      .catch(() => {});
  };

  useEffect(() => { loadLesson(); loadAssets(); }, [accessToken, lessonId]); // eslint-disable-line

  const handleUpload = () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    if (!uploadTitle.trim()) { setUploadError('Vui lòng nhập tiêu đề nội dung'); return; }
    if (!organizationId) { setUploadError('Không xác định được tổ chức. Vui lòng đăng nhập lại.'); return; }

    setUploadError(null);
    setUploading(true);
    setUploadProgress(0);

    const fileType = file.type.startsWith('video/') ? 'video'
      : file.type === 'application/pdf' ? 'document'
      : file.type.startsWith('audio/') ? 'audio'
      : file.type.includes('presentation') ? 'presentation'
      : file.type.startsWith('image/') ? 'image'
      : 'document';

    // Step 1: Upload qua Next.js proxy (không cần port 9000 mở ra ngoài)
    // Dùng XHR để có progress event thực
    const fd = new FormData();
    fd.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/assets/upload');
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        // Upload chiếm 0–85%, confirm chiếm 85–100%
        setUploadProgress(Math.round((e.loaded / e.total) * 85));
      }
    };

    xhr.onload = async () => {
      if (xhr.status !== 200) {
        setUploadError(`Upload thất bại (${xhr.status}). Thử lại sau.`);
        setUploading(false);
        setUploadProgress(0);
        return;
      }

      let uploadRes: { success: boolean; data?: { tempObjectName: string }; error?: string };
      try { uploadRes = JSON.parse(xhr.responseText); }
      catch { setUploadError('Phản hồi server không hợp lệ'); setUploading(false); return; }

      if (!uploadRes.success) {
        setUploadError(uploadRes.error ?? 'Upload thất bại');
        setUploading(false);
        setUploadProgress(0);
        return;
      }

      // Step 2: Confirm — tạo DB record và enqueue processing job
      setUploadProgress(90);
      try {
        const confirmRes = await fetch('/api/assets', {
          method: 'POST',
          headers: authHeader,
          body: JSON.stringify({
            lessonId,
            organizationId,
            title: uploadTitle,
            fileType,
            mimeType: file.type || 'application/octet-stream',
            fileSizeBytes: file.size,
            tempObjectName: uploadRes.data!.tempObjectName,
          }),
        }).then((r) => r.json());

        if (!confirmRes.success) {
          setUploadError(confirmRes.error ?? 'Lỗi lưu thông tin file');
        } else {
          setUploadProgress(100);
          toast('success', 'Upload thành công! File đang được xử lý...');
          setUploadTitle('');
          if (fileRef.current) fileRef.current.value = '';
          loadAssets();
        }
      } catch {
        setUploadError('Lỗi kết nối khi lưu thông tin file');
      } finally {
        setUploading(false);
        setUploadProgress(0);
      }
    };

    xhr.onerror = () => {
      setUploadError('Lỗi kết nối. Vui lòng thử lại.');
      setUploading(false);
      setUploadProgress(0);
    };

    xhr.send(fd);
  };

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDeleteAsset = async (assetId: string) => {
    if (deletingId !== assetId) { setDeletingId(assetId); return; }
    setDeletingId(null);
    try {
      const res = await fetch(`/api/assets/${assetId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      }).then((r) => r.json());
      if (res.success) { toast('success', 'Đã xóa nội dung'); loadAssets(); }
      else toast('error', res.error ?? 'Lỗi xóa');
    } catch {
      toast('error', 'Lỗi kết nối');
    }
  };

  const handleUpdatePolicy = async (assetId: string, field: string, value: string) => {
    try {
      const res = await fetch(`/api/assets/${assetId}`, {
        method: 'PATCH',
        headers: authHeader,
        body: JSON.stringify({ [field]: value }),
      }).then((r) => r.json());
      if (!res.success) toast('error', res.error ?? 'Lỗi cập nhật');
      loadAssets();
    } catch {
      toast('error', 'Lỗi kết nối');
    }
  };

  const formatBytes = (bytes: string | number) => {
    const b = typeof bytes === 'string' ? parseInt(bytes) : bytes;
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
    return `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}p ${s}s` : `${s}s`;
  };

  if (isLoading) return <div className="flex h-64 items-center justify-center text-gray-400">Đang tải...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <button onClick={() => router.push('/courses')} className="hover:text-blue-600">Khóa học</button>
        <span>/</span>
        <button onClick={() => router.push(`/courses/${courseId}`)} className="hover:text-blue-600">Chỉnh sửa</button>
        <span>/</span>
        <span className="text-gray-900 font-medium">{lesson?.title ?? 'Bài học'} — Nội dung</span>
      </div>

      {/* Lesson info */}
      {lesson && (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
            <span className="text-purple-700 text-lg">
              {lesson.contentType === 'video' ? '▶' : lesson.contentType === 'pdf' ? '📄' : lesson.contentType === 'quiz' ? '✏' : '📝'}
            </span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{lesson.title}</h1>
            <p className="text-sm text-gray-500">Loại: {lesson.contentType}</p>
          </div>
        </div>
      )}

      {/* Upload section */}
      <div className="bg-white rounded-xl border p-6 space-y-4">
        <h2 className="font-semibold text-gray-800">Upload nội dung</h2>

        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-700">
          Video sẽ được chuyển đổi tự động sau khi upload. Tài liệu PDF/PPTX có thể dùng ngay sau khi upload xong.
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tiêu đề nội dung <span className="text-red-500">*</span></label>
            <input
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="VD: Bài giảng tuần 1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">File</label>
            <input
              ref={fileRef}
              type="file"
              accept={lesson?.contentType === 'video' ? 'video/*' : lesson?.contentType === 'pdf' ? '.pdf,application/pdf' : '*/*'}
              className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:text-sm file:font-medium file:bg-white file:text-gray-700 hover:file:bg-gray-50"
            />
          </div>
        </div>

        {uploading && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-gray-500">
              <span>Đang upload...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {uploadError && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{uploadError}</p>
        )}

        <button
          onClick={handleUpload}
          disabled={uploading}
          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {uploading ? 'Đang upload...' : 'Upload file'}
        </button>
      </div>

      {/* Existing assets */}
      <div className="space-y-3">
        <h2 className="font-semibold text-gray-800">Nội dung hiện có ({assets.length})</h2>

        {assets.length === 0 ? (
          <div className="text-center py-10 text-gray-400 bg-white rounded-xl border">
            Chưa có nội dung nào. Upload file để bắt đầu.
          </div>
        ) : (
          <div className="space-y-3">
            {assets.map((asset) => {
              const status = PROCESSING_LABEL[asset.processingStatus] ?? { label: asset.processingStatus, color: 'bg-gray-100 text-gray-500' };
              return (
                <div key={asset.id} className="bg-white rounded-xl border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-gray-900">{asset.title}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.color}`}>
                          {status.label}
                        </span>
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                          {asset.fileType}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                        <span>{formatBytes(asset.fileSizeBytes)}</span>
                        {asset.durationSeconds && <span>{formatDuration(asset.durationSeconds)}</span>}
                        <span>Tải: {DOWNLOAD_LABEL[asset.downloadPolicy] ?? asset.downloadPolicy}</span>
                        <span>Hiển thị: {VISIBILITY_LABEL[asset.visibility] ?? asset.visibility}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {asset.processingStatus === 'READY' && (
                        <span className="text-xs text-green-600 font-medium">✓ Sẵn sàng</span>
                      )}
                      {deletingId === asset.id ? (
                        <>
                          <span className="text-xs text-gray-600">Xóa?</span>
                          <button onClick={() => handleDeleteAsset(asset.id)}
                            className="text-xs text-red-600 font-medium px-2 py-1 rounded bg-red-50 hover:bg-red-100">
                            Xác nhận
                          </button>
                          <button onClick={() => setDeletingId(null)}
                            className="text-xs text-gray-500 px-2 py-1 rounded hover:bg-gray-100">
                            Hủy
                          </button>
                        </>
                      ) : (
                        <button onClick={() => handleDeleteAsset(asset.id)}
                          className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50">
                          Xóa
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Policy controls */}
                  <div className="mt-3 pt-3 border-t flex flex-wrap gap-4">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Chính sách tải</label>
                      <select
                        value={asset.downloadPolicy}
                        onChange={(e) => handleUpdatePolicy(asset.id, 'downloadPolicy', e.target.value)}
                        className="text-xs border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      >
                        <option value="BLOCKED">Chặn tải</option>
                        <option value="ALLOWED">Cho phép tải</option>
                        <option value="WATERMARK_ONLY">Chỉ có watermark</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Phạm vi hiển thị</label>
                      <select
                        value={asset.visibility}
                        onChange={(e) => handleUpdatePolicy(asset.id, 'visibility', e.target.value)}
                        className="text-xs border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      >
                        <option value="DEPT_ONLY">Phòng ban</option>
                        <option value="COMPANY_WIDE">Toàn công ty</option>
                        <option value="GROUP_WIDE">Toàn tập đoàn</option>
                      </select>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
