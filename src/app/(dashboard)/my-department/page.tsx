'use client';

import { useAuth } from '@/components/providers/auth-provider';
import { useEffect, useState } from 'react';
import { ChevronRight, Users, BookOpen, BarChart2, CheckCircle2, X, ChevronLeft } from 'lucide-react';

interface ManagedOrg {
  id: string;
  name: string;
  type: string;
  parentId: string | null;
}

interface ChildStat {
  orgId: string;
  orgName: string;
  orgType: string;
  hasChildren: boolean;
  leader: { id: string; fullName: string; jobTitle: string | null } | null;
  memberCount: number;
  enrolled: number;
  completed: number;
  completionRate: number;
  avgProgress: number;
}

interface Employee {
  id: string;
  fullName: string;
  email: string;
  employeeCode: string | null;
  jobTitle: string | null;
  enrolled: number;
  completed: number;
  completionRate: number;
  avgProgress: number;
}

interface EmployeeDetail {
  user: { fullName: string; email: string; employeeCode: string | null; jobTitle: string | null };
  courses: {
    courseId: string;
    courseTitle: string;
    enrolledAt: string;
    completedAt: string | null;
    progressPct: number;
    timeSpentHours: number;
    quizBestScore: number | null;
    certificate: { code: string; issuedAt: string } | null;
  }[];
}

const TYPE_LABEL: Record<string, string> = { dept: 'Phòng ban', team: 'Tổ nhóm', company: 'Công ty', group: 'Tập đoàn' };
const TYPE_COLOR: Record<string, string> = { dept: 'text-green-700 bg-green-50', team: 'text-amber-700 bg-amber-50', company: 'text-blue-700 bg-blue-50' };

export default function MyDepartmentPage() {
  const { accessToken, user } = useAuth();
  const [managedOrgs, setManagedOrgs] = useState<ManagedOrg[]>([]);
  const [breadcrumb, setBreadcrumb] = useState<{ id: string; name: string }[]>([]);
  const [children, setChildren] = useState<ChildStat[] | null>(null);
  const [employees, setEmployees] = useState<Employee[] | null>(null);
  const [view, setView] = useState<'children' | 'employees'>('children');
  const [loading, setLoading] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeDetail | null>(null);
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);
  const [currentOrgName, setCurrentOrgName] = useState('');

  const headers = { Authorization: `Bearer ${accessToken}` };

  useEffect(() => {
    if (!accessToken) return;
    fetch('/api/reports/dept', { headers })
      .then((r) => r.json())
      .then((res) => { if (res.success) setManagedOrgs(res.data); });
  }, [accessToken]); // eslint-disable-line

  const loadOrg = async (orgId: string, orgName: string, isNewBreadcrumb = true) => {
    setLoading(true);
    setCurrentOrgId(orgId);
    setCurrentOrgName(orgName);
    setEmployees(null);
    setView('children');
    try {
      const res = await fetch(`/api/reports/dept/${orgId}?view=children`, { headers });
      const json = await res.json();
      if (json.success) setChildren(json.data);
      if (isNewBreadcrumb) {
        setBreadcrumb((prev) => [...prev, { id: orgId, name: orgName }]);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadEmployees = async () => {
    if (!currentOrgId) return;
    setLoading(true);
    setView('employees');
    try {
      const res = await fetch(`/api/reports/dept/${currentOrgId}?view=employees`, { headers });
      const json = await res.json();
      if (json.success) setEmployees(json.data);
    } finally {
      setLoading(false);
    }
  };

  const loadChildren = async () => {
    if (!currentOrgId) return;
    setLoading(true);
    setView('children');
    try {
      const res = await fetch(`/api/reports/dept/${currentOrgId}?view=children`, { headers });
      const json = await res.json();
      if (json.success) setChildren(json.data);
    } finally {
      setLoading(false);
    }
  };

  const navigateBreadcrumb = (index: number) => {
    const crumb = breadcrumb[index];
    setBreadcrumb(breadcrumb.slice(0, index + 1));
    loadOrg(crumb.id, crumb.name, false);
  };

  const goBack = () => {
    if (breadcrumb.length <= 1) {
      setBreadcrumb([]);
      setCurrentOrgId(null);
      setChildren(null);
      setEmployees(null);
    } else {
      const newBread = breadcrumb.slice(0, -1);
      setBreadcrumb(newBread);
      const prev = newBread[newBread.length - 1];
      loadOrg(prev.id, prev.name, false);
    }
  };

  const loadEmployeeDetail = async (userId: string) => {
    try {
      const res = await fetch(`/api/reports/dept/users/${userId}`, { headers });
      const json = await res.json();
      if (json.success) setSelectedEmployee(json.data);
    } catch {
      // silently ignore
    }
  };

  const getRole = (r: unknown): string =>
    typeof r === 'string' ? r : (r as { role: string }).role;
  const userRoles = user?.roles?.map(getRole) ?? [];

  // ── Root: show managed orgs ────────────────────────────────
  if (!currentOrgId) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <h1 className="text-[18px] font-semibold text-content mb-1">Bộ phận của tôi</h1>
        <p className="text-[13px] text-subtle mb-6">Theo dõi tiến độ và kết quả học tập của nhân sự trong bộ phận bạn quản lý.</p>

        {managedOrgs.length === 0 ? (
          <div className="text-center py-16 text-subtle">
            <Users size={40} className="mx-auto mb-3 text-faint opacity-40" />
            <p className="text-[14px]">Bạn chưa được phân công quản lý bộ phận nào.</p>
            <p className="text-[12px] text-faint mt-1">Liên hệ Admin để được gán vai trò trưởng bộ phận.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {managedOrgs.map((org) => (
              <button
                key={org.id}
                onClick={() => loadOrg(org.id, org.name)}
                className="text-left border border-default rounded-xl p-4 hover:border-primary hover:shadow-md transition-all bg-surface group"
              >
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${TYPE_COLOR[org.type] ?? 'text-gray-600 bg-gray-100'}`}>
                  {TYPE_LABEL[org.type] ?? org.type}
                </span>
                <p className="mt-2 text-[14px] font-semibold text-content group-hover:text-primary transition-colors">{org.name}</p>
                <p className="mt-1 flex items-center gap-1 text-[11px] text-subtle">
                  Xem báo cáo <ChevronRight size={12} />
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Detail view with breadcrumb ────────────────────────────
  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 mb-4 flex-wrap">
        <button onClick={goBack} className="text-subtle hover:text-content transition-colors">
          <ChevronLeft size={16} />
        </button>
        <button
          onClick={() => { setBreadcrumb([]); setCurrentOrgId(null); setChildren(null); setEmployees(null); }}
          className="text-[12px] text-subtle hover:text-primary transition-colors"
        >
          Bộ phận của tôi
        </button>
        {breadcrumb.map((crumb, i) => (
          <span key={crumb.id} className="flex items-center gap-1.5">
            <ChevronRight size={12} className="text-faint" />
            {i < breadcrumb.length - 1 ? (
              <button
                onClick={() => navigateBreadcrumb(i)}
                className="text-[12px] text-subtle hover:text-primary transition-colors"
              >
                {crumb.name}
              </button>
            ) : (
              <span className="text-[12px] font-semibold text-content">{crumb.name}</span>
            )}
          </span>
        ))}
      </div>

      {/* Header + Toggle */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <h1 className="text-[17px] font-semibold text-content">{currentOrgName}</h1>
        <div className="flex items-center gap-2">
          <div className="flex border border-default rounded-lg overflow-hidden text-[12px]">
            <button
              onClick={() => view !== 'children' ? loadChildren() : undefined}
              className={`px-3 py-1.5 font-medium transition-colors ${view === 'children' ? 'bg-primary text-white' : 'text-subtle hover:bg-muted'}`}
            >
              Xem theo đơn vị
            </button>
            <button
              onClick={() => view !== 'employees' ? loadEmployees() : undefined}
              className={`px-3 py-1.5 font-medium transition-colors ${view === 'employees' ? 'bg-primary text-white' : 'text-subtle hover:bg-muted'}`}
            >
              Tất cả nhân viên
            </button>
          </div>
        </div>
      </div>

      {loading && (
        <div className="text-center py-16 text-subtle text-[13px]">Đang tải dữ liệu...</div>
      )}

      {/* Children aggregate view */}
      {!loading && view === 'children' && children !== null && (
        children.length === 0 ? (
          <div className="text-center py-12 text-subtle">
            <p className="text-[13px]">Không có đơn vị con. Chuyển sang xem nhân viên trực tiếp.</p>
            <button onClick={loadEmployees} className="mt-3 text-[12px] text-primary underline">
              Xem tất cả nhân viên →
            </button>
          </div>
        ) : (
          <div className="bg-surface border border-default rounded-xl overflow-hidden shadow-card">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-default bg-muted/30">
                  <th className="text-left px-4 py-3 font-semibold text-subtle">Đơn vị</th>
                  <th className="text-right px-4 py-3 font-semibold text-subtle">Nhân viên</th>
                  <th className="text-right px-4 py-3 font-semibold text-subtle">Đã đăng ký KH</th>
                  <th className="text-right px-4 py-3 font-semibold text-subtle">TB tiến độ</th>
                  <th className="text-right px-4 py-3 font-semibold text-subtle">Hoàn thành</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {children.map((child) => (
                  <tr key={child.orgId} className="border-b border-default/50 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${TYPE_COLOR[child.orgType] ?? 'text-gray-600 bg-gray-100'}`}>
                          {TYPE_LABEL[child.orgType] ?? child.orgType}
                        </span>
                        <div>
                          <p className="font-medium text-content">{child.orgName}</p>
                          {child.leader && (
                            <p className="text-[10px] text-subtle">
                              Trưởng: {child.leader.fullName}
                              {child.leader.jobTitle ? ` · ${child.leader.jobTitle}` : ''}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-content">
                      <span className="flex items-center justify-end gap-1"><Users size={11} className="text-faint" />{child.memberCount}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-content">
                      <span className="flex items-center justify-end gap-1"><BookOpen size={11} className="text-faint" />{child.enrolled}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full"
                            style={{ width: `${child.avgProgress}%` }}
                          />
                        </div>
                        <span className="text-content font-medium w-8 text-right">{child.avgProgress}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`inline-flex items-center gap-1 font-medium ${child.completionRate >= 80 ? 'text-green-600' : child.completionRate >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                        <CheckCircle2 size={11} />
                        {child.completed}/{child.enrolled} ({child.completionRate}%)
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {child.hasChildren ? (
                        <button
                          onClick={() => loadOrg(child.orgId, child.orgName)}
                          className="flex items-center gap-1 text-primary hover:underline ml-auto"
                        >
                          Xem <ChevronRight size={12} />
                        </button>
                      ) : (
                        <button
                          onClick={async () => {
                            setCurrentOrgId(child.orgId);
                            setCurrentOrgName(child.orgName);
                            setBreadcrumb((prev) => [...prev, { id: child.orgId, name: child.orgName }]);
                            setLoading(true);
                            setView('employees');
                            const res = await fetch(`/api/reports/dept/${child.orgId}?view=employees`, { headers });
                            const json = await res.json();
                            if (json.success) setEmployees(json.data);
                            setLoading(false);
                          }}
                          className="flex items-center gap-1 text-primary hover:underline ml-auto"
                        >
                          NV <ChevronRight size={12} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Employees flat view */}
      {!loading && view === 'employees' && employees !== null && (
        <div className="bg-surface border border-default rounded-xl overflow-hidden shadow-card">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-default bg-muted/30">
                <th className="text-left px-4 py-3 font-semibold text-subtle">Nhân viên</th>
                <th className="text-left px-4 py-3 font-semibold text-subtle">Vị trí</th>
                <th className="text-right px-4 py-3 font-semibold text-subtle">Đăng ký</th>
                <th className="text-right px-4 py-3 font-semibold text-subtle">TB tiến độ</th>
                <th className="text-right px-4 py-3 font-semibold text-subtle">Hoàn thành</th>
              </tr>
            </thead>
            <tbody>
              {employees.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-subtle">Không có nhân viên trong bộ phận này.</td></tr>
              )}
              {employees.map((emp) => (
                <tr key={emp.id} onClick={() => loadEmployeeDetail(emp.id)} className="border-b border-default/50 hover:bg-muted/20 transition-colors cursor-pointer">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-[10px] font-semibold flex items-center justify-center flex-shrink-0">
                        {emp.fullName.split(' ').slice(-1)[0]?.[0]?.toUpperCase() ?? '?'}
                      </div>
                      <div>
                        <p className="font-medium text-content">{emp.fullName}</p>
                        <p className="text-[10px] text-subtle">{emp.employeeCode ? `#${emp.employeeCode} · ` : ''}{emp.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-subtle">{emp.jobTitle ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-content">{emp.enrolled}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${emp.avgProgress}%` }} />
                      </div>
                      <span className="text-content font-medium w-8 text-right">{emp.avgProgress}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-medium ${emp.completionRate >= 80 ? 'text-green-600' : emp.completionRate >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                      {emp.completed}/{emp.enrolled}
                      {emp.enrolled > 0 ? ` (${emp.completionRate}%)` : ''}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Employee detail drawer */}
      {selectedEmployee && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSelectedEmployee(null)} />
          <div className="relative w-full max-w-lg bg-white h-full shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <p className="text-[14px] font-semibold text-gray-800">{selectedEmployee.user.fullName}</p>
                <p className="text-[11px] text-gray-400">{selectedEmployee.user.jobTitle ?? selectedEmployee.user.email}</p>
              </div>
              <button onClick={() => setSelectedEmployee(null)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {selectedEmployee.courses.map((c) => (
                <div key={c.courseId} className="border border-gray-100 rounded-xl p-4">
                  <p className="text-[12px] font-semibold text-gray-800 mb-2">{c.courseTitle}</p>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${c.progressPct}%` }} />
                    </div>
                    <span className="text-[11px] text-gray-500">{c.progressPct}%</span>
                  </div>
                  <div className="flex gap-3 text-[10px] text-gray-400">
                    {c.completedAt && <span className="text-green-600 font-medium">✓ Hoàn thành</span>}
                    {c.quizBestScore !== null && <span>Quiz: {c.quizBestScore}%</span>}
                    {c.certificate && <span className="text-blue-600">📜 Chứng chỉ</span>}
                    <span>{c.timeSpentHours}h</span>
                  </div>
                </div>
              ))}
              {selectedEmployee.courses.length === 0 && (
                <p className="text-[13px] text-gray-400 text-center py-8">Chưa đăng ký khóa học nào.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
