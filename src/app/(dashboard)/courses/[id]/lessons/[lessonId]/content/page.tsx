'use client';

import { useAuth } from '@/components/providers/auth-provider';
import { useToast } from '@/components/ui/toast';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

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

const STATUS_BADGE: Record<string, { label: string; color: string; icon: string }> = {
  PENDING:    { label: 'Chờ xử lý',  color: 'bg-warning-tint text-warning border-warning/20',   icon: '⏳' },
  PROCESSING: { label: 'Đang xử lý', color: 'bg-primary-tint text-primary border-primary/20',   icon: '⚙' },
  READY:      { label: 'Sẵn sàng',   color: 'bg-success-tint text-success border-success/20',   icon: '✓' },
  FAILED:     { label: 'Thất bại',   color: 'bg-danger-tint text-danger border-danger/20',      icon: '✗' },
};

const DOWNLOAD_LABEL: Record<string, string> = {
  ALLOWED:        'Cho phép tải',
  BLOCKED:        'Chặn tải',
  WATERMARK_ONLY: 'Chỉ tải có watermark',
};

const VISIBILITY_LABEL: Record<string, string> = {
  DEPT_ONLY:    'Phòng ban',
  COMPANY_WIDE: 'Toàn công ty',
  GROUP_WIDE:   'Toàn tập đoàn',
};

/** Fallback MIME type from file extension — needed on Windows where file.type may be empty */
function getMimeFromExtension(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    pdf:  'application/pdf',
    doc:  'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls:  'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt:  'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    mp4:  'video/mp4',
    webm: 'video/webm',
    mp3:  'audio/mpeg',
    wav:  'audio/wav',
    jpg:  'image/jpeg',
    jpeg: 'image/jpeg',
    png:  'image/png',
    gif:  'image/gif',
    webp: 'image/webp',
  };
  return map[ext] ?? 'application/octet-stream';
}

function detectFileType(file: File): string {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const mime = file.type || getMimeFromExtension(file.name);
  if (mime.startsWith('video/') || ['mp4','webm','mov','avi'].includes(ext)) return 'video';
  if (mime.startsWith('audio/') || ['mp3','wav','ogg','m4a'].includes(ext)) return 'audio';
  if (mime.startsWith('image/') || ['jpg','jpeg','png','gif','webp'].includes(ext)) return 'image';
  if (mime.includes('presentation') || ['pptx','ppt'].includes(ext)) return 'presentation';
  return 'document';
}

function formatBytes(bytes: string | number): string {
  const b = typeof bytes === 'string' ? parseInt(bytes) : bytes;
  if (b < 1024) return `${b} B`;
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
}

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}p ${s}s` : `${s}s`;
}

export default function LessonContentPage() {
  const { accessToken, user } = useAuth();
  const { toast } = useToast();
  const { id: courseId, lessonId } = useParams<{ id: string; lessonId: string }>();
  const router = useRouter();

  const organizationId = user?.roles?.[0]?.organizationId ?? null;

  const [lesson, setLesson]   = useState<LessonInfo | null>(null);
  const [assets, setAssets]   = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Upload state
  const [uploading,       setUploading]       = useState(false);
  const [uploadProgress,  setUploadProgress]  = useState(0);
  const [uploadPhase,     setUploadPhase]     = useState<'idle' | 'uploading' | 'confirming'>('idle');
  const [uploadError,     setUploadError]     = useState<string | null>(null);
  const [uploadTitle,     setUploadTitle]     = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const [pollingIds, setPollingIds] = useState<Set<string>>(new Set());

  // LMS Picker state
  const [showPicker, setShowPicker]           = useState(false);
  const [pickerAssets, setPickerAssets]       = useState<Asset[]>([]);
  const [pickerLoading, setPickerLoading]     = useState(false);
  const [pickerSearch, setPickerSearch]       = useState('');
  const [pickerType, setPickerType]           = useState('');
  const [pickerSelected, setPickerSelected]   = useState<string | null>(null);
  const [linking, setLinking]                 = useState(false);

  const authJson = useCallback(
    () => ({ Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }),
    [accessToken],
  );

  const loadLesson = useCallback(() => {
    if (!accessToken || !courseId) return;
    fetch(`/api/courses/${courseId}`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(r => r.json())
      .then(res => {
        if (!res.success) return;
        for (const sec of res.data.sections ?? []) {
          for (const les of sec.lessons ?? []) {
            if (les.id === lessonId) {
              setLesson({ id: les.id, title: les.title, contentType: les.contentType, sectionId: sec.id });
            }
          }
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [accessToken, courseId, lessonId]);

  const loadAssets = useCallback(() => {
    if (!accessToken || !lessonId) return;
    fetch(`/api/assets?lessonId=${lessonId}`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(r => r.json())
      .then(res => {
        if (!res.success) return;
        const list: Asset[] = res.data ?? [];
        setAssets(list);
        const needPoll = list
          .filter(a => a.processingStatus === 'PENDING' || a.processingStatus === 'PROCESSING')
          .map(a => a.id);
        if (needPoll.length > 0) {
          setPollingIds(prev => new Set([...prev, ...needPoll]));
        }
      })
      .catch(() => {});
  }, [accessToken, lessonId]);

  useEffect(() => { loadLesson(); loadAssets(); }, [loadLesson, loadAssets]);

  // Polling
  useEffect(() => {
    if (pollingIds.size === 0 || !accessToken) return;

    const interval = setInterval(async () => {
      const done: string[] = [];

      for (const assetId of pollingIds) {
        try {
          const res = await fetch(`/api/assets/${assetId}/status`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          const data = await res.json();
          if (!data.success) continue;

          const { processingStatus } = data.data;
          if (processingStatus === 'READY' || processingStatus === 'FAILED') {
            done.push(assetId);
            setAssets(prev =>
              prev.map(a =>
                a.id === assetId ? { ...a, processingStatus, durationSeconds: data.data.durationSeconds ?? a.durationSeconds } : a,
              ),
            );
            if (processingStatus === 'READY') {
              toast('success', 'Nội dung đã được xử lý và sẵn sàng phát!');
            } else {
              toast('error', 'Xử lý nội dung thất bại. Hệ thống đang thử lại, hoặc bạn có thể xóa và tải lên lại.');
            }
          } else {
            setAssets(prev =>
              prev.map(a => a.id === assetId ? { ...a, processingStatus } : a),
            );
          }
        } catch {
          // ignore network errors
        }
      }

      if (done.length > 0) {
        setPollingIds(prev => {
          const next = new Set(prev);
          done.forEach(id => next.delete(id));
          return next;
        });
      }
    }, 5_000);

    return () => clearInterval(interval);
  }, [pollingIds, accessToken, toast]);

  // Upload
  const handleUpload = () => {
    const file = fileRef.current?.files?.[0];
    if (!file) { setUploadError('Vui lòng chọn file'); return; }
    if (!uploadTitle.trim()) { setUploadError('Vui lòng nhập tiêu đề nội dung'); return; }
    if (!organizationId) { setUploadError('Không xác định được tổ chức. Vui lòng đăng nhập lại.'); return; }

    const fileType = detectFileType(file);
    setUploadError(null);
    setUploading(true);
    setUploadProgress(0);
    setUploadPhase('uploading');

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/assets/upload');
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
    xhr.setRequestHeader('Content-Type', file.type || getMimeFromExtension(file.name));
    xhr.setRequestHeader('X-File-Type', fileType);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        setUploadProgress(Math.round((e.loaded / e.total) * 85));
      }
    };

    xhr.onload = async () => {
      if (xhr.status !== 200) {
        let errMsg = `Upload thất bại (HTTP ${xhr.status})`;
        try { errMsg = JSON.parse(xhr.responseText)?.error ?? errMsg; } catch { /* */ }
        setUploadError(errMsg);
        setUploading(false);
        setUploadPhase('idle');
        setUploadProgress(0);
        return;
      }

      let uploadRes: { success: boolean; data?: { tempObjectName: string }; error?: string };
      try {
        uploadRes = JSON.parse(xhr.responseText);
      } catch {
        setUploadError('Phản hồi server không hợp lệ');
        setUploading(false);
        setUploadPhase('idle');
        return;
      }

      if (!uploadRes.success) {
        setUploadError(uploadRes.error ?? 'Upload thất bại');
        setUploading(false);
        setUploadPhase('idle');
        setUploadProgress(0);
        return;
      }

      setUploadProgress(90);
      setUploadPhase('confirming');
      try {
        const confirmRes = await fetch('/api/assets', {
          method: 'POST',
          headers: authJson(),
          body: JSON.stringify({
            lessonId,
            organizationId,
            title: uploadTitle.trim(),
            fileType,
            mimeType: file.type || getMimeFromExtension(file.name),
            fileSizeBytes: file.size,
            tempObjectName: uploadRes.data!.tempObjectName,
          }),
        }).then(r => r.json());

        if (!confirmRes.success) {
          setUploadError(confirmRes.error ?? 'Lỗi lưu thông tin file');
        } else {
          setUploadProgress(100);
          const newAsset: Asset = confirmRes.data;
          toast('success', 'Tải lên thành công! Đang xử lý nội dung...');
          setUploadTitle('');
          if (fileRef.current) fileRef.current.value = '';
          setAssets(prev => [{ ...newAsset, fileSizeBytes: String(newAsset.fileSizeBytes) }, ...prev]);
          setPollingIds(prev => new Set([...prev, newAsset.id]));
        }
      } catch {
        setUploadError('Lỗi kết nối khi lưu thông tin file');
      } finally {
        setUploading(false);
        setUploadPhase('idle');
        setUploadProgress(0);
      }
    };

    xhr.onerror = () => {
      setUploadError('Lỗi kết nối. Kiểm tra mạng và thử lại.');
      setUploading(false);
      setUploadPhase('idle');
      setUploadProgress(0);
    };

    xhr.ontimeout = () => {
      setUploadError('Upload quá thời gian. File quá lớn hoặc kết nối chậm.');
      setUploading(false);
      setUploadPhase('idle');
      setUploadProgress(0);
    };

    xhr.send(file);
  };

  // Unlink
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);

  const handleUnlink = async (assetId: string) => {
    if (unlinkingId !== assetId) { setUnlinkingId(assetId); return; }
    setUnlinkingId(null);
    try {
      const res = await fetch(`/api/lessons/${lessonId}/assets/${assetId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      }).then(r => r.json());
      if (res.success) {
        toast('success', 'Đã gỡ nội dung khỏi bài học');
        setAssets(prev => prev.filter(a => a.id !== assetId));
        setPollingIds(prev => { const n = new Set(prev); n.delete(assetId); return n; });
      } else {
        toast('error', res.error ?? 'Lỗi gỡ nội dung');
      }
    } catch {
      toast('error', 'Lỗi kết nối');
    }
  };

  const handleRetryUpload = async (asset: Asset) => {
    await handleUnlink(asset.id);
    setUploadTitle(asset.title);
    setTimeout(() => fileRef.current?.click(), 100);
  };

  // LMS Picker
  const loadPickerAssets = useCallback(async (search: string, type: string) => {
    if (!accessToken || !organizationId) return;
    setPickerLoading(true);
    try {
      const params = new URLSearchParams({
        orgId: organizationId,
        status: 'READY',
        limit: '50',
        ...(type ? { type } : {}),
        ...(search ? { q: search } : {}),
      });
      const res = await fetch(`/api/assets?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }).then(r => r.json());
      if (res.success) setPickerAssets(res.data ?? []);
    } catch { /* ignore */ }
    finally { setPickerLoading(false); }
  }, [accessToken, organizationId]);

  const handleOpenPicker = () => {
    setShowPicker(true);
    setPickerSelected(null);
    setPickerSearch('');
    setPickerType(lesson?.contentType === 'quiz' || lesson?.contentType === 'text' ? '' : lesson?.contentType ?? '');
    loadPickerAssets('', lesson?.contentType === 'quiz' || lesson?.contentType === 'text' ? '' : lesson?.contentType ?? '');
  };

  const handleLinkAsset = async () => {
    if (!pickerSelected) return;
    setLinking(true);
    try {
      const res = await fetch(`/api/lessons/${lessonId}/assets`, {
        method: 'POST',
        headers: authJson(),
        body: JSON.stringify({ assetId: pickerSelected }),
      }).then(r => r.json());
      if (res.success) {
        toast('success', 'Đã gắn tài liệu vào bài học');
        setShowPicker(false);
        setPickerSelected(null);
        loadAssets();
      } else {
        toast('error', res.error ?? 'Gắn thất bại');
      }
    } catch {
      toast('error', 'Lỗi kết nối');
    } finally {
      setLinking(false);
    }
  };

  const handleUpdatePolicy = async (assetId: string, field: string, value: string) => {
    try {
      const res = await fetch(`/api/assets/${assetId}`, {
        method: 'PATCH',
        headers: authJson(),
        body: JSON.stringify({ [field]: value }),
      }).then(r => r.json());
      if (res.success) {
        setAssets(prev => prev.map(a => a.id === assetId ? { ...a, [field]: value } : a));
      } else {
        toast('error', res.error ?? 'Lỗi cập nhật');
      }
    } catch {
      toast('error', 'Lỗi kết nối');
    }
  };

  // Render states
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 gap-2 text-faint">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        Đang tải...
      </div>
    );
  }

  const processingCount = assets.filter(a => ['PENDING', 'PROCESSING'].includes(a.processingStatus)).length;
  const failedCount     = assets.filter(a => a.processingStatus === 'FAILED').length;
  const readyCount      = assets.filter(a => a.processingStatus === 'READY').length;

  const acceptAttr = lesson?.contentType === 'video'
    ? 'video/*'
    : lesson?.contentType === 'pdf'
    ? '.pdf,application/pdf'
    : lesson?.contentType === 'audio'
    ? 'audio/*'
    : lesson?.contentType === 'presentation'
    ? '.ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation'
    : '*/*';

  const uploadPhaseLabel = {
    idle:       'Upload file',
    uploading:  'Đang tải lên...',
    confirming: 'Đang lưu thông tin...',
  }[uploadPhase];

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[12px] text-faint flex-wrap">
        <button onClick={() => router.push('/courses')} className="hover:text-primary transition-colors">Khóa học</button>
        <span>/</span>
        <button onClick={() => router.push(`/courses/${courseId}`)} className="hover:text-primary transition-colors">Chỉnh sửa</button>
        <span>/</span>
        <span className="text-content font-medium">{lesson?.title ?? 'Bài học'} — Nội dung</span>
      </div>

      {/* Lesson info */}
      {lesson && (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary-tint flex items-center justify-center shrink-0">
            <span className="text-primary text-[16px]">
              {lesson.contentType === 'video' ? '▶' : lesson.contentType === 'pdf' ? '📄' : lesson.contentType === 'quiz' ? '✏' : '📝'}
            </span>
          </div>
          <div>
            <h1 className="text-[16px] font-medium text-content">{lesson.title}</h1>
            <p className="text-[11px] text-faint">Loại nội dung: {lesson.contentType}</p>
          </div>
        </div>
      )}

      {/* Status summary */}
      {assets.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {readyCount > 0 && (
            <span className="inline-flex items-center gap-1.5 text-[11px] px-3 py-1 rounded-full bg-success-tint text-success border border-success/20">
              ✓ {readyCount} sẵn sàng
            </span>
          )}
          {processingCount > 0 && (
            <span className="inline-flex items-center gap-1.5 text-[11px] px-3 py-1 rounded-full bg-primary-tint text-primary border border-primary/20 animate-pulse">
              <span className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              {processingCount} đang xử lý (tự cập nhật)
            </span>
          )}
          {failedCount > 0 && (
            <span className="inline-flex items-center gap-1.5 text-[11px] px-3 py-1 rounded-full bg-danger-tint text-danger border border-danger/20">
              ✗ {failedCount} thất bại — cần tải lại
            </span>
          )}
        </div>
      )}

      {/* Upload section */}
      <div className="bg-surface border border-default rounded-xl shadow-card p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-[13px] font-medium text-content">Tải lên nội dung</h2>
          <button
            onClick={handleOpenPicker}
            disabled={uploading || !organizationId}
            className="inline-flex items-center gap-2 px-3 py-2 text-[12px] font-medium rounded-lg border border-primary/20 bg-primary-tint text-primary hover:bg-primary/10 disabled:opacity-50 transition-colors"
          >
            📚 Chọn từ thư viện LMS
          </button>
        </div>

        <div className="bg-primary-tint border border-primary/15 rounded-lg p-3 text-[11px] text-primary space-y-1">
          <p>• Video được chuyển đổi HLS tự động — có thể mất vài phút tùy độ dài.</p>
          <p>• Tài liệu PDF/PPTX sẵn sàng ngay sau khi upload xong.</p>
          <p>• Trạng thái cập nhật tự động — không cần tải lại trang.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[12px] font-medium text-content mb-1">
              Tiêu đề nội dung <span className="text-danger">*</span>
            </label>
            <input
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              disabled={uploading}
              className="w-full border border-default rounded-lg px-3 py-2 text-[12px] text-content placeholder:text-faint focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors disabled:bg-muted"
              placeholder="VD: Bài giảng tuần 1"
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-content mb-1">File</label>
            <input
              ref={fileRef}
              type="file"
              accept={acceptAttr}
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f && !uploadTitle) {
                  setUploadTitle(f.name.replace(/\.[^.]+$/, ''));
                }
              }}
              className="w-full text-[12px] text-subtle file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-default file:text-[11px] file:font-medium file:bg-muted file:text-subtle hover:file:bg-primary-tint hover:file:text-primary disabled:opacity-50 transition-colors"
            />
          </div>
        </div>

        {/* Progress bar */}
        {uploading && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] text-faint">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                {uploadPhase === 'confirming' ? 'Đang đăng ký với hệ thống...' : `Đang tải lên... ${uploadProgress}%`}
              </span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden border border-default">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {uploadError && (
          <div className="flex items-start gap-2 text-[12px] text-danger bg-danger-tint rounded-lg px-3 py-2 border border-danger/20">
            <span className="shrink-0 mt-0.5">✗</span>
            <span>{uploadError}</span>
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={uploading}
          className="px-5 py-2 bg-primary hover:bg-primary-dark text-white text-[12px] font-medium rounded-lg disabled:opacity-50 transition-colors"
        >
          {uploading ? uploadPhaseLabel : '↑ Upload file'}
        </button>
      </div>

      {/* Asset list */}
      <div className="space-y-3">
        <h2 className="text-[13px] font-medium text-content">
          Nội dung hiện có ({assets.length})
          {processingCount > 0 && (
            <span className="ml-2 text-[11px] font-normal text-primary animate-pulse">
              • Đang theo dõi {processingCount} file...
            </span>
          )}
        </h2>

        {assets.length === 0 ? (
          <div className="text-center py-10 text-[12px] text-faint bg-surface border border-default rounded-xl">
            Chưa có nội dung nào. Upload file ở trên để bắt đầu.
          </div>
        ) : (
          <div className="space-y-3">
            {assets.map((asset) => {
              const badge = STATUS_BADGE[asset.processingStatus] ?? STATUS_BADGE.PENDING;
              const isFailed  = asset.processingStatus === 'FAILED';
              const isReady   = asset.processingStatus === 'READY';
              const isWorking = !isReady && !isFailed;

              return (
                <div
                  key={asset.id}
                  className={`bg-surface rounded-xl border p-4 shadow-card transition-colors ${
                    isFailed ? 'border-danger/30' : isReady ? 'border-default' : 'border-primary/20'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[12px] font-medium text-content">{asset.title}</p>
                        <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-medium ${badge.color}`}>
                          {isWorking && <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />}
                          {!isWorking && <span>{badge.icon}</span>}
                          {badge.label}
                        </span>
                        <span className="text-[10px] bg-muted text-faint px-2 py-0.5 rounded-full">
                          {asset.fileType}
                        </span>
                      </div>

                      <div className="flex items-center flex-wrap gap-3 mt-1.5 text-[11px] text-faint">
                        <span>{formatBytes(asset.fileSizeBytes)}</span>
                        {asset.durationSeconds && <span>{formatDuration(asset.durationSeconds)}</span>}
                        <span>Tải: {DOWNLOAD_LABEL[asset.downloadPolicy] ?? asset.downloadPolicy}</span>
                        <span>Hiển thị: {VISIBILITY_LABEL[asset.visibility] ?? asset.visibility}</span>
                      </div>

                      {isFailed && (
                        <div className="mt-2 text-[11px] text-danger bg-danger-tint rounded-lg px-2 py-1.5 border border-danger/20">
                          ✗ Xử lý thất bại. Hệ thống đã thử lại 3 lần.{' '}
                          <button
                            onClick={() => handleRetryUpload(asset)}
                            className="underline font-medium hover:opacity-80"
                          >
                            Xóa và tải lên lại
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {unlinkingId === asset.id ? (
                        <>
                          <span className="text-[11px] text-subtle">Gỡ khỏi bài học?</span>
                          <button
                            onClick={() => handleUnlink(asset.id)}
                            className="text-[11px] text-danger font-medium px-2 py-1 rounded-lg bg-danger-tint hover:bg-danger/20 transition-colors"
                          >
                            Xác nhận
                          </button>
                          <button
                            onClick={() => setUnlinkingId(null)}
                            className="text-[11px] text-subtle px-2 py-1 rounded-lg hover:bg-muted transition-colors"
                          >
                            Hủy
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleUnlink(asset.id)}
                          className="text-[11px] text-faint hover:text-danger px-2 py-1 rounded-lg hover:bg-danger-tint transition-colors"
                          title="Gỡ khỏi bài học (tài liệu vẫn còn trong thư viện LMS)"
                        >
                          Gỡ
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Policy controls — chỉ hiện khi READY */}
                  {isReady && (
                    <div className="mt-3 pt-3 border-t border-default flex flex-wrap gap-4">
                      <div>
                        <label className="block text-[11px] text-faint mb-1">Chính sách tải</label>
                        <select
                          value={asset.downloadPolicy}
                          onChange={(e) => handleUpdatePolicy(asset.id, 'downloadPolicy', e.target.value)}
                          className="text-[11px] border border-default rounded-lg px-2 py-1 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 bg-surface"
                        >
                          <option value="BLOCKED">Chặn tải</option>
                          <option value="ALLOWED">Cho phép tải</option>
                          <option value="WATERMARK_ONLY">Chỉ có watermark</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] text-faint mb-1">Phạm vi hiển thị</label>
                        <select
                          value={asset.visibility}
                          onChange={(e) => handleUpdatePolicy(asset.id, 'visibility', e.target.value)}
                          className="text-[11px] border border-default rounded-lg px-2 py-1 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 bg-surface"
                        >
                          <option value="DEPT_ONLY">Phòng ban</option>
                          <option value="COMPANY_WIDE">Toàn công ty</option>
                          <option value="GROUP_WIDE">Toàn tập đoàn</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* LMS Asset Picker Modal */}
      {showPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl bg-surface rounded-xl shadow-card border border-default flex flex-col max-h-[80vh]">
            {/* Header */}
            <div className="px-5 py-4 border-b border-default flex items-center justify-between">
              <div>
                <h2 className="text-[14px] font-medium text-content">📚 Chọn tài liệu từ thư viện LMS</h2>
                <p className="text-[11px] text-faint mt-0.5">
                  Hiển thị tài liệu sẵn sàng trong phòng ban của bạn
                </p>
              </div>
              <button
                onClick={() => setShowPicker(false)}
                className="text-faint hover:text-content text-xl leading-none transition-colors"
              >
                ×
              </button>
            </div>

            {/* Filters */}
            <div className="px-5 py-3 border-b border-default flex gap-3 flex-wrap">
              <input
                type="text"
                placeholder="🔍 Tìm theo tên..."
                value={pickerSearch}
                onChange={(e) => {
                  setPickerSearch(e.target.value);
                  loadPickerAssets(e.target.value, pickerType);
                }}
                className="flex-1 min-w-0 text-[12px] border border-default rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-content placeholder:text-faint"
              />
              <select
                value={pickerType}
                onChange={(e) => {
                  setPickerType(e.target.value);
                  loadPickerAssets(pickerSearch, e.target.value);
                }}
                className="text-[12px] border border-default rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 bg-surface"
              >
                <option value="">Tất cả loại</option>
                <option value="video">▶ Video</option>
                <option value="document">📄 Tài liệu</option>
                <option value="presentation">📊 Trình chiếu</option>
                <option value="audio">🎵 Audio</option>
                <option value="image">🖼 Hình ảnh</option>
              </select>
            </div>

            {/* Asset list */}
            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
              {pickerLoading ? (
                <div className="flex items-center justify-center py-12 text-faint gap-2 text-[12px]">
                  <span className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  Đang tải...
                </div>
              ) : pickerAssets.length === 0 ? (
                <div className="text-center py-12 text-faint text-[12px]">
                  {pickerSearch || pickerType ? 'Không tìm thấy tài liệu phù hợp.' : 'Phòng ban chưa có tài liệu sẵn sàng.'}
                </div>
              ) : (
                pickerAssets.map((asset) => {
                  const typeIcon: Record<string, string> = { video: '▶', document: '📄', presentation: '📊', audio: '🎵', image: '🖼' };
                  const isSelected = pickerSelected === asset.id;
                  const alreadyLinked = assets.some(a => a.id === asset.id);
                  return (
                    <button
                      key={asset.id}
                      disabled={alreadyLinked}
                      onClick={() => setPickerSelected(isSelected ? null : asset.id)}
                      className={`w-full text-left rounded-xl border px-4 py-3 transition-colors ${
                        alreadyLinked
                          ? 'opacity-50 cursor-not-allowed bg-muted border-default'
                          : isSelected
                          ? 'border-primary bg-primary-tint ring-2 ring-primary/20'
                          : 'border-default hover:bg-muted hover:border-primary/30'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-[16px] w-6 text-center shrink-0">{typeIcon[asset.fileType] ?? '📄'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-medium text-content truncate">{asset.title}</p>
                          <p className="text-[11px] text-faint mt-0.5">
                            {asset.fileType}
                            {asset.durationSeconds ? ` · ${formatDuration(asset.durationSeconds)}` : ''}
                            {' · '}{formatBytes(asset.fileSizeBytes)}
                            {alreadyLinked && <span className="ml-2 text-success font-medium">✓ Đã gắn</span>}
                          </p>
                        </div>
                        {isSelected && !alreadyLinked && (
                          <span className="shrink-0 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                            <span className="text-white text-[10px]">✓</span>
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-default flex items-center justify-between">
              <p className="text-[11px] text-faint">
                {pickerAssets.length > 0 ? `${pickerAssets.length} tài liệu trong phòng ban` : ''}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowPicker(false); setPickerSelected(null); }}
                  className="px-4 py-2 text-[12px] border border-default rounded-lg hover:bg-muted text-subtle transition-colors"
                >
                  Hủy
                </button>
                <button
                  onClick={handleLinkAsset}
                  disabled={!pickerSelected || linking}
                  className="px-4 py-2 text-[12px] font-medium bg-primary hover:bg-primary-dark text-white rounded-lg disabled:opacity-50 transition-colors"
                >
                  {linking ? 'Đang gắn...' : '✓ Gắn vào bài học'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
