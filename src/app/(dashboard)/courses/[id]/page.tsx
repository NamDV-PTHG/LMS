'use client';

import { useAuth } from '@/components/providers/auth-provider';
import { useToast } from '@/components/ui/toast';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

interface Lesson {
  id: string;
  title: string;
  contentType: string;
  order: number;
}

interface Section {
  id: string;
  title: string;
  order: number;
  lessons: Lesson[];
}

interface Course {
  id: string;
  title: string;
  description: string | null;
  isPublished: boolean;
  level: string | null;
  estimatedHours: number | null;
  sections: Section[];
}

interface LearningGroup {
  id: string;
  name: string;
  type: string;
}

interface OrgUser {
  id: string;
  fullName: string;
  email: string;
}

interface Organization {
  id: string;
  name: string;
  type: string;
}

interface CoursePublication {
  id: string;
  targetCompany: { id: string; name: string; code: string };
  publisher: { id: string; fullName: string };
  isMandatory: boolean;
  deadline: string | null;
  publishedAt: string;
}

interface ReadinessData {
  isReady: boolean;
  sectionsCount: number;
  totalLessons: number;
  readyLessons: number;
  notReadyLessons: Array<{ id: string; title: string; contentType: string; reason: string }>;
  processingLessons: Array<{ id: string; title: string; contentType: string; reason: string }>;
}

const CONTENT_TYPE_ICON: Record<string, string> = {
  video: '▶',
  pdf: '📄',
  quiz: '✏',
  text: '📝',
  presentation: '📊',
  audio: '🎵',
};

const CONTENT_TYPE_LABEL: Record<string, string> = {
  video: 'Video',
  pdf: 'PDF',
  quiz: 'Quiz',
  text: 'Văn bản',
  presentation: 'Trình chiếu',
  audio: 'Audio',
};

const inputClass =
  'w-full border border-default rounded-lg px-3 py-2 text-[12px] text-content placeholder:text-faint focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors';

export default function CourseEditorPage() {
  const { accessToken, user } = useAuth();
  const { toast } = useToast();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const getRole = (r: unknown): string =>
    typeof r === 'string' ? r : (r as { role: string }).role;
  const userRoles = user?.roles?.map(getRole) ?? [];
  const isGroupAdmin = userRoles.includes('group_admin') || userRoles.includes('group_hrm');
  const isCompanyAdmin = userRoles.includes('company_admin') || userRoles.includes('hr_manager');

  const [activeTab, setActiveTab] = useState<'content' | 'assign' | 'share' | 'ratings'>('content');
  const [ratingsData, setRatingsData] = useState<{
    ratings: Array<{ id: string; rating: number; comment: string | null; createdAt: string; user: { fullName: string; employeeCode: string | null } }>;
    total: number; avg: number;
    dist: Array<{ star: number; count: number }>;
  } | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  // Content tab state
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [addingSection, setAddingSection] = useState(false);
  const [addingLessonFor, setAddingLessonFor] = useState<string | null>(null);
  const [newLessonTitle, setNewLessonTitle] = useState('');
  const [newLessonType, setNewLessonType] = useState('video');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Inline edit state — course title
  const [editingCourseTitle, setEditingCourseTitle] = useState(false);
  const [editCourseTitleValue, setEditCourseTitleValue] = useState('');
  const [savingCourseTitle, setSavingCourseTitle] = useState(false);

  // Inline edit state — section title
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editSectionValue, setEditSectionValue] = useState('');
  const [savingSection, setSavingSection] = useState(false);

  // Inline edit state — lesson title (track lessonId + parent sectionId)
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [editingLessonSectionId, setEditingLessonSectionId] = useState<string | null>(null);
  const [editLessonValue, setEditLessonValue] = useState('');
  const [savingLesson, setSavingLesson] = useState(false);

  // Share tab state
  interface ShareCompany { id: string; name: string; code: string; alreadyShared: boolean; }
  const [shareCompanies, setShareCompanies] = useState<ShareCompany[]>([]);
  const [publications, setPublications] = useState<CoursePublication[]>([]);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<Set<string>>(new Set());
  const [shareDeadline, setShareDeadline] = useState('');
  const [shareMandatory, setShareMandatory] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);

  // Readiness state
  const [readiness, setReadiness] = useState<ReadinessData | null>(null);

  // Quiz import state
  const [importingLessonId, setImportingLessonId] = useState<string | null>(null);
  const [quizImportFile, setQuizImportFile] = useState<File | null>(null);
  const [importingQuiz, setImportingQuiz] = useState(false);

  // Assign tab state
  const [groups, setGroups] = useState<LearningGroup[]>([]);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [allUsers, setAllUsers] = useState<OrgUser[]>([]);
  const [assignTarget, setAssignTarget] = useState<'group' | 'dept' | 'user'>('group');
  const [assignForm, setAssignForm] = useState({
    groupId: '',
    deptId: '',
    userId: '',
    deadline: '',
    isMandatory: false,
  });
  const [assigning, setAssigning] = useState(false);
  const [assignMsg, setAssignMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [assignHistory, setAssignHistory] = useState<Array<{
    id: string; targetType: string; targetLabel: string;
    assignedBy: { fullName: string }; isMandatory: boolean;
    deadline: string | null; assignedAt: string;
  }>>([]);

  const authHeader = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };

  const load = () => {
    fetch(`/api/courses/${id}`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setCourse(res.data);
          const allIds = new Set<string>((res.data.sections ?? []).map((s: Section) => s.id));
          setExpanded(allIds);
        } else setError(res.error ?? 'Lỗi tải khóa học');
      })
      .catch(() => setError('Không thể kết nối server'))
      .finally(() => setIsLoading(false));
  };

  const loadReadiness = () => {
    if (!accessToken || !id) return;
    fetch(`/api/courses/${id}/readiness`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.json())
      .then((res) => { if (res.success) setReadiness(res.data); })
      .catch(() => {});
  };

  const loadAssignData = () => {
    if (!accessToken) return;
    const h = { Authorization: `Bearer ${accessToken}` };
    fetch('/api/learning-groups?limit=100', { headers: h })
      .then((r) => r.json()).then((res) => { if (res.success) setGroups(res.data ?? []); })
      .catch(() => {});
    fetch('/api/organizations', { headers: h })
      .then((r) => r.json()).then((res) => {
        if (res.success) setOrgs((res.data ?? []).filter((o: Organization) => o.type !== 'group'));
      })
      .catch(() => {});
    fetch('/api/users?limit=500', { headers: h })
      .then((r) => r.json()).then((res) => { if (res.success) setAllUsers(res.data ?? []); })
      .catch(() => {});
    fetch(`/api/courses/${id}/assign`, { headers: h })
      .then((r) => r.json()).then((res) => { if (res.success) setAssignHistory(res.data ?? []); })
      .catch(() => {});
  };

  const loadShareData = () => {
    if (!accessToken || !id) return;
    const h = { Authorization: `Bearer ${accessToken}` };
    setShareLoading(true);
    Promise.all([
      fetch(`/api/courses/${id}/share-companies`, { headers: h }).then((r) => r.json()),
      fetch(`/api/courses/${id}/publications`, { headers: h }).then((r) => r.json()),
    ])
      .then(([companiesRes, pubsRes]) => {
        if (companiesRes.success) setShareCompanies(companiesRes.data ?? []);
        if (pubsRes.success) setPublications(pubsRes.data ?? []);
      })
      .catch(() => {})
      .finally(() => setShareLoading(false));
  };

  const handleShare = async () => {
    if (selectedCompanyIds.size === 0) { toast('error', 'Chọn ít nhất một công ty'); return; }
    setSharing(true);
    try {
      const res = await fetch(`/api/courses/${id}/publish`, {
        method: 'POST',
        headers: authHeader,
        body: JSON.stringify({
          targetCompanyIds: Array.from(selectedCompanyIds),
          isMandatory: shareMandatory,
          deadline: shareDeadline ? new Date(shareDeadline).toISOString() : undefined,
        }),
      }).then((r) => r.json());
      if (res.success) {
        toast('success', `Đã chia sẻ khóa học với ${selectedCompanyIds.size} công ty`);
        setSelectedCompanyIds(new Set());
        setShareDeadline('');
        setShareMandatory(false);
        loadShareData();
      } else {
        toast('error', res.error ?? 'Chia sẻ thất bại');
      }
    } catch { toast('error', 'Lỗi kết nối'); }
    finally { setSharing(false); }
  };

  const handleRevoke = async (publicationId: string) => {
    setRevoking(publicationId);
    try {
      const res = await fetch(`/api/courses/${id}/publications`, {
        method: 'DELETE',
        headers: authHeader,
        body: JSON.stringify({ publicationId }),
      }).then((r) => r.json());
      if (res.success) {
        toast('success', 'Đã thu hồi chia sẻ');
        loadShareData();
      } else {
        toast('error', res.error ?? 'Thu hồi thất bại');
      }
    } catch { toast('error', 'Lỗi kết nối'); }
    finally { setRevoking(null); }
  };

  const toggleCompanySelect = (companyId: string) => {
    setSelectedCompanyIds((prev) => {
      const next = new Set(prev);
      if (next.has(companyId)) next.delete(companyId); else next.add(companyId);
      return next;
    });
  };

  const loadRatings = () => {
    if (!accessToken || !id) return;
    fetch(`/api/courses/${id}/ratings`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.json())
      .then((res) => { if (res.success) setRatingsData(res.data); })
      .catch(() => {});
  };

  useEffect(() => { if (accessToken && id) { load(); loadReadiness(); } }, [accessToken, id]); // eslint-disable-line
  useEffect(() => { if (activeTab === 'assign') loadAssignData(); }, [activeTab, accessToken]); // eslint-disable-line
  useEffect(() => { if (activeTab === 'share' && (isGroupAdmin || isCompanyAdmin)) loadShareData(); }, [activeTab, accessToken, id]); // eslint-disable-line
  useEffect(() => { if (activeTab === 'ratings') loadRatings(); }, [activeTab, accessToken, id]); // eslint-disable-line

  // Thumbnail upload state
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);

  const handleThumbnailUpload = async (file: File) => {
    setUploadingThumbnail(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/courses/${id}/thumbnail`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: fd,
      }).then((r) => r.json());
      if (res.success) {
        toast('success', 'Đã cập nhật ảnh bìa khóa học');
        load();
      } else {
        toast('error', res.error ?? 'Upload thất bại');
      }
    } catch {
      toast('error', 'Lỗi kết nối');
    } finally {
      setUploadingThumbnail(false);
      if (thumbnailInputRef.current) thumbnailInputRef.current.value = '';
    }
  };

  const [confirmPublish, setConfirmPublish] = useState(false);

  const handlePublish = async () => {
    if (!confirmPublish) { setConfirmPublish(true); return; }
    setConfirmPublish(false);
    setPublishing(true);
    try {
      const res = await fetch(`/api/courses/${id}/publish`, { method: 'POST', headers: authHeader }).then((r) => r.json());
      if (res.success) { toast('success', 'Xuất bản khóa học thành công!'); load(); }
      else toast('error', res.error ?? 'Xuất bản thất bại');
    } catch { toast('error', 'Lỗi kết nối'); }
    finally { setPublishing(false); }
  };

  const [sectionError, setSectionError] = useState<string | null>(null);

  const handleAddSection = async () => {
    if (!newSectionTitle.trim()) return;
    setAddingSection(true);
    setSectionError(null);
    try {
      const res = await fetch(`/api/courses/${id}/sections`, {
        method: 'POST', headers: authHeader,
        body: JSON.stringify({ title: newSectionTitle }),
      }).then((r) => r.json());
      if (res.success) { setNewSectionTitle(''); load(); }
      else setSectionError(res.error ?? 'Thêm chương thất bại');
    } catch { setSectionError('Lỗi kết nối'); }
    finally { setAddingSection(false); }
  };

  const [lessonError, setLessonError] = useState<string | null>(null);

  const handleAddLesson = async (sectionId: string) => {
    if (!newLessonTitle.trim()) return;
    setLessonError(null);
    try {
      const res = await fetch(`/api/courses/${id}/sections/${sectionId}/lessons`, {
        method: 'POST', headers: authHeader,
        body: JSON.stringify({ title: newLessonTitle, contentType: newLessonType }),
      }).then((r) => r.json());
      if (res.success) { setAddingLessonFor(null); setNewLessonTitle(''); load(); }
      else setLessonError(res.error ?? 'Thêm bài học thất bại');
    } catch { setLessonError('Lỗi kết nối'); }
  };

  const toggleSection = (sId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(sId)) next.delete(sId); else next.add(sId);
      return next;
    });
  };

  // Inline edit handlers
  const handleSaveCourseTitle = async () => {
    if (!editCourseTitleValue.trim()) return;
    setSavingCourseTitle(true);
    try {
      const res = await fetch(`/api/courses/${id}`, {
        method: 'PATCH', headers: authHeader,
        body: JSON.stringify({ title: editCourseTitleValue.trim() }),
      }).then((r) => r.json());
      if (res.success) {
        toast('success', 'Đã cập nhật tiêu đề khóa học');
        setEditingCourseTitle(false);
        load();
      } else {
        toast('error', res.error ?? 'Cập nhật thất bại');
      }
    } catch { toast('error', 'Lỗi kết nối'); }
    finally { setSavingCourseTitle(false); }
  };

  const handleSaveSection = async () => {
    if (!editingSectionId || !editSectionValue.trim()) return;
    setSavingSection(true);
    try {
      const res = await fetch(`/api/courses/${id}/sections/${editingSectionId}`, {
        method: 'PATCH', headers: authHeader,
        body: JSON.stringify({ title: editSectionValue.trim() }),
      }).then((r) => r.json());
      if (res.success) {
        toast('success', 'Đã cập nhật tên chương');
        setEditingSectionId(null);
        load();
      } else {
        toast('error', res.error ?? 'Cập nhật thất bại');
      }
    } catch { toast('error', 'Lỗi kết nối'); }
    finally { setSavingSection(false); }
  };

  const handleSaveLesson = async () => {
    if (!editingLessonId || !editingLessonSectionId || !editLessonValue.trim()) return;
    setSavingLesson(true);
    try {
      const res = await fetch(`/api/courses/${id}/sections/${editingLessonSectionId}/lessons/${editingLessonId}`, {
        method: 'PATCH', headers: authHeader,
        body: JSON.stringify({ title: editLessonValue.trim() }),
      }).then((r) => r.json());
      if (res.success) {
        toast('success', 'Đã cập nhật tên bài học');
        setEditingLessonId(null);
        setEditingLessonSectionId(null);
        load();
      } else {
        toast('error', res.error ?? 'Cập nhật thất bại');
      }
    } catch { toast('error', 'Lỗi kết nối'); }
    finally { setSavingLesson(false); }
  };

  // Assign handlers
  const handleAssignToGroup = async () => {
    if (!assignForm.groupId) { setAssignMsg({ type: 'err', text: 'Chọn nhóm học tập' }); return; }
    setAssigning(true); setAssignMsg(null);
    try {
      const res = await fetch(`/api/learning-groups/${assignForm.groupId}/courses`, {
        method: 'POST', headers: authHeader,
        body: JSON.stringify({ courseId: id, deadline: assignForm.deadline || undefined }),
      }).then((r) => r.json());
      if (res.success) {
        setAssignMsg({ type: 'ok', text: 'Đã giao khóa học cho nhóm học tập!' });
        setAssignForm({ ...assignForm, groupId: '', deadline: '' });
      } else {
        setAssignMsg({ type: 'err', text: res.error ?? 'Lỗi giao khóa học' });
      }
    } catch { setAssignMsg({ type: 'err', text: 'Lỗi kết nối' }); }
    finally { setAssigning(false); }
  };

  const handleAssignToDept = async () => {
    setAssigning(true); setAssignMsg(null);
    try {
      const body: Record<string, unknown> = {
        isMandatory: assignForm.isMandatory,
        deadline: assignForm.deadline || undefined,
      };
      if (assignForm.deptId) body.targetDeptId = assignForm.deptId;
      const res = await fetch(`/api/courses/${id}/assign`, {
        method: 'POST', headers: authHeader,
        body: JSON.stringify(body),
      }).then((r) => r.json());
      if (res.success) {
        setAssignMsg({ type: 'ok', text: 'Đã giao khóa học cho phòng ban!' });
        setAssignForm({ ...assignForm, deptId: '', deadline: '' });
        loadAssignData();
      } else {
        setAssignMsg({ type: 'err', text: res.error ?? 'Lỗi giao khóa học' });
      }
    } catch { setAssignMsg({ type: 'err', text: 'Lỗi kết nối' }); }
    finally { setAssigning(false); }
  };

  const handleAssignToUser = async () => {
    if (!assignForm.userId) { setAssignMsg({ type: 'err', text: 'Chọn người dùng' }); return; }
    setAssigning(true); setAssignMsg(null);
    try {
      const res = await fetch(`/api/courses/${id}/assign`, {
        method: 'POST', headers: authHeader,
        body: JSON.stringify({
          targetUserId: assignForm.userId,
          isMandatory: assignForm.isMandatory,
          deadline: assignForm.deadline || undefined,
        }),
      }).then((r) => r.json());
      if (res.success) {
        setAssignMsg({ type: 'ok', text: 'Đã giao khóa học cho người dùng!' });
        setAssignForm({ ...assignForm, userId: '', deadline: '' });
        loadAssignData();
      } else {
        setAssignMsg({ type: 'err', text: res.error ?? 'Lỗi giao khóa học' });
      }
    } catch { setAssignMsg({ type: 'err', text: 'Lỗi kết nối' }); }
    finally { setAssigning(false); }
  };

  const handleAssign = () => {
    if (assignTarget === 'group') return handleAssignToGroup();
    if (assignTarget === 'dept') return handleAssignToDept();
    return handleAssignToUser();
  };

  // Render states
  if (isLoading) return (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (error) return (
    <div className="bg-danger-tint border border-danger/20 rounded-xl p-4 text-[12px] text-danger">{error}</div>
  );
  if (!course) return null;

  const sections = [...(course.sections ?? [])].sort((a, b) => a.order - b.order);

  const NEEDS_ASSET_TYPES = new Set(['video', 'document', 'pdf', 'audio', 'presentation', 'image']);
  const readinessNotReadyIds = new Set(readiness?.notReadyLessons.map((l) => l.id) ?? []);
  const readinessProcessingIds = new Set(readiness?.processingLessons.map((l) => l.id) ?? []);
  const readinessNotReadyReasons = new Map(readiness?.notReadyLessons.map((l) => [l.id, l.reason]) ?? []);

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <button
            onClick={() => router.push('/courses')}
            className="text-[12px] text-subtle hover:text-content mb-2 inline-flex items-center gap-1 transition-colors"
          >
            ← Danh sách khóa học
          </button>

          {/* Thumbnail + Course title row */}
          <div className="flex items-start gap-4 mt-1">
            {/* Thumbnail upload */}
            <div className="shrink-0">
              <input
                ref={thumbnailInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleThumbnailUpload(file);
                }}
              />
              <button
                onClick={() => thumbnailInputRef.current?.click()}
                disabled={uploadingThumbnail}
                title="Nhấn để thay đổi ảnh bìa"
                className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-dashed border-default hover:border-primary transition-colors group bg-gradient-to-br from-muted to-primary-tint flex items-center justify-center"
              >
                {(course as Course & { thumbnailUrl?: string }).thumbnailUrl ? (
                  <>
                    <img
                      src={(course as Course & { thumbnailUrl?: string }).thumbnailUrl}
                      alt={course.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-white text-[10px] font-medium">Đổi ảnh</span>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-1 text-primary/60 group-hover:text-primary transition-colors">
                    {uploadingThumbnail ? (
                      <span className="text-[10px] text-faint">Đang tải...</span>
                    ) : (
                      <>
                        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 3h18M3 3v18M3 3l4.5 4.5" />
                        </svg>
                        <span className="text-[10px] font-medium">Ảnh bìa</span>
                      </>
                    )}
                  </div>
                )}
              </button>
            </div>

            {/* Course title — inline edit */}
            <div className="flex-1 min-w-0">
              {editingCourseTitle ? (
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="text"
                    value={editCourseTitleValue}
                    onChange={(e) => setEditCourseTitleValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveCourseTitle(); if (e.key === 'Escape') setEditingCourseTitle(false); }}
                    autoFocus
                    className="flex-1 text-[18px] font-medium text-content border-b-2 border-primary focus:outline-none bg-transparent"
                  />
                  <button
                    onClick={handleSaveCourseTitle}
                    disabled={savingCourseTitle || !editCourseTitleValue.trim()}
                    className="px-3 py-1 text-[12px] bg-primary hover:bg-primary-dark text-white rounded-lg disabled:opacity-50 shrink-0 transition-colors"
                  >
                    {savingCourseTitle ? '...' : 'Lưu'}
                  </button>
                  <button
                    onClick={() => setEditingCourseTitle(false)}
                    className="px-3 py-1 text-[12px] border border-default rounded-lg hover:bg-muted shrink-0 transition-colors"
                  >
                    Hủy
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 group">
                  <h1 className="text-[18px] font-medium text-content truncate">{course.title}</h1>
                  <button
                    onClick={() => { setEditCourseTitleValue(course.title); setEditingCourseTitle(true); }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-faint hover:text-primary shrink-0"
                    title="Sửa tiêu đề"
                  >
                    ✎
                  </button>
                </div>
              )}

              <div className="flex items-center gap-2 mt-1">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                  course.isPublished ? 'bg-success-tint text-success' : 'bg-muted text-faint'
                }`}>
                  {course.isPublished && <span className="w-1.5 h-1.5 bg-success rounded-full" />}
                  {course.isPublished ? 'Đã xuất bản' : 'Bản nháp'}
                </span>
                {course.level && <span className="text-[11px] text-faint">{course.level}</span>}
                {course.estimatedHours != null && <span className="text-[11px] text-faint">{course.estimatedHours}h</span>}
              </div>
              {course.description && <p className="text-[12px] text-subtle mt-1">{course.description}</p>}
            </div>
          </div>
        </div>

        {!course.isPublished && (
          <div className="flex flex-col items-end gap-2 shrink-0">
            {readiness && !readiness.isReady && (
              <div className="text-[11px] bg-warning-tint border border-warning/20 text-warning rounded-lg px-3 py-2 max-w-xs text-right space-y-0.5">
                {readiness.processingLessons.length > 0 && (
                  <div>⏳ {readiness.processingLessons.length} bài đang xử lý</div>
                )}
                {readiness.notReadyLessons.length > 0 && (
                  <div>✗ {readiness.notReadyLessons.length} bài chưa có nội dung</div>
                )}
                {readiness.sectionsCount === 0 && <div>✗ Chưa có chương nào</div>}
                {readiness.totalLessons === 0 && readiness.sectionsCount > 0 && <div>✗ Chưa có bài học nào</div>}
              </div>
            )}
            {confirmPublish ? (
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-subtle">Xuất bản khóa học?</span>
                <button
                  onClick={handlePublish}
                  disabled={publishing}
                  className="px-3 py-1.5 bg-success hover:bg-success/90 text-white text-[12px] font-medium rounded-lg disabled:opacity-50 transition-colors"
                >
                  {publishing ? 'Đang xuất bản...' : 'Xác nhận'}
                </button>
                <button
                  onClick={() => setConfirmPublish(false)}
                  className="px-3 py-1.5 border border-default text-[12px] rounded-lg hover:bg-muted transition-colors"
                >
                  Hủy
                </button>
              </div>
            ) : (
              <button
                onClick={handlePublish}
                className="px-4 py-2 bg-success hover:bg-success/90 text-white text-[12px] font-medium rounded-lg transition-colors"
              >
                ✓ Xuất bản
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-default flex gap-1">
        {[
          { key: 'content', label: '📚 Nội dung bài giảng', show: true },
          { key: 'assign',  label: '📤 Phân phối & Giao học', show: true },
          { key: 'share',   label: '🔗 Chia sẻ với công ty', show: isGroupAdmin || isCompanyAdmin },
          { key: 'ratings', label: '⭐ Đánh giá', show: true },
        ].filter((t) => t.show).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={`px-4 py-2.5 text-[12px] font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-subtle hover:text-content'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Nội dung ── */}
      {activeTab === 'content' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[13px] font-medium text-content">Chương & Bài học ({sections.length} chương)</h2>
            {readiness && readiness.totalLessons > 0 && (
              <span className={`text-[10px] px-2.5 py-1 rounded-full font-medium ${
                readiness.isReady
                  ? 'bg-success-tint text-success'
                  : readiness.processingLessons.length > 0
                  ? 'bg-warning-tint text-warning'
                  : 'bg-danger-tint text-danger'
              }`}>
                {readiness.isReady
                  ? `✓ ${readiness.readyLessons}/${readiness.totalLessons} bài sẵn sàng`
                  : readiness.processingLessons.length > 0
                    ? `⏳ ${readiness.readyLessons}/${readiness.totalLessons} sẵn sàng · ${readiness.processingLessons.length} đang xử lý`
                    : `✗ ${readiness.readyLessons}/${readiness.totalLessons} bài sẵn sàng`
                }
              </span>
            )}
          </div>

          {sections.length === 0 && (
            <p className="text-[12px] text-faint py-6 text-center">Chưa có chương nào. Thêm chương đầu tiên bên dưới.</p>
          )}

          {sections.map((sec) => {
            const lessons = [...(sec.lessons ?? [])].sort((a, b) => a.order - b.order);
            const isOpen = expanded.has(sec.id);
            const isEditingThisSection = editingSectionId === sec.id;
            return (
              <div key={sec.id} className="bg-surface border border-default rounded-xl shadow-card overflow-hidden">
                {/* Section header */}
                <div className="flex items-center px-4 py-3 hover:bg-muted transition-colors">
                  {isEditingThisSection ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="text"
                        value={editSectionValue}
                        onChange={(e) => setEditSectionValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSaveSection(); if (e.key === 'Escape') setEditingSectionId(null); }}
                        autoFocus
                        className="flex-1 text-[12px] font-medium text-content border-b-2 border-primary focus:outline-none bg-transparent"
                      />
                      <button
                        onClick={handleSaveSection}
                        disabled={savingSection || !editSectionValue.trim()}
                        className="px-2 py-0.5 text-[11px] bg-primary hover:bg-primary-dark text-white rounded disabled:opacity-50 shrink-0 transition-colors"
                      >
                        {savingSection ? '...' : 'Lưu'}
                      </button>
                      <button
                        onClick={() => setEditingSectionId(null)}
                        className="px-2 py-0.5 text-[11px] border border-default rounded hover:bg-muted shrink-0 transition-colors"
                      >
                        Hủy
                      </button>
                    </div>
                  ) : (
                    <>
                      <button onClick={() => toggleSection(sec.id)} className="flex-1 flex items-center justify-between text-left">
                        <span className="font-medium text-content text-[12px]">{sec.title}</span>
                        <span className="text-faint text-[11px] ml-2 shrink-0">{lessons.length} bài · {isOpen ? '▲' : '▼'}</span>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditSectionValue(sec.title); setEditingSectionId(sec.id); }}
                        className="ml-3 text-faint hover:text-primary transition-colors shrink-0 text-[12px]"
                        title="Sửa tên chương"
                      >
                        ✎
                      </button>
                    </>
                  )}
                </div>

                {isOpen && (
                  <div className="border-t border-default">
                    {lessons.map((lesson) => {
                      const isEditingThisLesson = editingLessonId === lesson.id;
                      return (
                        <div key={lesson.id} className="flex items-center gap-3 px-5 py-2.5 border-b border-default last:border-b-0 hover:bg-muted group transition-colors">
                          <span className="text-[13px] w-6 text-center shrink-0">{CONTENT_TYPE_ICON[lesson.contentType] ?? '📄'}</span>

                          {isEditingThisLesson ? (
                            <div className="flex items-center gap-2 flex-1">
                              <input
                                type="text"
                                value={editLessonValue}
                                onChange={(e) => setEditLessonValue(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveLesson(); if (e.key === 'Escape') { setEditingLessonId(null); setEditingLessonSectionId(null); } }}
                                autoFocus
                                className="flex-1 text-[12px] text-content border-b-2 border-primary focus:outline-none bg-transparent"
                              />
                              <button
                                onClick={handleSaveLesson}
                                disabled={savingLesson || !editLessonValue.trim()}
                                className="px-2 py-0.5 text-[11px] bg-primary hover:bg-primary-dark text-white rounded disabled:opacity-50 shrink-0 transition-colors"
                              >
                                {savingLesson ? '...' : 'Lưu'}
                              </button>
                              <button
                                onClick={() => { setEditingLessonId(null); setEditingLessonSectionId(null); }}
                                className="px-2 py-0.5 text-[11px] border border-default rounded hover:bg-muted shrink-0 transition-colors"
                              >
                                Hủy
                              </button>
                            </div>
                          ) : (
                            <>
                              <span className="flex-1 text-[12px] text-subtle">{lesson.title}</span>
                              {readiness !== null && NEEDS_ASSET_TYPES.has(lesson.contentType) && (
                                <span
                                  title={
                                    readinessProcessingIds.has(lesson.id) ? 'Đang xử lý tài nguyên' :
                                    readinessNotReadyIds.has(lesson.id) ? (readinessNotReadyReasons.get(lesson.id) ?? 'Chưa sẵn sàng') :
                                    'Sẵn sàng'
                                  }
                                  className={`text-[11px] font-medium shrink-0 ${
                                    readinessProcessingIds.has(lesson.id) ? 'text-warning' :
                                    readinessNotReadyIds.has(lesson.id) ? 'text-danger' :
                                    'text-success'
                                  }`}
                                >
                                  {readinessProcessingIds.has(lesson.id) ? '⏳' :
                                   readinessNotReadyIds.has(lesson.id) ? '✗' : '✓'}
                                </span>
                              )}
                              <button
                                onClick={() => { setEditLessonValue(lesson.title); setEditingLessonId(lesson.id); setEditingLessonSectionId(sec.id); }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-faint hover:text-primary text-[12px] shrink-0"
                                title="Sửa tên bài học"
                              >
                                ✎
                              </button>
                            </>
                          )}

                          {!isEditingThisLesson && (
                            <>
                              <span className="text-[10px] px-2 py-0.5 rounded bg-muted text-faint shrink-0">
                                {CONTENT_TYPE_LABEL[lesson.contentType] ?? lesson.contentType}
                              </span>
                              {lesson.contentType === 'quiz' ? (
                                <>
                                  <button
                                    onClick={() => router.push(`/courses/${id}/lessons/${lesson.id}/quiz`)}
                                    className="text-[11px] text-primary hover:text-primary-dark px-2 py-0.5 rounded hover:bg-primary-tint shrink-0 transition-colors"
                                  >
                                    Soạn câu hỏi
                                  </button>
                                  <button
                                    onClick={() => { setImportingLessonId(lesson.id); setQuizImportFile(null); }}
                                    className="text-[11px] text-success px-2 py-0.5 rounded hover:bg-success-tint shrink-0 transition-colors"
                                  >
                                    Import CSV
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => router.push(`/courses/${id}/lessons/${lesson.id}/content`)}
                                  className="text-[11px] text-primary hover:text-primary-dark px-2 py-0.5 rounded hover:bg-primary-tint shrink-0 transition-colors"
                                >
                                  Upload nội dung
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}

                    {addingLessonFor === sec.id ? (
                      <div className="px-5 py-3 bg-primary-tint border-t border-default space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={newLessonTitle}
                            onChange={(e) => { setNewLessonTitle(e.target.value); setLessonError(null); }}
                            placeholder="Tên bài học"
                            autoFocus
                            className="flex-1 text-[12px] border border-default rounded-lg px-2 py-1.5 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 bg-surface"
                          />
                          <select
                            value={newLessonType}
                            onChange={(e) => setNewLessonType(e.target.value)}
                            className="text-[12px] border border-default rounded-lg px-2 py-1.5 focus:outline-none bg-surface"
                          >
                            <option value="video">▶ Video</option>
                            <option value="pdf">📄 PDF</option>
                            <option value="quiz">✏ Quiz</option>
                            <option value="text">📝 Văn bản</option>
                            <option value="presentation">📊 Trình chiếu</option>
                            <option value="audio">🎵 Audio</option>
                          </select>
                          <button
                            onClick={() => handleAddLesson(sec.id)}
                            className="px-3 py-1.5 bg-primary hover:bg-primary-dark text-white text-[11px] rounded-lg transition-colors"
                          >
                            Thêm
                          </button>
                          <button
                            onClick={() => { setAddingLessonFor(null); setNewLessonTitle(''); setLessonError(null); }}
                            className="px-3 py-1.5 border border-default text-[11px] rounded-lg hover:bg-surface transition-colors"
                          >
                            Hủy
                          </button>
                        </div>
                        {lessonError && <p className="text-[11px] text-danger">{lessonError}</p>}
                      </div>
                    ) : (
                      <div className="px-5 py-2 border-t border-default">
                        <button
                          onClick={() => { setAddingLessonFor(sec.id); setNewLessonTitle(''); }}
                          className="text-[11px] text-primary hover:text-primary-dark transition-colors"
                        >
                          + Thêm bài học
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Add section */}
          <div className="space-y-1 pt-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={newSectionTitle}
                onChange={(e) => { setNewSectionTitle(e.target.value); setSectionError(null); }}
                placeholder="Tên chương mới"
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddSection(); }}
                className={inputClass}
              />
              <button
                onClick={handleAddSection}
                disabled={addingSection || !newSectionTitle.trim()}
                className="px-4 py-2 bg-primary hover:bg-primary-dark text-white text-[12px] font-medium rounded-lg disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                {addingSection ? '...' : '+ Thêm chương'}
              </button>
            </div>
            {sectionError && <p className="text-[11px] text-danger px-1">{sectionError}</p>}
          </div>
        </div>
      )}

      {/* ── Tab: Phân phối ── */}
      {activeTab === 'assign' && (
        <div className="space-y-4">
          {!course.isPublished && (
            <div className="bg-warning-tint border border-warning/20 rounded-xl px-4 py-3 text-[12px] text-warning">
              ⚠ Khóa học chưa xuất bản. Hãy{' '}
              <button onClick={() => setActiveTab('content')} className="underline font-medium">
                xuất bản
              </button>{' '}
              trước khi giao cho học viên.
            </div>
          )}

          <div className="bg-surface border border-default rounded-xl shadow-card p-5 space-y-4">
            <h2 className="text-[13px] font-medium text-content">Giao khóa học cho</h2>

            {/* Target type tabs */}
            <div className="flex gap-2 flex-wrap">
              {[
                { key: 'group', label: '👥 Nhóm học tập', show: isGroupAdmin || isCompanyAdmin },
                { key: 'dept',  label: '🏢 Phòng ban',    show: isCompanyAdmin },
                { key: 'user',  label: '👤 Cá nhân',      show: isCompanyAdmin || isGroupAdmin },
              ].filter((t) => t.show).map((t) => (
                <button
                  key={t.key}
                  onClick={() => { setAssignTarget(t.key as typeof assignTarget); setAssignMsg(null); }}
                  className={`px-4 py-2 rounded-lg text-[12px] font-medium border transition-colors ${
                    assignTarget === t.key
                      ? 'bg-primary text-white border-primary'
                      : 'border-default text-subtle hover:bg-muted'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Group assign */}
            {assignTarget === 'group' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-[12px] font-medium text-content mb-1">
                    Nhóm học tập <span className="text-danger">*</span>
                  </label>
                  <select
                    value={assignForm.groupId}
                    onChange={(e) => setAssignForm({ ...assignForm, groupId: e.target.value })}
                    className={inputClass}
                  >
                    <option value="">— Chọn nhóm —</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>{g.name} ({g.type === 'rule_based' ? 'Tự động' : 'Thủ công'})</option>
                    ))}
                  </select>
                  {groups.length === 0 && (
                    <p className="text-[11px] text-faint mt-1">
                      Chưa có nhóm học tập.{' '}
                      <a href="/learning-groups" className="text-primary underline">Tạo nhóm</a>
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-content mb-1">Hạn hoàn thành</label>
                  <input
                    type="date"
                    value={assignForm.deadline}
                    onChange={(e) => setAssignForm({ ...assignForm, deadline: e.target.value })}
                    className="border border-default rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
            )}

            {/* Dept assign */}
            {assignTarget === 'dept' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-[12px] font-medium text-content mb-1">Phòng ban</label>
                  <select
                    value={assignForm.deptId}
                    onChange={(e) => setAssignForm({ ...assignForm, deptId: e.target.value })}
                    className={inputClass}
                  >
                    <option value="">— Toàn bộ công ty —</option>
                    {orgs.filter((o) => o.type === 'dept').map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-3">
                  <div>
                    <label className="block text-[12px] font-medium text-content mb-1">Hạn hoàn thành</label>
                    <input
                      type="date"
                      value={assignForm.deadline}
                      onChange={(e) => setAssignForm({ ...assignForm, deadline: e.target.value })}
                      className="border border-default rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <label className="flex items-center gap-2 mt-5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={assignForm.isMandatory}
                      onChange={(e) => setAssignForm({ ...assignForm, isMandatory: e.target.checked })}
                      className="w-4 h-4 rounded accent-primary"
                    />
                    <span className="text-[12px] text-content">Bắt buộc</span>
                  </label>
                </div>
              </div>
            )}

            {/* User assign */}
            {assignTarget === 'user' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-[12px] font-medium text-content mb-1">
                    Người dùng <span className="text-danger">*</span>
                  </label>
                  <select
                    value={assignForm.userId}
                    onChange={(e) => setAssignForm({ ...assignForm, userId: e.target.value })}
                    className={inputClass}
                  >
                    <option value="">— Chọn người dùng —</option>
                    {allUsers.map((u) => (
                      <option key={u.id} value={u.id}>{u.fullName} ({u.email})</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-3">
                  <div>
                    <label className="block text-[12px] font-medium text-content mb-1">Hạn hoàn thành</label>
                    <input
                      type="date"
                      value={assignForm.deadline}
                      onChange={(e) => setAssignForm({ ...assignForm, deadline: e.target.value })}
                      className="border border-default rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <label className="flex items-center gap-2 mt-5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={assignForm.isMandatory}
                      onChange={(e) => setAssignForm({ ...assignForm, isMandatory: e.target.checked })}
                      className="w-4 h-4 rounded accent-primary"
                    />
                    <span className="text-[12px] text-content">Bắt buộc</span>
                  </label>
                </div>
              </div>
            )}

            {assignMsg && (
              <div className={`rounded-lg px-4 py-3 text-[12px] border ${
                assignMsg.type === 'ok'
                  ? 'bg-success-tint text-success border-success/20'
                  : 'bg-danger-tint text-danger border-danger/20'
              }`}>
                {assignMsg.type === 'ok' ? '✓ ' : '✗ '}{assignMsg.text}
              </div>
            )}

            <button
              onClick={handleAssign}
              disabled={assigning || !course.isPublished}
              className="px-5 py-2 bg-primary hover:bg-primary-dark text-white text-[12px] font-medium rounded-lg disabled:opacity-50 transition-colors"
            >
              {assigning ? 'Đang giao...' : '📤 Giao khóa học'}
            </button>
          </div>

          {/* Assignment history */}
          {assignHistory.length > 0 && (
            <div className="bg-surface border border-default rounded-xl shadow-card overflow-hidden">
              <div className="px-5 py-3 border-b border-default">
                <h2 className="text-[13px] font-medium text-content">Lịch sử giao học ({assignHistory.length})</h2>
              </div>
              <div className="divide-y divide-default">
                {assignHistory.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 px-5 py-3">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${
                      a.targetType === 'user' ? 'bg-primary' : a.targetType === 'dept' ? 'bg-success' : 'bg-warning'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[12px] text-content font-medium truncate">{a.targetLabel}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          a.targetType === 'user' ? 'bg-primary-tint text-primary' :
                          a.targetType === 'dept' ? 'bg-success-tint text-success' :
                          'bg-warning-tint text-warning'
                        }`}>
                          {a.targetType === 'user' ? 'Cá nhân' : a.targetType === 'dept' ? 'Phòng ban' : 'Công ty'}
                        </span>
                        {a.isMandatory && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-danger-tint text-danger rounded font-medium">Bắt buộc</span>
                        )}
                      </div>
                      <div className="flex gap-3 mt-0.5 text-[11px] text-faint">
                        <span>Bởi {a.assignedBy.fullName}</span>
                        <span>{new Date(a.assignedAt).toLocaleDateString('vi-VN')}</span>
                        {a.deadline && <span>Hạn: {new Date(a.deadline).toLocaleDateString('vi-VN')}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Info card */}
          <div className="bg-muted rounded-xl border border-default p-4 text-[12px] text-subtle space-y-2">
            <p className="font-medium text-content">Luồng phân phối khóa học:</p>
            <ul className="space-y-1 text-[11px] list-disc pl-4">
              <li><strong>Nhóm học tập</strong> — Group Admin / Group HRM giao cho nhóm xuyên công ty (cơ chế learning_group)</li>
              <li><strong>Phòng ban</strong> — Company Admin / HR Manager giao cho toàn phòng ban hoặc công ty (cơ chế company_assign)</li>
              <li><strong>Cá nhân</strong> — Giao trực tiếp cho từng nhân viên, có thể đặt hạn và đánh dấu bắt buộc</li>
              <li>Học viên thấy khóa học trong <strong>Khóa học của tôi</strong> sau khi được giao</li>
            </ul>
          </div>
        </div>
      )}

      {/* ── Tab: Chia sẻ với công ty ── */}
      {activeTab === 'share' && (isGroupAdmin || isCompanyAdmin) && (
        <div className="space-y-4">
          {!course.isPublished && (
            <div className="bg-warning-tint border border-warning/20 rounded-xl px-4 py-3 text-[12px] text-warning">
              ⚠ Khóa học chưa được xuất bản. Hãy{' '}
              <button onClick={() => setActiveTab('content')} className="underline font-medium">
                xuất bản
              </button>{' '}
              trước khi chia sẻ để công ty khác thấy nội dung.
            </div>
          )}

          {/* Danh sách đang được chia sẻ */}
          {publications.length > 0 && (
            <div className="bg-surface border border-default rounded-xl shadow-card p-5 space-y-3">
              <h2 className="text-[13px] font-medium text-content">Đang chia sẻ với ({publications.length} công ty)</h2>
              <div className="divide-y divide-default">
                {publications.map((pub) => (
                  <div key={pub.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-[12px] font-medium text-content">{pub.targetCompany.name}</p>
                      <p className="text-[11px] text-faint mt-0.5">
                        Chia sẻ bởi {pub.publisher.fullName} · {new Date(pub.publishedAt).toLocaleDateString('vi-VN')}
                        {pub.isMandatory && (
                          <span className="ml-2 px-1.5 py-0.5 bg-danger-tint text-danger rounded text-[10px] font-medium">Bắt buộc</span>
                        )}
                        {pub.deadline && (
                          <span className="ml-2 text-faint">Hạn: {new Date(pub.deadline).toLocaleDateString('vi-VN')}</span>
                        )}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRevoke(pub.id)}
                      disabled={revoking === pub.id}
                      className="text-[11px] text-danger hover:text-danger px-3 py-1.5 rounded-lg hover:bg-danger-tint transition-colors disabled:opacity-50"
                    >
                      {revoking === pub.id ? '...' : 'Thu hồi'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Chia sẻ với công ty mới */}
          <div className="bg-surface border border-default rounded-xl shadow-card p-5 space-y-4">
            <h2 className="text-[13px] font-medium text-content">Chia sẻ khóa học</h2>

            {shareLoading ? (
              <p className="text-[12px] text-faint py-4 text-center">Đang tải danh sách công ty...</p>
            ) : shareCompanies.length === 0 ? (
              <p className="text-[12px] text-faint py-4 text-center border border-default rounded-lg">
                Không có công ty nào trong hệ thống để chia sẻ
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <label className="text-[12px] font-medium text-content">
                    Chọn công ty nhận <span className="text-danger">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const canSelect = shareCompanies.filter((c) => !c.alreadyShared);
                      const allSelected = canSelect.every((c) => selectedCompanyIds.has(c.id));
                      if (allSelected) {
                        setSelectedCompanyIds(new Set());
                      } else {
                        setSelectedCompanyIds(new Set(canSelect.map((c) => c.id)));
                      }
                    }}
                    className="text-[11px] text-primary hover:text-primary-dark font-medium transition-colors"
                  >
                    {shareCompanies.filter((c) => !c.alreadyShared).every((c) => selectedCompanyIds.has(c.id)) && shareCompanies.some((c) => !c.alreadyShared)
                      ? 'Bỏ chọn tất cả'
                      : `Chọn tất cả (${shareCompanies.filter((c) => !c.alreadyShared).length} chưa chia sẻ)`}
                  </button>
                </div>

                <div className="border border-default rounded-lg divide-y divide-default max-h-72 overflow-y-auto">
                  {shareCompanies.map((company) => (
                    <label
                      key={company.id}
                      className={`flex items-center gap-3 px-4 py-3 select-none transition-colors ${
                        company.alreadyShared
                          ? 'bg-muted cursor-default'
                          : 'hover:bg-primary-tint cursor-pointer'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={company.alreadyShared || selectedCompanyIds.has(company.id)}
                        disabled={company.alreadyShared}
                        onChange={() => !company.alreadyShared && toggleCompanySelect(company.id)}
                        className="w-4 h-4 rounded accent-primary flex-shrink-0"
                      />
                      <span className={`text-[12px] flex-1 ${company.alreadyShared ? 'text-faint' : 'text-content'}`}>
                        {company.name}
                      </span>
                      <span className="text-[11px] text-faint flex-shrink-0">{company.code}</span>
                      {company.alreadyShared && (
                        <span className="text-[10px] bg-success-tint text-success px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                          Đã chia sẻ
                        </span>
                      )}
                    </label>
                  ))}
                </div>

                {selectedCompanyIds.size > 0 && (
                  <p className="text-[11px] text-primary font-medium">
                    Đã chọn {selectedCompanyIds.size} công ty
                  </p>
                )}

                <div className="flex items-end gap-4 flex-wrap">
                  <div>
                    <label className="block text-[12px] font-medium text-content mb-1">Hạn hoàn thành (tùy chọn)</label>
                    <input
                      type="date"
                      value={shareDeadline}
                      onChange={(e) => setShareDeadline(e.target.value)}
                      className="border border-default rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <label className="flex items-center gap-2 mb-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={shareMandatory}
                      onChange={(e) => setShareMandatory(e.target.checked)}
                      className="w-4 h-4 rounded accent-primary"
                    />
                    <span className="text-[12px] text-content">Bắt buộc học</span>
                  </label>
                </div>

                <button
                  onClick={handleShare}
                  disabled={sharing || selectedCompanyIds.size === 0 || !course.isPublished}
                  className="px-5 py-2 bg-primary hover:bg-primary-dark text-white text-[12px] font-medium rounded-lg disabled:opacity-50 transition-colors"
                >
                  {sharing ? 'Đang chia sẻ...' : `🔗 Chia sẻ với ${selectedCompanyIds.size > 0 ? selectedCompanyIds.size + ' công ty đã chọn' : 'công ty đã chọn'}`}
                </button>
              </>
            )}
          </div>

          {/* Info */}
          <div className="bg-primary-tint border border-primary/15 rounded-xl p-4 text-[12px] space-y-1">
            <p className="font-medium text-primary">Lưu ý:</p>
            <ul className="text-[11px] text-primary/80 list-disc pl-4 space-y-1">
              <li>Sau khi chia sẻ, khóa học xuất hiện trong danh sách của Admin/HR công ty nhận</li>
              <li>Admin/HR gán khóa học cho nhân viên, phòng ban theo quy trình bình thường</li>
              <li>Video, tài liệu <strong>vẫn ở công ty gốc</strong> — không sao chép dữ liệu</li>
              <li>Thu hồi chia sẻ: khóa học ẩn khỏi danh sách, tiến độ học nhân viên không mất</li>
            </ul>
          </div>
        </div>
      )}

      {/* ── Tab: Đánh giá ── */}
      {activeTab === 'ratings' && (
        <div className="space-y-4">
          {!ratingsData ? (
            <div className="flex justify-center py-10">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : ratingsData.total === 0 ? (
            <div className="bg-surface border border-default rounded-xl shadow-card py-12 text-center text-[12px] text-faint">
              Chưa có đánh giá nào cho khóa học này
            </div>
          ) : (
            <>
              {/* Aggregate */}
              <div className="bg-surface border border-default rounded-xl shadow-card p-5">
                <div className="flex items-center gap-6 flex-wrap">
                  <div className="text-center">
                    <div className="text-[36px] font-medium text-content">{ratingsData.avg}</div>
                    <div className="text-[12px] text-yellow-400">{'★'.repeat(Math.round(ratingsData.avg))}{'☆'.repeat(5 - Math.round(ratingsData.avg))}</div>
                    <div className="text-[11px] text-faint mt-1">{ratingsData.total} đánh giá</div>
                  </div>
                  <div className="flex-1 min-w-[180px] space-y-1">
                    {[5, 4, 3, 2, 1].map((star) => {
                      const item = ratingsData.dist.find((d) => d.star === star)!;
                      const pct = ratingsData.total > 0 ? (item.count / ratingsData.total) * 100 : 0;
                      return (
                        <div key={star} className="flex items-center gap-2">
                          <span className="text-[11px] text-faint w-4 text-right">{star}</span>
                          <span className="text-yellow-400 text-[11px]">★</span>
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[11px] text-faint w-5">{item.count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Individual ratings */}
              <div className="bg-surface border border-default rounded-xl shadow-card overflow-hidden">
                <div className="px-5 py-3 border-b border-default">
                  <h2 className="text-[13px] font-medium text-content">Chi tiết đánh giá ({ratingsData.total})</h2>
                </div>
                <div className="divide-y divide-default">
                  {ratingsData.ratings.map((r) => (
                    <div key={r.id} className="px-5 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] font-medium text-content">{r.user.fullName}</span>
                            {r.user.employeeCode && (
                              <span className="text-[10px] text-faint">({r.user.employeeCode})</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 mt-0.5">
                            {[1,2,3,4,5].map((s) => (
                              <span key={s} className={`text-[13px] ${s <= r.rating ? 'text-yellow-400' : 'text-muted'}`}>★</span>
                            ))}
                            <span className="text-[11px] text-faint ml-1">{r.rating}/5</span>
                          </div>
                          {r.comment && (
                            <p className="text-[12px] text-subtle mt-1.5 leading-relaxed">{r.comment}</p>
                          )}
                        </div>
                        <span className="text-[11px] text-faint shrink-0">
                          {new Date(r.createdAt).toLocaleDateString('vi-VN')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Quiz Import Modal */}
      {importingLessonId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md bg-surface rounded-xl shadow-card border border-default">
            <div className="px-5 py-4 border-b border-default flex items-center justify-between">
              <h2 className="text-[14px] font-medium text-content">Import câu hỏi từ CSV</h2>
              <button
                onClick={() => setImportingLessonId(null)}
                className="text-faint hover:text-content text-xl leading-none transition-colors"
              >
                ×
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-[12px] text-subtle">
                Tải file mẫu, điền câu hỏi theo format, rồi import vào hệ thống.
              </p>
              <button
                type="button"
                onClick={async () => {
                  const res = await fetch(`/api/lessons/${importingLessonId}/quiz-import`, {
                    headers: { Authorization: `Bearer ${accessToken}` },
                  });
                  if (!res.ok) { toast('error', 'Không tải được file mẫu'); return; }
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url; a.download = 'quiz_import_template.csv'; a.click();
                  URL.revokeObjectURL(url);
                }}
                className="inline-flex items-center gap-2 text-[12px] text-primary hover:text-primary-dark font-medium transition-colors"
              >
                ↓ Tải file mẫu CSV
              </button>
              <div>
                <label className="block text-[12px] font-medium text-content mb-1">Chọn file CSV đã điền</label>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => setQuizImportFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-[12px] text-subtle file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-default file:text-[11px] file:bg-muted hover:file:bg-primary-tint file:text-subtle"
                />
              </div>
              <div className="bg-primary-tint border border-primary/15 rounded-lg px-3 py-2 text-[11px] text-primary space-y-1">
                <p className="font-medium">Cột trong file CSV:</p>
                <p>question, type, option_a…d, correct_answer, difficulty, explanation, points</p>
                <p>type: <code>single_choice</code> | <code>true_false</code> | <code>fill_blank</code></p>
                <p>correct_answer: A/B/C/D (single_choice), true/false (true_false), text (fill_blank)</p>
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setImportingLessonId(null)}
                  className="flex-1 rounded-lg border border-default px-4 py-2 text-[12px] font-medium text-subtle hover:bg-muted transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={!quizImportFile || importingQuiz}
                  onClick={async () => {
                    if (!quizImportFile) return;
                    setImportingQuiz(true);
                    const fd = new FormData();
                    fd.append('file', quizImportFile);
                    try {
                      const res = await fetch(`/api/lessons/${importingLessonId}/quiz-import`, {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${accessToken}` },
                        body: fd,
                      }).then((r) => r.json());
                      if (res.success) {
                        toast('success', `Import thành công ${res.data.imported} câu hỏi`);
                        setImportingLessonId(null);
                      } else {
                        toast('error', res.error ?? 'Import thất bại');
                      }
                    } catch {
                      toast('error', 'Lỗi kết nối server');
                    } finally {
                      setImportingQuiz(false);
                    }
                  }}
                  className="flex-1 rounded-lg bg-success hover:bg-success/90 px-4 py-2 text-[12px] font-medium text-white disabled:opacity-50 transition-colors"
                >
                  {importingQuiz ? 'Đang import...' : 'Import'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
