'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { useToast } from '@/components/ui/toast';

// ── Types ─────────────────────────────────────────────────────

interface MediaFolderNode {
  id: string;
  name: string;
  type: string;
  isVirtualRoot: boolean;
  assetCount: number;
  children: MediaFolderNode[];
}

interface AssetItem {
  id: string;
  title: string;
  description?: string;
  fileType: string;
  mimeType: string;
  fileSizeBytes: string;
  durationSeconds?: number;
  downloadPolicy: string;
  visibility: string;
  processingStatus: string;
  thumbnailPath?: string;
  createdAt: string;
  organization: { id: string; name: string };
  uploader: { id: string; fullName: string };
}

interface AssetsMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface DownloadPermission {
  allowed: boolean;
  canManage: boolean;
  companyId: string;
}

// ── Helpers ───────────────────────────────────────────────────

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

function formatBytes(bytes: string): string {
  const b = parseInt(bytes, 10);
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function fileTypeIcon(type: string): string {
  switch (type) {
    case 'video': return '🎬';
    case 'audio': return '🎵';
    case 'document': return '📄';
    case 'presentation': return '📊';
    case 'image': return '🖼️';
    default: return '📁';
  }
}

function fileTypeLabel(type: string): string {
  switch (type) {
    case 'video': return 'Video';
    case 'audio': return 'Âm thanh';
    case 'document': return 'Tài liệu';
    case 'presentation': return 'Trình chiếu';
    case 'image': return 'Hình ảnh';
    default: return type;
  }
}

// ── Sub-components ────────────────────────────────────────────

interface FolderTreeProps {
  nodes: MediaFolderNode[];
  selectedId: string | null;
  expandedIds: Set<string>;
  onSelect: (id: string) => void;
  onToggleExpand: (id: string) => void;
  canManagePermission: boolean;
  companyId: string | undefined;
  onManagePermission: (companyId: string) => void;
  depth?: number;
}

function FolderTree({
  nodes,
  selectedId,
  expandedIds,
  onSelect,
  onToggleExpand,
  canManagePermission,
  companyId,
  onManagePermission,
  depth = 0,
}: FolderTreeProps) {
  return (
    <ul className="space-y-0.5">
      {nodes.map(node => {
        const isExpanded = expandedIds.has(node.id);
        const isSelected = selectedId === node.id;
        const hasChildren = node.children.length > 0;
        const isCompanyNode = node.isVirtualRoot || node.type === 'company';

        return (
          <li key={node.id}>
            <div
              className={`flex items-center gap-1 px-2 py-1.5 rounded-md cursor-pointer group transition-colors
                ${isSelected ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100 text-gray-700'}`}
              style={{ paddingLeft: `${0.5 + depth * 1}rem` }}
            >
              {/* Expand/collapse toggle */}
              <button
                onClick={(e) => { e.stopPropagation(); onToggleExpand(node.id); }}
                className="w-4 h-4 flex items-center justify-center shrink-0 text-gray-400 hover:text-gray-600"
              >
                {hasChildren ? (isExpanded ? '▾' : '▸') : <span className="w-4" />}
              </button>

              {/* Folder icon + name */}
              <button
                onClick={() => {
                  onSelect(node.id);
                  if (hasChildren && !isExpanded) onToggleExpand(node.id);
                }}
                className="flex-1 flex items-center gap-1.5 text-sm text-left min-w-0"
              >
                <span className="shrink-0">{isCompanyNode ? '🏢' : '📁'}</span>
                <span className="truncate font-medium">{node.name}</span>
                <span className={`ml-auto shrink-0 text-xs px-1.5 py-0.5 rounded-full
                  ${isSelected ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                  {node.assetCount}
                </span>
              </button>

              {/* Permission management button for group_admin on company nodes */}
              {canManagePermission && isCompanyNode && (
                <button
                  onClick={(e) => { e.stopPropagation(); onManagePermission(node.id); }}
                  className="w-5 h-5 shrink-0 text-gray-300 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Quản lý quyền tải thư mục"
                >
                  ⚙
                </button>
              )}
            </div>

            {hasChildren && isExpanded && (
              <FolderTree
                nodes={node.children}
                selectedId={selectedId}
                expandedIds={expandedIds}
                onSelect={onSelect}
                onToggleExpand={onToggleExpand}
                canManagePermission={canManagePermission}
                companyId={companyId}
                onManagePermission={onManagePermission}
                depth={depth + 1}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ── Asset Card ────────────────────────────────────────────────

interface AssetCardProps {
  asset: AssetItem;
  onPreview: (asset: AssetItem) => void;
  onDownload: (assetId: string) => void;
}

function AssetCard({ asset, onPreview, onDownload }: AssetCardProps) {
  const canDownload = asset.processingStatus === 'READY';
  const isPending = asset.processingStatus !== 'READY';

  return (
    <div className="border rounded-lg bg-white hover:shadow-md transition-shadow p-3 flex flex-col gap-2">
      {/* Icon + type badge */}
      <div className="flex items-center justify-between">
        <span className="text-2xl">{fileTypeIcon(asset.fileType)}</span>
        <span className={`text-xs px-1.5 py-0.5 rounded-full
          ${isPending ? 'bg-yellow-50 text-yellow-600' : 'bg-gray-100 text-gray-500'}`}>
          {isPending ? 'Đang xử lý' : fileTypeLabel(asset.fileType)}
        </span>
      </div>

      {/* Title */}
      <p className="text-sm font-medium text-gray-900 line-clamp-2 leading-snug min-h-[2.5rem]">
        {asset.title}
      </p>

      {/* Meta */}
      <div className="text-xs text-gray-400 space-y-0.5">
        <p>{formatBytes(asset.fileSizeBytes)}</p>
        <p>{new Date(asset.createdAt).toLocaleDateString('vi-VN')}</p>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-auto">
        <button
          onClick={() => onPreview(asset)}
          disabled={!canDownload}
          className="flex-1 text-xs px-2 py-1.5 rounded-md border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Xem trước
        </button>
        <button
          onClick={() => onDownload(asset.id)}
          disabled={!canDownload}
          className="flex-1 text-xs px-2 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Tải về
        </button>
      </div>
    </div>
  );
}

// ── Preview Modal ─────────────────────────────────────────────

interface PreviewModalProps {
  asset: AssetItem;
  url: string | null;
  onClose: () => void;
}

function PreviewModal({ asset, url, onClose }: PreviewModalProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <h2 className="font-semibold text-gray-900 truncate pr-4">{asset.title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">✕</button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex items-center justify-center bg-gray-50 min-h-[300px]">
          {!url ? (
            <div className="text-gray-400 text-sm">Đang tải xem trước...</div>
          ) : asset.fileType === 'video' ? (
            <video
              src={url}
              controls
              className="max-h-full max-w-full rounded"
              autoPlay={false}
            />
          ) : asset.fileType === 'audio' ? (
            <div className="flex flex-col items-center gap-4 p-8">
              <span className="text-6xl">🎵</span>
              <p className="text-gray-700 font-medium">{asset.title}</p>
              <audio src={url} controls className="w-full max-w-md" />
            </div>
          ) : asset.fileType === 'image' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={asset.title} className="max-h-full max-w-full object-contain rounded" />
          ) : (
            <iframe
              src={url}
              title={asset.title}
              className="w-full h-full rounded"
              style={{ minHeight: '60vh' }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Upload Modal ──────────────────────────────────────────────

interface UploadModalProps {
  selectedFolderId: string | null;
  accessToken: string;
  onClose: () => void;
  onSuccess: () => void;
}

function UploadModal({ selectedFolderId, accessToken, onClose, onSuccess }: UploadModalProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<'select' | 'uploading' | 'confirming' | 'done'>('select');
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [progress, setProgress] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const ACCEPT = '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.mp4,.mp3,.jpg,.jpeg,.png,.gif,.webp';

  function detectFileType(f: File): string {
    const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
    const mime = f.type || getMimeFromExtension(f.name);
    if (mime.startsWith('video/') || ['mp4','webm','mov','avi'].includes(ext)) return 'video';
    if (mime.startsWith('audio/') || ['mp3','wav','ogg','m4a'].includes(ext)) return 'audio';
    if (mime.startsWith('image/') || ['jpg','jpeg','png','gif','webp'].includes(ext)) return 'image';
    if (mime.includes('presentation') || ['pptx','ppt'].includes(ext)) return 'presentation';
    return 'document';
  }

  async function handleUpload() {
    if (!file || !title.trim() || !selectedFolderId) return;
    if (title.trim().length < 1) { toast('warning', 'Vui lòng nhập tên tài liệu'); return; }

    try {
      setStep('uploading');
      setProgress(0);

      // Step 1: Get presigned upload URL
      const urlRes = await fetch('/api/assets/upload-url', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const urlData = await urlRes.json();
      if (!urlData.success) throw new Error(urlData.error);
      const { uploadUrl, tempObjectName } = urlData.data;

      // Step 2: Upload file to MinIO
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type || getMimeFromExtension(file.name));
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 90));
        };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('Upload thất bại')));
        xhr.onerror = () => reject(new Error('Lỗi kết nối'));
        xhr.send(file);
      });

      setProgress(90);
      setStep('confirming');

      // Step 3: Confirm upload
      const confirmRes = await fetch('/api/assets', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organizationId: selectedFolderId,
          title: title.trim(),
          description: description.trim() || undefined,
          fileType: detectFileType(file),
          mimeType: file.type || getMimeFromExtension(file.name),
          fileSizeBytes: file.size,
          tempObjectName,
        }),
      });
      const confirmData = await confirmRes.json();
      if (!confirmData.success) throw new Error(confirmData.error);

      setProgress(100);
      setStep('done');
      toast('success', 'Đã tải lên thành công, đang xử lý tài liệu...');
      onSuccess();
    } catch (err) {
      toast('error', (err as Error).message ?? 'Tải lên thất bại');
      setStep('select');
      setProgress(0);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold text-gray-900">Tải lên tài liệu</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl">✕</button>
        </div>

        <div className="p-4 space-y-4">
          {step === 'select' || step === 'uploading' || step === 'confirming' ? (
            <>
              {/* File picker */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tệp tài liệu</label>
                <input
                  ref={fileRef}
                  type="file"
                  accept={ACCEPT}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setFile(f);
                      if (!title) setTitle(f.name.replace(/\.[^.]+$/, ''));
                    }
                  }}
                  className="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                {file && <p className="mt-1 text-xs text-gray-400">{file.name} · {formatBytes(String(file.size))}</p>}
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên tài liệu <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                  placeholder="Nhập tên tài liệu..."
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả (tuỳ chọn)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Mô tả ngắn về tài liệu..."
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {/* Progress bar */}
              {(step === 'uploading' || step === 'confirming') && (
                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>{step === 'confirming' ? 'Đang xác nhận...' : 'Đang tải lên...'}</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={onClose}
                  disabled={step !== 'select'}
                  className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-40"
                >
                  Huỷ
                </button>
                <button
                  onClick={handleUpload}
                  disabled={!file || !title.trim() || step !== 'select'}
                  className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-40"
                >
                  Tải lên
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-6">
              <div className="text-4xl mb-3">✅</div>
              <p className="text-gray-700 font-medium">Tải lên thành công!</p>
              <p className="text-sm text-gray-400 mt-1">Tài liệu đang được xử lý và sẽ sẵn sàng trong ít phút.</p>
              <button
                onClick={onClose}
                className="mt-4 px-6 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
              >
                Đóng
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Permission Modal (for group_admin) ─────────────────────────

interface PermissionModalProps {
  targetCompanyId: string;
  currentAllowed: boolean;
  accessToken: string;
  onClose: () => void;
  onUpdate: (allow: boolean) => void;
}

function PermissionModal({ targetCompanyId, currentAllowed, accessToken, onClose, onUpdate }: PermissionModalProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [allowed, setAllowed] = useState(currentAllowed);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/media-library/folder-download-permission', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ targetCompanyId, allow: allowed }),
      });
      const data = await res.json();
      if (data.success) {
        toast('success', allowed ? 'Đã cấp quyền tải thư mục cho công ty này' : 'Đã thu hồi quyền tải thư mục');
        onUpdate(allowed);
        onClose();
      } else {
        toast('error', data.error ?? 'Cập nhật thất bại');
      }
    } catch {
      toast('error', 'Lỗi kết nối');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-sm shadow-xl">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold text-gray-900">Quyền tải thư mục</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl">✕</button>
        </div>
        <div className="p-4 space-y-4">
          <p className="text-sm text-gray-600">
            Cấu hình quyền tải toàn bộ thư mục (ZIP) cho Admin của công ty này.
          </p>
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-800">Cho phép tải thư mục</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Admin công ty có thể tải ZIP toàn bộ tài liệu của phòng ban / công ty
              </p>
            </div>
            <button
              onClick={() => setAllowed(v => !v)}
              className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ml-3
                ${allowed ? 'bg-blue-600' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform
                ${allowed ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Huỷ
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Đang lưu...' : 'Lưu'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────

const FILE_TYPE_OPTIONS = [
  { value: '', label: 'Tất cả loại' },
  { value: 'video', label: 'Video' },
  { value: 'audio', label: 'Âm thanh' },
  { value: 'document', label: 'Tài liệu' },
  { value: 'presentation', label: 'Trình chiếu' },
  { value: 'image', label: 'Hình ảnh' },
];

export default function MediaLibraryPage() {
  const { user, accessToken } = useAuth();
  const { toast } = useToast();

  // Tree state
  const [tree, setTree] = useState<MediaFolderNode[]>([]);
  const [treeLoading, setTreeLoading] = useState(true);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Assets state
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [assetsMeta, setAssetsMeta] = useState<AssetsMeta | null>(null);
  const [assetsLoading, setAssetsLoading] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);

  // Permission
  const [permission, setPermission] = useState<DownloadPermission | null>(null);

  // Modals
  const [previewAsset, setPreviewAsset] = useState<AssetItem | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [permissionModal, setPermissionModal] = useState<string | null>(null); // companyId to manage

  // Folder download
  const [folderDownloading, setFolderDownloading] = useState(false);

  // Role checks
  const userRoles = user?.roles?.map((r: unknown) =>
    typeof r === 'string' ? r : (r as { role: string }).role,
  ) ?? [];
  const isAdmin = userRoles.some(r => ['company_admin', 'hr_manager', 'group_admin', 'group_hrm'].includes(r));
  const isUploader = userRoles.some(r => ['company_admin', 'hr_manager'].includes(r));
  const canManagePermission = userRoles.includes('group_admin');

  const authHeaders = useCallback(
    () => ({ Authorization: `Bearer ${accessToken}` }),
    [accessToken],
  );

  // ── Load tree ─────────────────────────────────────────────

  useEffect(() => {
    if (!accessToken) return;
    setTreeLoading(true);
    fetch('/api/media-library/tree', { headers: authHeaders() })
      .then(r => r.json())
      .then(res => {
        if (res.success && res.data.tree?.length > 0) {
          setTree(res.data.tree);
          const root = res.data.tree[0];
          setSelectedFolderId(root.id);
          setExpandedIds(new Set([root.id]));
        }
      })
      .catch(() => toast('error', 'Không thể tải cây thư mục'))
      .finally(() => setTreeLoading(false));
  }, [accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load download permission ───────────────────────────────

  useEffect(() => {
    if (!accessToken || !isAdmin) return;
    fetch('/api/media-library/folder-download-permission', { headers: authHeaders() })
      .then(r => r.json())
      .then(res => { if (res.success) setPermission(res.data); })
      .catch(() => {/* silent */});
  }, [accessToken, isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load assets ───────────────────────────────────────────

  useEffect(() => {
    if (!accessToken || !selectedFolderId) return;
    setAssetsLoading(true);
    setPage(1); // reset page when folder changes
  }, [selectedFolderId, typeFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!accessToken || !selectedFolderId) return;
    setAssetsLoading(true);
    const params = new URLSearchParams({
      orgId: selectedFolderId,
      page: String(page),
      limit: '20',
      status: 'READY',
      ...(typeFilter ? { type: typeFilter } : {}),
    });
    fetch(`/api/assets?${params}`, { headers: authHeaders() })
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          setAssets(res.data ?? []);
          setAssetsMeta(res.meta ?? null);
        }
      })
      .catch(() => toast('error', 'Không thể tải danh sách tài liệu'))
      .finally(() => setAssetsLoading(false));
  }, [accessToken, selectedFolderId, page, typeFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ──────────────────────────────────────────────

  function toggleExpand(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectFolder(id: string) {
    setSelectedFolderId(id);
    setSearch('');
    setPage(1);
  }

  async function handlePreview(asset: AssetItem) {
    if (!accessToken) return;
    setPreviewAsset(asset);
    setPreviewUrl(null);
    try {
      const endpoint = (asset.fileType === 'video' || asset.fileType === 'audio')
        ? `/api/assets/${asset.id}/stream-url`
        : `/api/assets/${asset.id}/view-url`;
      const res = await fetch(endpoint, { headers: authHeaders() });
      const data = await res.json();
      const url = data.data?.url;
      if (url) {
        setPreviewUrl(url);
      } else {
        toast('error', data.error ?? 'Không thể tải xem trước');
        setPreviewAsset(null);
      }
    } catch {
      toast('error', 'Lỗi khi tải xem trước');
      setPreviewAsset(null);
    }
  }

  async function handleDownloadSingle(assetId: string) {
    if (!accessToken) return;
    try {
      const res = await fetch(`/api/assets/${assetId}/download`, {
        method: 'POST',
        headers: authHeaders(),
      });
      const data = await res.json();
      if (data.success && data.data?.url) {
        window.open(data.data.url, '_blank');
      } else if (data.success && data.data?.requiresWatermark) {
        toast('info', 'Tài liệu này yêu cầu watermark, không thể tải trực tiếp');
      } else {
        toast('error', data.error ?? 'Không thể tải tài liệu');
      }
    } catch {
      toast('error', 'Lỗi khi tải tài liệu');
    }
  }

  async function handleFolderDownload() {
    if (!selectedFolderId || !accessToken || folderDownloading) return;

    // Check permission for company-level users
    if (!canManagePermission && !userRoles.some(r => ['group_admin', 'group_hrm'].includes(r))) {
      if (!permission?.allowed) {
        toast('error', 'Bạn không có quyền tải thư mục. Vui lòng liên hệ quản trị viên tập đoàn.');
        return;
      }
    }

    setFolderDownloading(true);
    toast('info', 'Đang tạo file ZIP, vui lòng chờ...');
    try {
      const res = await fetch('/api/media-library/download-folder', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId: selectedFolderId }),
      });

      if (!res.ok) {
        let errMsg = 'Lỗi khi tạo file tải về';
        try { const j = await res.json(); errMsg = j.error ?? errMsg; } catch { /* */ }
        toast('error', errMsg);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // Use Content-Disposition filename from header or fallback
      const cd = res.headers.get('Content-Disposition') ?? '';
      const fnMatch = cd.match(/filename="([^"]+)"/);
      a.download = fnMatch ? fnMatch[1] : 'thu-muc-tai-lieu.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast('success', 'Đã tải thư mục thành công');
    } catch {
      toast('error', 'Không thể tải thư mục, vui lòng thử lại');
    } finally {
      setFolderDownloading(false);
    }
  }

  function handleUploadSuccess() {
    setShowUpload(false);
    // Refresh asset list
    setPage(p => p); // trigger re-fetch by maintaining same page
    // Invalidate by re-setting the same folder
    setSelectedFolderId(id => id);
  }

  // Client-side name search
  const filteredAssets = search
    ? assets.filter(a => a.title.toLowerCase().includes(search.toLowerCase()))
    : assets;

  // Can the current user do folder downloads?
  const canFolderDownload = userRoles.some(r => ['group_admin', 'group_hrm'].includes(r))
    || (isAdmin && permission?.allowed === true);

  // Find selected folder name
  function findFolderName(nodes: MediaFolderNode[], id: string): string {
    for (const n of nodes) {
      if (n.id === id) return n.name;
      const found = findFolderName(n.children, id);
      if (found) return found;
    }
    return '';
  }
  const selectedFolderName = selectedFolderId ? findFolderName(tree, selectedFolderId) : '';

  // ── Render ────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* ── Page header ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-white shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Thư viện tài liệu</h1>
          <p className="text-sm text-gray-400 mt-0.5">Quản lý tài liệu theo phòng ban</p>
        </div>
        {isUploader && (
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <span>+</span> Tải lên
          </button>
        )}
      </div>

      {/* ── Body: 2-panel layout ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT: Folder tree ── */}
        <aside className="w-64 border-r bg-white flex flex-col shrink-0 overflow-hidden">
          {/* Search */}
          <div className="p-3 border-b">
            <input
              type="text"
              placeholder="Tìm thư mục..."
              className="w-full text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {/* Tree */}
          <div className="flex-1 overflow-y-auto py-2 px-1.5">
            {treeLoading ? (
              <div className="flex items-center justify-center py-10">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : tree.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Chưa có thư mục</p>
            ) : (
              <FolderTree
                nodes={tree}
                selectedId={selectedFolderId}
                expandedIds={expandedIds}
                onSelect={selectFolder}
                onToggleExpand={toggleExpand}
                canManagePermission={canManagePermission}
                companyId={tree[0]?.id}
                onManagePermission={(id) => setPermissionModal(id)}
              />
            )}
          </div>
        </aside>

        {/* ── RIGHT: Asset grid ── */}
        <main className="flex-1 flex flex-col overflow-hidden bg-gray-50">
          {/* Toolbar */}
          <div className="flex items-center gap-3 px-4 py-3 bg-white border-b shrink-0 flex-wrap">
            {/* Breadcrumb */}
            <div className="flex items-center gap-1 text-sm text-gray-500 min-w-0 mr-auto">
              <span>📁</span>
              <span className="font-medium text-gray-800 truncate">{selectedFolderName || '—'}</span>
              {assetsMeta && (
                <span className="text-gray-400 shrink-0">({assetsMeta.total} tài liệu)</span>
              )}
            </div>

            {/* Search */}
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm tên tài liệu..."
              className="border border-gray-200 rounded-md px-3 py-1.5 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />

            {/* Type filter */}
            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
              className="border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              {FILE_TYPE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            {/* Folder download button */}
            {isAdmin && (
              <button
                onClick={handleFolderDownload}
                disabled={folderDownloading || !selectedFolderId || !canFolderDownload}
                title={
                  !canFolderDownload
                    ? 'Chưa được cấp quyền tải thư mục (liên hệ Group Admin)'
                    : 'Tải toàn bộ thư mục (ZIP)'
                }
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border transition-colors
                  ${canFolderDownload
                    ? 'border-blue-300 text-blue-700 hover:bg-blue-50 disabled:opacity-50'
                    : 'border-gray-200 text-gray-400 cursor-not-allowed opacity-50'
                  }`}
              >
                {folderDownloading ? (
                  <span className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                ) : '📦'}
                Tải thư mục
              </button>
            )}
          </div>

          {/* Asset grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {assetsLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredAssets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <span className="text-5xl mb-3">📂</span>
                <p className="text-sm">
                  {search ? 'Không tìm thấy tài liệu phù hợp' : 'Thư mục này chưa có tài liệu'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {filteredAssets.map(asset => (
                  <AssetCard
                    key={asset.id}
                    asset={asset}
                    onPreview={handlePreview}
                    onDownload={handleDownloadSingle}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Pagination */}
          {assetsMeta && assetsMeta.totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 py-3 border-t bg-white shrink-0">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1 text-sm border rounded-md hover:bg-gray-50 disabled:opacity-40"
              >
                ← Trước
              </button>
              <span className="text-sm text-gray-500">
                {page} / {assetsMeta.totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(assetsMeta.totalPages, p + 1))}
                disabled={page >= assetsMeta.totalPages}
                className="px-3 py-1 text-sm border rounded-md hover:bg-gray-50 disabled:opacity-40"
              >
                Tiếp →
              </button>
            </div>
          )}
        </main>
      </div>

      {/* ── Modals ── */}

      {previewAsset && (
        <PreviewModal
          asset={previewAsset}
          url={previewUrl}
          onClose={() => { setPreviewAsset(null); setPreviewUrl(null); }}
        />
      )}

      {showUpload && accessToken && selectedFolderId && (
        <UploadModal
          selectedFolderId={selectedFolderId}
          accessToken={accessToken}
          onClose={() => setShowUpload(false)}
          onSuccess={handleUploadSuccess}
        />
      )}

      {permissionModal && accessToken && (
        <PermissionModal
          targetCompanyId={permissionModal}
          currentAllowed={permission?.allowed ?? false}
          accessToken={accessToken}
          onClose={() => setPermissionModal(null)}
          onUpdate={(allow) => setPermission(prev => prev ? { ...prev, allowed: allow } : null)}
        />
      )}
    </div>
  );
}
