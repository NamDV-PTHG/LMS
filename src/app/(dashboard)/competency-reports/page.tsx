'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { useToast } from '@/components/ui/toast';
import { BarChart2, Building2, Users, TrendingUp, RefreshCw } from 'lucide-react';
import { CompetencyMatrix } from '@/components/charts/competency-matrix';

type Tab = 'company' | 'dept' | 'group' | 'user';

interface CompanyOption { id: string; name: string }
interface CompanyOverview {
  companyId: string;
  companyName: string;
  totalUsers: number;
  usersWithProfile: number;
  overallReadiness: number;
  competencies: {
    id: string; name: string; domain: string; required: number;
    avgCurrent: number; metCount: number; totalCount: number; metPct: number;
  }[];
}
interface DeptRow { id: string; name: string; type: string; userCount: number; readiness: number }
interface GroupRow { id: string; name: string; userCount: number; profiledUsers: number; readiness: number }

export default function CompetencyReportsPage() {
  const { user, accessToken } = useAuth();
  const { toast } = useToast();

  const roles: string[] = (user?.roles ?? []).map((r: unknown) =>
    typeof r === 'string' ? r : (r as { role: string }).role,
  );
  const isGroupAdmin = roles.includes('group_admin');
  const canSeeCompany = isGroupAdmin || roles.includes('company_admin') || roles.includes('hr_manager');

  const defaultTab: Tab = isGroupAdmin ? 'group' : 'company';
  const [tab, setTab] = useState<Tab>(defaultTab);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');

  const [companyOverview, setCompanyOverview] = useState<CompanyOverview | null>(null);
  const [deptRows, setDeptRows] = useState<DeptRow[]>([]);
  const [groupRows, setGroupRows] = useState<GroupRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Load company list
  useEffect(() => {
    if (!canSeeCompany) return;
    fetch('/api/organizations', { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.json())
      .then((res) => {
        const list: CompanyOption[] = res.success
          ? (res.data ?? []).filter((o: { type: string }) => o.type === 'company').map((o: { id: string; name: string }) => ({ id: o.id, name: o.name }))
          : [];
        setCompanies(list);
        if (list.length > 0 && !selectedCompanyId) setSelectedCompanyId(list[0].id);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'group' && isGroupAdmin) {
        const res = await fetch('/api/reports/group/competency-overview', {
          headers: { Authorization: `Bearer ${accessToken}` },
        }).then((r) => r.json());
        if (res.success) setGroupRows(res.data);
        else toast('error', res.error ?? 'Lỗi tải dữ liệu');
      } else if (tab === 'company' && selectedCompanyId) {
        const res = await fetch(`/api/reports/company/${selectedCompanyId}/competency-overview`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }).then((r) => r.json());
        if (res.success) setCompanyOverview(res.data);
        else toast('error', res.error ?? 'Lỗi tải dữ liệu');
      } else if (tab === 'dept' && selectedCompanyId) {
        const res = await fetch(`/api/reports/company/${selectedCompanyId}/competency-by-dept`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }).then((r) => r.json());
        if (res.success) setDeptRows(res.data);
        else toast('error', res.error ?? 'Lỗi tải dữ liệu');
      }
    } catch {
      toast('error', 'Lỗi kết nối');
    } finally {
      setLoading(false);
    }
  }, [tab, selectedCompanyId, isGroupAdmin, accessToken, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const TABS: { key: Tab; label: string; icon: typeof BarChart2; show: boolean }[] = [
    { key: 'group', label: 'Toàn tập đoàn', icon: TrendingUp, show: isGroupAdmin },
    { key: 'company', label: 'Theo công ty', icon: Building2, show: canSeeCompany },
    { key: 'dept', label: 'Theo phòng ban', icon: Users, show: canSeeCompany },
  ];

  const readinessColor = (s: number) =>
    s >= 80 ? 'text-green-600' : s >= 50 ? 'text-amber-600' : 'text-red-500';
  const readinessBg = (s: number) =>
    s >= 80 ? 'bg-green-50' : s >= 50 ? 'bg-amber-50' : 'bg-red-50';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart2 size={18} className="text-primary" />
          <h1 className="text-[16px] font-semibold text-content">Báo cáo Năng lực</h1>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-1.5 text-[12px] text-subtle hover:text-content transition-colors"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Làm mới
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.filter((t) => t.show).map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
                tab === t.key
                  ? 'bg-surface text-primary shadow-sm'
                  : 'text-subtle hover:text-content'
              }`}
            >
              <Icon size={13} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Company selector (for company/dept tabs) */}
      {(tab === 'company' || tab === 'dept') && isGroupAdmin && companies.length > 0 && (
        <div className="flex items-center gap-2">
          <label className="text-[12px] text-subtle">Công ty:</label>
          <select
            value={selectedCompanyId}
            onChange={(e) => setSelectedCompanyId(e.target.value)}
            className="border border-default rounded-lg px-2 py-1 text-[12px] text-content bg-surface focus:outline-none focus:border-primary"
          >
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Content */}
      <div className="bg-surface rounded-xl border border-default shadow-card p-4">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-[12px] text-faint">Đang tải...</div>
        ) : (
          <>
            {/* Tab: Toàn tập đoàn */}
            {tab === 'group' && (
              <div className="space-y-3">
                <p className="text-[12px] text-subtle mb-3">Tổng hợp sẵn sàng năng lực theo từng công ty</p>
                {groupRows.length === 0 ? (
                  <p className="text-[12px] text-faint text-center py-8">Chưa có dữ liệu</p>
                ) : (
                  <div className="space-y-2">
                    {groupRows
                      .sort((a, b) => a.readiness - b.readiness)
                      .map((row) => (
                        <div key={row.id} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-medium text-content truncate">{row.name}</p>
                            <p className="text-[10px] text-subtle">
                              {row.profiledUsers}/{row.userCount} nhân viên có hồ sơ năng lực
                            </p>
                          </div>
                          <div className={`w-16 text-center py-1 rounded-lg ${readinessBg(row.readiness)}`}>
                            <span className={`text-[14px] font-semibold ${readinessColor(row.readiness)}`}>
                              {row.readiness}%
                            </span>
                            <p className="text-[9px] text-gray-400">sẵn sàng</p>
                          </div>
                          <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${row.readiness >= 80 ? 'bg-green-500' : row.readiness >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                              style={{ width: `${row.readiness}%` }}
                            />
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab: Theo công ty — CompetencyMatrix */}
            {tab === 'company' && (
              <div className="space-y-4">
                {companyOverview ? (
                  <>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: 'Tổng nhân viên', value: companyOverview.totalUsers },
                        { label: 'Có hồ sơ NL', value: companyOverview.usersWithProfile },
                        {
                          label: 'Sẵn sàng chung',
                          value: `${companyOverview.overallReadiness}%`,
                          cls: readinessColor(companyOverview.overallReadiness),
                        },
                      ].map((s) => (
                        <div key={s.label} className="bg-gray-50 rounded-xl p-3 text-center">
                          <p className={`text-[20px] font-semibold ${s.cls ?? 'text-content'}`}>{s.value}</p>
                          <p className="text-[10px] text-subtle mt-0.5">{s.label}</p>
                        </div>
                      ))}
                    </div>
                    <CompetencyMatrix competencies={companyOverview.competencies} />
                  </>
                ) : (
                  <p className="text-[12px] text-faint text-center py-8">Chưa có dữ liệu</p>
                )}
              </div>
            )}

            {/* Tab: Theo phòng ban */}
            {tab === 'dept' && (
              <div className="space-y-2">
                {deptRows.length === 0 ? (
                  <p className="text-[12px] text-faint text-center py-8">Chưa có dữ liệu</p>
                ) : (
                  deptRows
                    .sort((a, b) => a.readiness - b.readiness)
                    .map((row) => (
                      <div key={row.id} className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0">
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-medium text-content truncate">{row.name}</p>
                          <p className="text-[10px] text-subtle">{row.userCount} nhân viên</p>
                        </div>
                        <div className={`w-16 text-center py-1 rounded-lg ${readinessBg(row.readiness)}`}>
                          <span className={`text-[14px] font-semibold ${readinessColor(row.readiness)}`}>
                            {row.readiness}%
                          </span>
                          <p className="text-[9px] text-gray-400">sẵn sàng</p>
                        </div>
                        <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${row.readiness >= 80 ? 'bg-green-500' : row.readiness >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                            style={{ width: `${row.readiness}%` }}
                          />
                        </div>
                      </div>
                    ))
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
