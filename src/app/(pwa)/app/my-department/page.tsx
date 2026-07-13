'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft, ChevronRight, ChevronDown, Users, BookOpen,
  CheckCircle2, Clock, Award, Video, FileText, ClipboardList, X, BarChart2,
} from 'lucide-react'
import { useAuth } from '@/components/providers/auth-provider'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ManagedOrg { id: string; name: string; type: string; parentId: string | null }
interface ChildStat {
  orgId: string; orgName: string; orgType: string; hasChildren: boolean
  leader: { id: string; fullName: string; jobTitle: string | null } | null
  memberCount: number; enrolled: number; completed: number
  completionRate: number; avgProgress: number
}
interface Employee {
  id: string; fullName: string; email: string; employeeCode: string | null
  jobTitle: string | null; enrolled: number; completed: number; completionRate: number
  totalLessons: number; completedLessons: number; lessonProgress: number
}
interface LessonDetail {
  id: string; title: string; contentType: string; isRequired: boolean
  status: 'completed' | 'in_progress' | 'not_started'
  completedAt: string | null; progressPct: number; timeSpentMin: number
  quiz: { attempts: number; bestScore: number | null; passed: boolean } | null
}
interface SectionDetail { id: string; title: string; order: number; lessons: LessonDetail[] }
interface CourseDetail {
  courseId: string; courseTitle: string; completedAt: string | null
  totalLessons: number; completedLessons: number; progressPct: number
  timeSpentHours: number
  certificate: { code: string; issuedAt: string } | null
  quizBestScore: number | null; quizAttemptCount: number
  sections: SectionDetail[]
}
interface EmployeeDetail {
  user: { fullName: string; email: string; employeeCode: string | null; jobTitle: string | null }
  courses: CourseDetail[]
}

const TYPE_LABEL: Record<string, string> = {
  dept: 'Phòng ban', team: 'Tổ nhóm', company: 'Công ty', group: 'Tập đoàn',
}
const TYPE_COLOR: Record<string, string> = {
  dept: 'text-green-700 bg-green-50',
  team: 'text-amber-700 bg-amber-50',
  company: 'text-blue-700 bg-blue-50',
}

function StatusBadge({ status }: { status: 'completed' | 'in_progress' | 'not_started' }) {
  if (status === 'completed') return <span className="text-[10px] font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">Hoàn thành</span>
  if (status === 'in_progress') return <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">Đang học</span>
  return <span className="text-[10px] font-medium text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-full">Chưa bắt đầu</span>
}

function LessonIcon({ type }: { type: string }) {
  if (type === 'video') return <Video size={12} className="text-blue-500 flex-shrink-0" />
  if (type === 'quiz') return <ClipboardList size={12} className="text-purple-500 flex-shrink-0" />
  if (type === 'pdf') return <FileText size={12} className="text-red-400 flex-shrink-0" />
  return <BookOpen size={12} className="text-gray-400 flex-shrink-0" />
}

function ProgressBar({ value, color = 'bg-blue-500' }: { value: number; color?: string }) {
  return (
    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function AppMyDepartmentPage() {
  const { accessToken, isLoading: authLoading, user } = useAuth()
  const router = useRouter()

  const [managedOrgs, setManagedOrgs] = useState<ManagedOrg[]>([])
  const [breadcrumb, setBreadcrumb] = useState<{ id: string; name: string }[]>([])
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null)
  const [currentOrgName, setCurrentOrgName] = useState('')
  const [children, setChildren] = useState<ChildStat[] | null>(null)
  const [employees, setEmployees] = useState<Employee[] | null>(null)
  const [view, setView] = useState<'children' | 'employees'>('children')
  const [loading, setLoading] = useState(false)

  // Employee detail — full-screen overlay on mobile
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeDetail | null>(null)
  const [expandedCourses, setExpandedCourses] = useState<Record<string, boolean>>({})
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!authLoading && !accessToken) router.replace('/app/login')
  }, [authLoading, accessToken, router])

  const headers = { Authorization: `Bearer ${accessToken}` }

  useEffect(() => {
    if (!accessToken) return
    fetch('/api/reports/dept', { headers })
      .then((r) => r.json())
      .then((res) => { if (res.success) setManagedOrgs(res.data ?? []) })
      .catch(() => {})
  }, [accessToken]) // eslint-disable-line

  const loadOrg = async (orgId: string, orgName: string, addBreadcrumb = true) => {
    setLoading(true)
    setCurrentOrgId(orgId)
    setCurrentOrgName(orgName)
    setEmployees(null)
    setView('children')
    if (addBreadcrumb) setBreadcrumb((prev) => [...prev, { id: orgId, name: orgName }])
    try {
      const res = await fetch(`/api/reports/dept/${orgId}?view=children`, { headers })
      const json = await res.json()
      if (json.success) setChildren(json.data ?? [])
    } finally {
      setLoading(false)
    }
  }

  const loadEmployees = async (orgId?: string) => {
    const id = orgId ?? currentOrgId
    if (!id) return
    setLoading(true)
    setView('employees')
    try {
      const res = await fetch(`/api/reports/dept/${id}?view=employees`, { headers })
      const json = await res.json()
      if (json.success) setEmployees(json.data ?? [])
    } finally {
      setLoading(false)
    }
  }

  const goBack = () => {
    if (breadcrumb.length <= 1) {
      setBreadcrumb([])
      setCurrentOrgId(null)
      setChildren(null)
      setEmployees(null)
    } else {
      const newBread = breadcrumb.slice(0, -1)
      setBreadcrumb(newBread)
      const prev = newBread[newBread.length - 1]
      loadOrg(prev.id, prev.name, false)
    }
  }

  const loadEmployeeDetail = async (userId: string) => {
    setExpandedCourses({})
    setExpandedSections({})
    try {
      const res = await fetch(`/api/reports/dept/users/${userId}`, { headers })
      const json = await res.json()
      if (json.success) setSelectedEmployee(json.data)
    } catch { /* ignore */ }
  }

  // ── Root: list managed orgs ───────────────────────────────────────────────
  if (!currentOrgId) {
    return (
      <main className="max-w-phone mx-auto min-h-screen bg-muted pb-20 animate-fade-in">
        {/* Header */}
        <div className="bg-primary-gradient px-4 pt-12 pb-5">
          <button onClick={() => router.back()} className="text-white/70 mb-2 flex items-center gap-1 text-[12px]">
            <ChevronLeft size={16} /> Quay lại
          </button>
          <h1 className="text-white text-xl font-medium">Bộ phận của tôi</h1>
          <p className="text-white/60 text-[12px] mt-0.5">Theo dõi tiến độ học tập nhân sự</p>
        </div>

        <div className="px-4 py-4">
          {managedOrgs.length === 0 ? (
            <div className="bg-surface rounded-xl shadow-card p-8 flex flex-col items-center gap-3">
              <Users size={36} className="text-faint opacity-40" />
              <p className="text-[13px] text-subtle text-center">Bạn chưa được phân công quản lý bộ phận nào.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {managedOrgs.map((org) => (
                <button
                  key={org.id}
                  onClick={() => loadOrg(org.id, org.name)}
                  className="w-full text-left bg-surface rounded-xl shadow-card px-4 py-3.5 flex items-center gap-3 active:bg-muted transition-colors"
                >
                  <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <Users size={16} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${TYPE_COLOR[org.type] ?? 'text-gray-600 bg-gray-100'}`}>
                      {TYPE_LABEL[org.type] ?? org.type}
                    </span>
                    <p className="mt-1 text-[13px] font-medium text-content truncate">{org.name}</p>
                  </div>
                  <ChevronRight size={16} className="text-faint flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </main>
    )
  }

  // ── Org drill-down ────────────────────────────────────────────────────────
  return (
    <main className="max-w-phone mx-auto min-h-screen bg-muted pb-20 animate-fade-in">
      {/* Header */}
      <div className="bg-primary-gradient px-4 pt-12 pb-5">
        <button onClick={goBack} className="text-white/70 mb-2 flex items-center gap-1 text-[12px]">
          <ChevronLeft size={16} />
          {breadcrumb.length <= 1 ? 'Bộ phận của tôi' : breadcrumb[breadcrumb.length - 2]?.name ?? 'Quay lại'}
        </button>
        <h1 className="text-white text-lg font-medium truncate">{currentOrgName}</h1>
        {breadcrumb.length > 1 && (
          <p className="text-white/60 text-[11px] mt-0.5 truncate">
            {breadcrumb.slice(0, -1).map(b => b.name).join(' › ')}
          </p>
        )}
      </div>

      {/* View toggle */}
      <div className="px-4 pt-3">
        <div className="flex bg-surface rounded-xl shadow-card overflow-hidden text-[12px]">
          <button
            onClick={() => view !== 'children' ? loadOrg(currentOrgId!, currentOrgName, false) : undefined}
            className={`flex-1 py-2.5 font-medium transition-colors ${view === 'children' ? 'bg-primary text-white' : 'text-subtle'}`}
          >
            Đơn vị con
          </button>
          <button
            onClick={() => view !== 'employees' ? loadEmployees() : undefined}
            className={`flex-1 py-2.5 font-medium transition-colors ${view === 'employees' ? 'bg-primary text-white' : 'text-subtle'}`}
          >
            Nhân viên
          </button>
        </div>
      </div>

      <div className="px-4 py-3 space-y-2.5">
        {loading && (
          <div className="bg-surface rounded-xl shadow-card p-8 text-center text-[12px] text-subtle">
            Đang tải...
          </div>
        )}

        {/* Children list */}
        {!loading && view === 'children' && children !== null && (
          children.length === 0 ? (
            <div className="bg-surface rounded-xl shadow-card p-6 text-center space-y-2">
              <p className="text-[13px] text-subtle">Không có đơn vị con.</p>
              <button onClick={() => loadEmployees()} className="text-[12px] text-primary font-medium">
                Xem tất cả nhân viên →
              </button>
            </div>
          ) : (
            children.map((child) => (
              <div key={child.orgId} className="bg-surface rounded-xl shadow-card overflow-hidden">
                {/* Org card header */}
                <div className="px-4 py-3 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Users size={14} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${TYPE_COLOR[child.orgType] ?? 'text-gray-600 bg-gray-100'}`}>
                        {TYPE_LABEL[child.orgType] ?? child.orgType}
                      </span>
                    </div>
                    <p className="text-[13px] font-medium text-content mt-0.5 truncate">{child.orgName}</p>
                    {child.leader && (
                      <p className="text-[11px] text-subtle">Trưởng: {child.leader.fullName}</p>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      if (child.hasChildren) {
                        loadOrg(child.orgId, child.orgName)
                      } else {
                        setBreadcrumb((prev) => [...prev, { id: child.orgId, name: child.orgName }])
                        setCurrentOrgId(child.orgId)
                        setCurrentOrgName(child.orgName)
                        loadEmployees(child.orgId)
                      }
                    }}
                    className="flex items-center gap-1 text-[12px] text-primary font-medium flex-shrink-0 mt-1"
                  >
                    {child.hasChildren ? 'Xem' : 'NV'} <ChevronRight size={13} />
                  </button>
                </div>

                {/* Stats row */}
                <div className="border-t border-default grid grid-cols-3 divide-x divide-default">
                  <div className="px-3 py-2 text-center">
                    <p className="text-[14px] font-semibold text-content">{child.memberCount}</p>
                    <p className="text-[9px] text-subtle">Nhân viên</p>
                  </div>
                  <div className="px-3 py-2 text-center">
                    <p className={`text-[14px] font-semibold ${child.completionRate >= 80 ? 'text-green-600' : child.completionRate >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                      {child.completed}/{child.enrolled}
                    </p>
                    <p className="text-[9px] text-subtle">KH hoàn thành</p>
                  </div>
                  <div className="px-3 py-2 text-center">
                    <p className={`text-[14px] font-semibold ${child.avgProgress >= 80 ? 'text-green-600' : child.avgProgress >= 50 ? 'text-amber-600' : 'text-blue-600'}`}>
                      {child.avgProgress}%
                    </p>
                    <p className="text-[9px] text-subtle">Tiến độ TB</p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="px-4 pb-3 pt-2">
                  <div className="flex items-center gap-2">
                    <ProgressBar
                      value={child.avgProgress}
                      color={child.avgProgress >= 80 ? 'bg-green-500' : child.avgProgress >= 50 ? 'bg-amber-500' : 'bg-blue-500'}
                    />
                    <span className="text-[10px] text-subtle w-8 text-right">{child.avgProgress}%</span>
                  </div>
                </div>
              </div>
            ))
          )
        )}

        {/* Employees list */}
        {!loading && view === 'employees' && employees !== null && (
          employees.length === 0 ? (
            <div className="bg-surface rounded-xl shadow-card p-6 text-center">
              <p className="text-[13px] text-subtle">Không có nhân viên.</p>
            </div>
          ) : (
            employees.map((emp) => (
              <button
                key={emp.id}
                onClick={() => loadEmployeeDetail(emp.id)}
                className="w-full text-left bg-surface rounded-xl shadow-card px-4 py-3 active:bg-muted transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 text-[11px] font-semibold flex items-center justify-center flex-shrink-0">
                    {emp.fullName.split(' ').slice(-1)[0]?.[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-content truncate">{emp.fullName}</p>
                    <p className="text-[11px] text-subtle truncate">
                      {emp.employeeCode ? `#${emp.employeeCode} · ` : ''}{emp.jobTitle ?? emp.email}
                    </p>
                    {/* Lesson progress bar */}
                    <div className="flex items-center gap-2 mt-2">
                      <ProgressBar
                        value={emp.lessonProgress}
                        color={emp.lessonProgress >= 80 ? 'bg-green-500' : emp.lessonProgress >= 50 ? 'bg-amber-500' : 'bg-blue-400'}
                      />
                      <span className="text-[10px] text-subtle whitespace-nowrap">
                        {emp.completedLessons}/{emp.totalLessons} bài ({emp.lessonProgress}%)
                      </span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-[12px] font-semibold ${emp.completionRate >= 80 ? 'text-green-600' : emp.completionRate >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                      {emp.completed}/{emp.enrolled}
                    </p>
                    <p className="text-[9px] text-subtle">KH</p>
                  </div>
                </div>
              </button>
            ))
          )
        )}
      </div>

      {/* ── Employee detail — full-screen overlay ──────────────────────────── */}
      {selectedEmployee && (
        <div className="fixed inset-0 z-50 max-w-phone mx-auto bg-muted flex flex-col overflow-hidden animate-fade-in">
          {/* Header */}
          <div className="bg-surface border-b border-default px-4 pt-12 pb-4 flex items-start gap-3 flex-shrink-0">
            <button onClick={() => setSelectedEmployee(null)} className="text-subtle mt-0.5">
              <X size={20} />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold text-content">{selectedEmployee.user.fullName}</p>
              <p className="text-[11px] text-subtle truncate">
                {selectedEmployee.user.jobTitle ?? selectedEmployee.user.email}
                {selectedEmployee.user.employeeCode ? ` · #${selectedEmployee.user.employeeCode}` : ''}
              </p>
            </div>
          </div>

          {/* Summary stats */}
          {(() => {
            const totalCourses = selectedEmployee.courses.length
            const completedCourses = selectedEmployee.courses.filter(c => c.completedAt).length
            const totalLessons = selectedEmployee.courses.reduce((s, c) => s + c.totalLessons, 0)
            const completedLessons = selectedEmployee.courses.reduce((s, c) => s + c.completedLessons, 0)
            const lessonPct = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0
            return (
              <div className="bg-surface border-b border-default grid grid-cols-3 divide-x divide-default flex-shrink-0">
                <div className="px-3 py-3 text-center">
                  <p className="text-[17px] font-semibold text-content">{completedCourses}/{totalCourses}</p>
                  <p className="text-[9px] text-subtle mt-0.5">KH hoàn thành</p>
                </div>
                <div className="px-3 py-3 text-center">
                  <p className="text-[17px] font-semibold text-content">{completedLessons}/{totalLessons}</p>
                  <p className="text-[9px] text-subtle mt-0.5">Bài hoàn thành</p>
                </div>
                <div className="px-3 py-3 text-center">
                  <p className={`text-[17px] font-semibold ${lessonPct >= 80 ? 'text-green-600' : lessonPct >= 50 ? 'text-amber-600' : 'text-blue-600'}`}>
                    {lessonPct}%
                  </p>
                  <p className="text-[9px] text-subtle mt-0.5">Tiến độ tổng</p>
                </div>
              </div>
            )
          })()}

          {/* Course list — scrollable */}
          <div className="flex-1 overflow-y-auto py-3 px-4 space-y-2.5">
            {selectedEmployee.courses.length === 0 && (
              <p className="text-[13px] text-subtle text-center py-8">Chưa đăng ký khóa học nào.</p>
            )}
            {selectedEmployee.courses.map((c) => {
              const isExpanded = expandedCourses[c.courseId] ?? false
              return (
                <div key={c.courseId} className="bg-surface rounded-xl shadow-card overflow-hidden">
                  {/* Course header */}
                  <button
                    onClick={() => setExpandedCourses(prev => ({ ...prev, [c.courseId]: !prev[c.courseId] }))}
                    className="w-full text-left px-4 py-3"
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-content truncate">{c.courseTitle}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {c.completedAt
                            ? <span className="text-[10px] font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full flex items-center gap-1"><CheckCircle2 size={9} /> Hoàn thành</span>
                            : c.completedLessons > 0
                            ? <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">Đang học</span>
                            : <span className="text-[10px] font-medium text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-full">Chưa bắt đầu</span>
                          }
                          {c.certificate && (
                            <span className="text-[10px] text-blue-600 font-medium flex items-center gap-0.5">
                              <Award size={9} /> Chứng chỉ
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronDown size={14} className={`text-faint transition-transform flex-shrink-0 mt-0.5 ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>

                    {/* Progress bar */}
                    <div className="flex items-center gap-2 mt-2">
                      <ProgressBar
                        value={c.progressPct}
                        color={c.completedAt ? 'bg-green-500' : 'bg-blue-500'}
                      />
                      <span className="text-[10px] text-subtle whitespace-nowrap">
                        {c.completedLessons}/{c.totalLessons} bài · {c.progressPct}%
                      </span>
                    </div>

                    {/* Meta */}
                    <div className="flex flex-wrap gap-2.5 mt-1.5 text-[10px] text-subtle">
                      {c.timeSpentHours > 0 && (
                        <span className="flex items-center gap-0.5"><Clock size={9} /> {c.timeSpentHours}h</span>
                      )}
                      {c.quizBestScore !== null && (
                        <span className="flex items-center gap-0.5">
                          <ClipboardList size={9} />
                          Quiz: <span className={c.quizBestScore >= 70 ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>{c.quizBestScore}%</span>
                          &nbsp;({c.quizAttemptCount} lần)
                        </span>
                      )}
                    </div>
                  </button>

                  {/* Sections + lessons — expandable */}
                  {isExpanded && (
                    <div className="border-t border-default">
                      {c.sections.map((sec) => {
                        const secDone = sec.lessons.filter(l => l.status === 'completed').length
                        const secKey = `${c.courseId}-${sec.id}`
                        const secExpanded = expandedSections[secKey] ?? false
                        return (
                          <div key={sec.id} className="border-b border-default/50 last:border-0">
                            {/* Section header */}
                            <button
                              onClick={() => setExpandedSections(prev => ({ ...prev, [secKey]: !prev[secKey] }))}
                              className="w-full text-left flex items-center gap-2 px-4 py-2.5 bg-muted/40"
                            >
                              <BarChart2 size={11} className="text-faint flex-shrink-0" />
                              <span className="flex-1 text-[12px] font-medium text-content truncate">{sec.title}</span>
                              <span className={`text-[10px] font-medium flex-shrink-0 ${secDone === sec.lessons.length && sec.lessons.length > 0 ? 'text-green-600' : 'text-subtle'}`}>
                                {secDone}/{sec.lessons.length}
                              </span>
                              <ChevronDown size={12} className={`text-faint transition-transform flex-shrink-0 ${secExpanded ? 'rotate-180' : ''}`} />
                            </button>

                            {/* Lessons */}
                            {secExpanded && (
                              <div className="divide-y divide-default/40">
                                {sec.lessons.map((les) => (
                                  <div key={les.id} className="flex items-start gap-3 px-4 py-2.5 bg-surface">
                                    <div className="mt-0.5 flex-shrink-0">
                                      <LessonIcon type={les.contentType} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <p className="text-[12px] text-content truncate flex-1">{les.title}</p>
                                        {les.isRequired && (
                                          <span className="text-[9px] font-semibold text-orange-600 bg-orange-50 px-1 py-0.5 rounded flex-shrink-0">Bắt buộc</span>
                                        )}
                                        <StatusBadge status={les.status} />
                                      </div>
                                      {les.status === 'in_progress' && (
                                        <div className="flex items-center gap-1.5 mt-1">
                                          <ProgressBar value={les.progressPct} color="bg-amber-400" />
                                          <span className="text-[10px] text-subtle">{les.progressPct}%</span>
                                        </div>
                                      )}
                                      {les.quiz && (
                                        <p className="text-[10px] text-subtle mt-0.5">
                                          {les.quiz.attempts} lần ·{' '}
                                          {les.quiz.bestScore !== null
                                            ? <span className={les.quiz.passed ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>
                                                {les.quiz.bestScore}%{les.quiz.passed ? ' ✓' : ' ✗'}
                                              </span>
                                            : 'Chưa làm'}
                                        </p>
                                      )}
                                      {les.completedAt && (
                                        <p className="text-[10px] text-subtle mt-0.5">
                                          Hoàn thành: {new Date(les.completedAt).toLocaleDateString('vi-VN')}
                                          {les.timeSpentMin > 0 ? ` · ${les.timeSpentMin} phút` : ''}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </main>
  )
}
