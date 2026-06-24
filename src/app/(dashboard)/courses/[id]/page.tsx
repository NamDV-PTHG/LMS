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

  const [activeTab, setActiveTab] = useState<'content' | 'assign'>('content');
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

  const loadAssignData = () => {
    if (!accessToken) return;
    const h = { Authorization: `Bearer ${accessToken}` };
    // Load learning groups (for group_admin/group_hrm)
    fetch('/api/learning-groups?limit=100', { headers: h })
      .then((r) => r.json()).then((res) => { if (res.success) setGroups(res.data ?? []); })
      .catch(() => {});
    // Load orgs for dept assignment
    fetch('/api/organizations', { headers: h })
      .then((r) => r.json()).then((res) => {
        if (res.success) setOrgs((res.data ?? []).filter((o: Organization) => o.type !== 'group'));
      })
      .catch(() => {});
    // Load users
    fetch('/api/users?limit=500', { headers: h })
      .then((r) => r.json()).then((res) => { if (res.success) setAllUsers(res.data ?? []); })
      .catch(() => {});
  };

  useEffect(() => { if (accessToken && id) load(); }, [accessToken, id]); // eslint-disable-line
  useEffect(() => { if (activeTab === 'assign') loadAssignData(); }, [activeTab, accessToken]); // eslint-disable-line

  // ── Content tab handlers ──────────────────────────────────────

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

  // ── Inline edit handlers ──────────────────────────────────────

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

  // ── Assign tab handlers ───────────────────────────────────────

  const handleAssignToGroup = async () => {
    if (!assignForm.groupId) { setAssignMsg({ type: 'err', text: 'Chọn nhóm học tập' }); return; }
    setAssigning(true); setAssignMsg(null);
    try {
      const res = await fetch(`/api/learning-groups/${assignForm.groupId}/courses`, {
        method: 'POST', headers: authHeader,
        body: JSON.stringify({
          courseId: id,
          deadline: assignForm.deadline || undefined,
        }),
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

  // ── Render ────────────────────────────────────────────────────

  if (isLoading) return <div className="p-8 text-center text-gray-400">Đang tải...</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;
  if (!course) return null;

  const sections = [...(course.sections ?? [])].sort((a, b) => a.order - b.order);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <button onClick={() => router.push('/courses')} className="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-flex items-center gap-1">
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
                className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-dashed border-gray-300 hover:border-blue-400 transition-colors group bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center"
              >
                {course.thumbnailUrl ? (
                  <>
                    <img
                      src={course.thumbnailUrl}
                      alt={course.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-white text-xs font-medium">Đổi ảnh</span>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-1 text-blue-400 group-hover:text-blue-600">
                    {uploadingThumbnail ? (
                      <span className="text-xs text-gray-400">Đang tải...</span>
                    ) : (
                      <>
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
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
                className="flex-1 text-2xl font-bold text-gray-900 border-b-2 border-blue-500 focus:outline-none bg-transparent"
              />
              <button
                onClick={handleSaveCourseTitle}
                disabled={savingCourseTitle || !editCourseTitleValue.trim()}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 shrink-0"
              >
                {savingCourseTitle ? '...' : 'Lưu'}
              </button>
              <button
                onClick={() => setEditingCourseTitle(false)}
                className="px-3 py-1 text-sm border rounded-lg hover:bg-gray-50 shrink-0"
              >
                Hủy
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 group">
              <h1 className="text-2xl font-bold text-gray-900 truncate">{course.title}</h1>
              <button
                onClick={() => { setEditCourseTitleValue(course.title); setEditingCourseTitle(true); }}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-blue-600 shrink-0"
                title="Sửa tiêu đề"
              >
                ✎
              </button>
            </div>
          )}

          <div className="flex items-center gap-3 mt-1">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${course.isPublished ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
              {course.isPublished ? 'Đã xuất bản' : 'Bản nháp'}
            </span>
            {course.level && <span className="text-xs text-gray-400">{course.level}</span>}
            {course.estimatedHours != null && <span className="text-xs text-gray-400">{course.estimatedHours}h</span>}
          </div>
          {course.description && <p className="text-sm text-gray-500 mt-1">{course.description}</p>}
            </div>{/* end title inner */}
          </div>{/* end thumbnail+title row */}
        </div>
        {!course.isPublished && (
          confirmPublish ? (
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-sm text-gray-600">Xuất bản khóa học?</span>
              <button onClick={handlePublish} disabled={publishing}
                className="px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50">
                {publishing ? 'Đang xuất bản...' : 'Xác nhận'}
              </button>
              <button onClick={() => setConfirmPublish(false)}
                className="px-3 py-1.5 border text-sm rounded-lg hover:bg-gray-50">
                Hủy
              </button>
            </div>
          ) : (
            <button onClick={handlePublish}
              className="shrink-0 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700">
              ✓ Xuất bản
            </button>
          )
        )}
      </div>

      {/* Tabs */}
      <div className="border-b flex gap-1">
        {(['content', 'assign'] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {tab === 'content' ? '📚 Nội dung bài giảng' : '📤 Phân phối & Giao học'}
          </button>
        ))}
      </div>

      {/* ── Tab: Nội dung ── */}
      {activeTab === 'content' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-800">Chương & Bài học ({sections.length} chương)</h2>
          </div>

          {sections.length === 0 && (
            <p className="text-sm text-gray-400 py-4 text-center">Chưa có chương nào. Thêm chương đầu tiên bên dưới.</p>
          )}

          {sections.map((sec) => {
            const lessons = [...(sec.lessons ?? [])].sort((a, b) => a.order - b.order);
            const isOpen = expanded.has(sec.id);
            const isEditingThisSection = editingSectionId === sec.id;
            return (
              <div key={sec.id} className="bg-white rounded-xl border overflow-hidden">
                {/* Section header */}
                <div className="flex items-center px-4 py-3 hover:bg-gray-50 transition-colors">
                  {isEditingThisSection ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="text"
                        value={editSectionValue}
                        onChange={(e) => setEditSectionValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSaveSection(); if (e.key === 'Escape') setEditingSectionId(null); }}
                        autoFocus
                        className="flex-1 text-sm font-medium text-gray-800 border-b-2 border-blue-500 focus:outline-none bg-transparent"
                      />
                      <button
                        onClick={handleSaveSection}
                        disabled={savingSection || !editSectionValue.trim()}
                        className="px-2 py-0.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 shrink-0"
                      >
                        {savingSection ? '...' : 'Lưu'}
                      </button>
                      <button
                        onClick={() => setEditingSectionId(null)}
                        className="px-2 py-0.5 text-xs border rounded hover:bg-gray-100 shrink-0"
                      >
                        Hủy
                      </button>
                    </div>
                  ) : (
                    <>
                      <button onClick={() => toggleSection(sec.id)} className="flex-1 flex items-center justify-between text-left">
                        <span className="font-medium text-gray-800 text-sm">{sec.title}</span>
                        <span className="text-gray-400 text-xs ml-2 shrink-0">{lessons.length} bài · {isOpen ? '▲' : '▼'}</span>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditSectionValue(sec.title); setEditingSectionId(sec.id); }}
                        className="ml-3 text-gray-300 hover:text-blue-600 transition-colors shrink-0 text-sm"
                        title="Sửa tên chương"
                      >
                        ✎
                      </button>
                    </>
                  )}
                </div>

                {isOpen && (
                  <div className="border-t">
                    {lessons.map((lesson) => {
                      const isEditingThisLesson = editingLessonId === lesson.id;
                      return (
                        <div key={lesson.id} className="flex items-center gap-3 px-5 py-2.5 border-b last:border-b-0 hover:bg-gray-50 group">
                          <span className="text-base w-6 text-center shrink-0">{CONTENT_TYPE_ICON[lesson.contentType] ?? '📄'}</span>

                          {isEditingThisLesson ? (
                            <div className="flex items-center gap-2 flex-1">
                              <input
                                type="text"
                                value={editLessonValue}
                                onChange={(e) => setEditLessonValue(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveLesson(); if (e.key === 'Escape') { setEditingLessonId(null); setEditingLessonSectionId(null); } }}
                                autoFocus
                                className="flex-1 text-sm text-gray-700 border-b-2 border-blue-500 focus:outline-none bg-transparent"
                              />
                              <button
                                onClick={handleSaveLesson}
                                disabled={savingLesson || !editLessonValue.trim()}
                                className="px-2 py-0.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 shrink-0"
                              >
                                {savingLesson ? '...' : 'Lưu'}
                              </button>
                              <button
                                onClick={() => { setEditingLessonId(null); setEditingLessonSectionId(null); }}
                                className="px-2 py-0.5 text-xs border rounded hover:bg-gray-100 shrink-0"
                              >
                                Hủy
                              </button>
                            </div>
                          ) : (
                            <>
                              <span className="flex-1 text-sm text-gray-700">{lesson.title}</span>
                              <button
                                onClick={() => { setEditLessonValue(lesson.title); setEditingLessonId(lesson.id); setEditingLessonSectionId(sec.id); }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-blue-600 text-sm shrink-0"
                                title="Sửa tên bài học"
                              >
                                ✎
                              </button>
                            </>
                          )}

                          {!isEditingThisLesson && (
                            <>
                              <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-500 shrink-0">
                                {CONTENT_TYPE_LABEL[lesson.contentType] ?? lesson.contentType}
                              </span>
                              {lesson.contentType === 'quiz' ? (
                                <>
                                  <button onClick={() => router.push(`/courses/${id}/lessons/${lesson.id}/quiz`)}
                                    className="text-xs text-purple-600 hover:text-purple-800 px-2 py-0.5 rounded hover:bg-purple-50 shrink-0">
                                    Soạn câu hỏi
                                  </button>
                                  <button
                                    onClick={() => { setImportingLessonId(lesson.id); setQuizImportFile(null); }}
                                    className="text-xs text-green-600 hover:text-green-800 px-2 py-0.5 rounded hover:bg-green-50 shrink-0"
                                  >
                                    Import CSV
                                  </button>
                                </>
                              ) : (
                                <button onClick={() => router.push(`/courses/${id}/lessons/${lesson.id}/content`)}
                                  className="text-xs text-blue-600 hover:text-blue-800 px-2 py-0.5 rounded hover:bg-blue-50 shrink-0">
                                  Upload nội dung
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}

                    {addingLessonFor === sec.id ? (
                      <div className="px-5 py-3 bg-blue-50 border-t space-y-2">
                        <div className="flex items-center gap-2">
                          <input type="text" value={newLessonTitle}
                            onChange={(e) => { setNewLessonTitle(e.target.value); setLessonError(null); }}
                            placeholder="Tên bài học" autoFocus
                            className="flex-1 text-sm border rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400" />
                          <select value={newLessonType} onChange={(e) => setNewLessonType(e.target.value)}
                            className="text-sm border rounded px-2 py-1.5 focus:outline-none">
                            <option value="video">▶ Video</option>
                            <option value="pdf">📄 PDF</option>
                            <option value="quiz">✏ Quiz</option>
                            <option value="text">📝 Văn bản</option>
                            <option value="presentation">📊 Trình chiếu</option>
                            <option value="audio">🎵 Audio</option>
                          </select>
                          <button onClick={() => handleAddLesson(sec.id)}
                            className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">Thêm</button>
                          <button onClick={() => { setAddingLessonFor(null); setNewLessonTitle(''); setLessonError(null); }}
                            className="px-3 py-1.5 border text-xs rounded hover:bg-gray-100">Hủy</button>
                        </div>
                        {lessonError && <p className="text-xs text-red-600">{lessonError}</p>}
                      </div>
                    ) : (
                      <div className="px-5 py-2 border-t">
                        <button onClick={() => { setAddingLessonFor(sec.id); setNewLessonTitle(''); }}
                          className="text-xs text-blue-600 hover:text-blue-800">
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
              <input type="text" value={newSectionTitle}
                onChange={(e) => { setNewSectionTitle(e.target.value); setSectionError(null); }}
                placeholder="Tên chương mới"
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddSection(); }}
                className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button onClick={handleAddSection} disabled={addingSection || !newSectionTitle.trim()}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {addingSection ? '...' : '+ Thêm chương'}
              </button>
            </div>
            {sectionError && (
              <p className="text-xs text-red-600 px-1">{sectionError}</p>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Phân phối ── */}
      {activeTab === 'assign' && (
        <div className="space-y-6">
          {!course.isPublished && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
              ⚠ Khóa học chưa xuất bản. Hãy <button onClick={() => setActiveTab('content')} className="underline font-medium">xuất bản</button> trước khi giao cho học viên.
            </div>
          )}

          <div className="bg-white rounded-xl border p-6 space-y-5">
            <h2 className="font-semibold text-gray-800">Giao khóa học cho</h2>

            {/* Target type tabs */}
            <div className="flex gap-2 flex-wrap">
              {[
                { key: 'group', label: '👥 Nhóm học tập', show: isGroupAdmin || isCompanyAdmin },
                { key: 'dept',  label: '🏢 Phòng ban',    show: isCompanyAdmin },
                { key: 'user',  label: '👤 Cá nhân',      show: isCompanyAdmin || isGroupAdmin },
              ].filter((t) => t.show).map((t) => (
                <button key={t.key} onClick={() => { setAssignTarget(t.key as typeof assignTarget); setAssignMsg(null); }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    assignTarget === t.key ? 'bg-blue-600 text-white border-blue-600' : 'text-gray-600 hover:bg-gray-50'
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Group assign */}
            {assignTarget === 'group' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nhóm học tập <span className="text-red-500">*</span></label>
                  <select value={assignForm.groupId} onChange={(e) => setAssignForm({ ...assignForm, groupId: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">— Chọn nhóm —</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>{g.name} ({g.type === 'rule_based' ? 'Tự động' : 'Thủ công'})</option>
                    ))}
                  </select>
                  {groups.length === 0 && (
                    <p className="text-xs text-gray-400 mt-1">Chưa có nhóm học tập. <a href="/learning-groups" className="text-blue-600 underline">Tạo nhóm</a></p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hạn hoàn thành</label>
                  <input type="date" value={assignForm.deadline} onChange={(e) => setAssignForm({ ...assignForm, deadline: e.target.value })}
                    className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            )}

            {/* Dept assign */}
            {assignTarget === 'dept' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phòng ban</label>
                  <select value={assignForm.deptId} onChange={(e) => setAssignForm({ ...assignForm, deptId: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">— Toàn bộ công ty —</option>
                    {orgs.filter((o) => o.type === 'dept').map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hạn hoàn thành</label>
                    <input type="date" value={assignForm.deadline} onChange={(e) => setAssignForm({ ...assignForm, deadline: e.target.value })}
                      className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <label className="flex items-center gap-2 mt-5 cursor-pointer select-none">
                    <input type="checkbox" checked={assignForm.isMandatory} onChange={(e) => setAssignForm({ ...assignForm, isMandatory: e.target.checked })}
                      className="w-4 h-4 rounded accent-blue-600" />
                    <span className="text-sm text-gray-700">Bắt buộc</span>
                  </label>
                </div>
              </div>
            )}

            {/* User assign */}
            {assignTarget === 'user' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Người dùng <span className="text-red-500">*</span></label>
                  <select value={assignForm.userId} onChange={(e) => setAssignForm({ ...assignForm, userId: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">— Chọn người dùng —</option>
                    {allUsers.map((u) => (
                      <option key={u.id} value={u.id}>{u.fullName} ({u.email})</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hạn hoàn thành</label>
                    <input type="date" value={assignForm.deadline} onChange={(e) => setAssignForm({ ...assignForm, deadline: e.target.value })}
                      className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <label className="flex items-center gap-2 mt-5 cursor-pointer select-none">
                    <input type="checkbox" checked={assignForm.isMandatory} onChange={(e) => setAssignForm({ ...assignForm, isMandatory: e.target.checked })}
                      className="w-4 h-4 rounded accent-blue-600" />
                    <span className="text-sm text-gray-700">Bắt buộc</span>
                  </label>
                </div>
              </div>
            )}

            {assignMsg && (
              <div className={`rounded-lg px-4 py-3 text-sm ${assignMsg.type === 'ok' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {assignMsg.type === 'ok' ? '✓ ' : '✗ '}{assignMsg.text}
              </div>
            )}

            <button onClick={handleAssign} disabled={assigning || !course.isPublished}
              className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {assigning ? 'Đang giao...' : '📤 Giao khóa học'}
            </button>
          </div>

          {/* Info card */}
          <div className="bg-gray-50 rounded-xl border p-4 text-sm text-gray-600 space-y-2">
            <p className="font-medium text-gray-800">Luồng phân phối khóa học:</p>
            <ul className="space-y-1 text-xs list-disc pl-4">
              <li><strong>Nhóm học tập</strong> — Group Admin / Group HRM giao cho nhóm xuyên công ty (cơ chế learning_group)</li>
              <li><strong>Phòng ban</strong> — Company Admin / HR Manager giao cho toàn phòng ban hoặc công ty (cơ chế company_assign)</li>
              <li><strong>Cá nhân</strong> — Giao trực tiếp cho từng nhân viên, có thể đặt hạn và đánh dấu bắt buộc</li>
              <li>Học viên thấy khóa học trong <strong>Khóa học của tôi</strong> sau khi được giao</li>
            </ul>
          </div>
        </div>
      )}

      {/* Quiz Import Modal */}
      {importingLessonId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl">
            <div className="px-6 py-5 border-b flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Import câu hỏi từ CSV</h2>
              <button onClick={() => setImportingLessonId(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
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
                className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                ↓ Tải file mẫu CSV
              </button>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Chọn file CSV đã điền</label>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => setQuizImportFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border file:border-gray-300 file:text-sm file:bg-gray-50 hover:file:bg-gray-100"
                />
              </div>
              <div className="bg-blue-50 rounded-lg px-3 py-2 text-xs text-blue-700 space-y-1">
                <p className="font-medium">Cột trong file CSV:</p>
                <p>question, type, option_a…d, correct_answer, difficulty, explanation, points</p>
                <p>type: <code>single_choice</code> | <code>true_false</code> | <code>fill_blank</code></p>
                <p>correct_answer: A/B/C/D (single_choice), true/false (true_false), text (fill_blank)</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setImportingLessonId(null)}
                  className="flex-1 rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
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
                  className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
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
