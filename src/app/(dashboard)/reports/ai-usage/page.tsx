'use client';

import { useAuth } from '@/components/providers/auth-provider';
import { useEffect, useState, useCallback } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { Activity, Cpu, DollarSign, Users, Clock, CheckCircle, XCircle } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────
interface AiUsageTotals {
  requests: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  costUsd: number | null;
  activeUsers: number;
}
interface DailyPoint { date: string; requests: number; totalTokens: number; costUsd: number | null; }
interface TopUser { userId: string; fullName: string; email: string; requests: number; totalTokens: number; costUsd: number | null; }
interface FeatureBreakdown { feature: string; requests: number; totalTokens: number; pct: number; }
interface RecentLog { id: string; createdAt: string; userName: string | null; feature: string; modelName: string; totalTokens: number; costUsd: number | null; status: string; durationMs: number | null; }

interface AiUsageData {
  totals: AiUsageTotals;
  dailyUsage: DailyPoint[];
  topUsers: TopUser[];
  featureBreakdown: FeatureBreakdown[];
  recentLogs: RecentLog[];
}

interface Organization { id: string; name: string; }

// ── Helpers ────────────────────────────────────────────────────────
const FEATURE_LABELS: Record<string, string> = {
  question_generation: 'Tạo câu hỏi',
  document_processing: 'Xử lý tài liệu',
  chat: 'Chat AI',
};

const PIE_COLORS = ['#1a56db', '#0e9f6e', '#d03801', '#7e3af2', '#d97706'];

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function fmtCost(v: number | null): string {
  if (v === null) return 'N/A';
  return `$${v.toFixed(4)}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}

// ── KPI Card ───────────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string; value: string; sub?: string; color: string;
}) {
  return (
    <div className="bg-surface rounded-xl border border-default shadow-card p-4 flex items-start gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon size={18} className="text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-subtle">{label}</p>
        <p className="text-[20px] font-bold text-content leading-tight">{value}</p>
        {sub && <p className="text-[11px] text-faint mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────
export default function AiUsageReportPage() {
  const { user, accessToken } = useAuth();

  const userRoles: string[] = (user?.roles ?? []).map((r: { role: string } | string) =>
    typeof r === 'string' ? r : r.role,
  );
  const isGroupAdmin = userRoles.includes('group_admin');

  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = `${today.slice(0, 7)}-01`;

  const [from, setFrom] = useState(firstOfMonth);
  const [to,   setTo]   = useState(today);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [companies, setCompanies] = useState<Organization[]>([]);
  const [data, setData]       = useState<AiUsageData | null>(null);
  const [loading, setLoading] = useState(false);

  // Load company list for group_admin
  useEffect(() => {
    if (!isGroupAdmin || !accessToken) return;
    fetch('/api/organizations?type=company&limit=200', { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.json())
      .then((res) => { if (res.success) setCompanies(res.data?.items ?? res.data ?? []); })
      .catch(() => {});
  }, [isGroupAdmin, accessToken]);

  const fetchData = useCallback(() => {
    if (!accessToken) return;
    setLoading(true);
    const params = new URLSearchParams({ from, to });
    if (isGroupAdmin && selectedCompany) params.set('companyId', selectedCompany);

    fetch(`/api/reports/ai-usage?${params}`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.json())
      .then((res) => { if (res.success) setData(res.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [accessToken, from, to, isGroupAdmin, selectedCompany]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const t = data?.totals;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[16px] font-semibold text-content">Báo cáo sử dụng AI</h1>
          <p className="text-[12px] text-subtle mt-0.5">Thống kê lưu lượng, token và chi phí AI theo thời gian</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-surface rounded-xl border border-default shadow-card p-3 flex flex-wrap items-end gap-3">
        {isGroupAdmin && (
          <div className="space-y-1 min-w-[180px]">
            <label className="block text-[11px] text-subtle">Công ty</label>
            <select
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
              className="w-full border border-default rounded-lg px-2 py-1.5 text-[12px] text-content focus:outline-none focus:border-primary"
            >
              <option value="">Tất cả công ty</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}
        <div className="space-y-1">
          <label className="block text-[11px] text-subtle">Từ ngày</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="border border-default rounded-lg px-2 py-1.5 text-[12px] text-content focus:outline-none focus:border-primary" />
        </div>
        <div className="space-y-1">
          <label className="block text-[11px] text-subtle">Đến ngày</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="border border-default rounded-lg px-2 py-1.5 text-[12px] text-content focus:outline-none focus:border-primary" />
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="px-4 py-1.5 bg-primary hover:bg-primary-dark text-white text-[12px] font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? 'Đang tải...' : 'Áp dụng'}
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={Activity} label="Yêu cầu AI" value={t ? t.requests.toLocaleString('vi-VN') : '—'}
          sub="tổng trong kỳ" color="bg-primary" />
        <KpiCard icon={Cpu} label="Tokens đã dùng" value={t ? fmtTokens(t.totalTokens) : '—'}
          sub={t ? `↑ ${fmtTokens(t.promptTokens)} / ↓ ${fmtTokens(t.completionTokens)}` : undefined}
          color="bg-success" />
        <KpiCard icon={DollarSign} label="Chi phí ước tính"
          value={t ? (t.costUsd !== null ? `$${t.costUsd.toFixed(3)}` : 'N/A') : '—'}
          sub={t?.costUsd === null ? 'Tự lưu trữ (Ollama)' : undefined}
          color="bg-warning" />
        <KpiCard icon={Users} label="User sử dụng AI" value={t ? String(t.activeUsers) : '—'}
          sub="người dùng hoạt động" color="bg-info" />
      </div>

      {/* Line Chart — daily usage */}
      {data && data.dailyUsage.length > 0 && (
        <div className="bg-surface rounded-xl border border-default shadow-card p-4">
          <h2 className="text-[13px] font-medium text-content mb-3">Lưu lượng theo ngày</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data.dailyUsage.map((d) => ({ ...d, dateLabel: formatDate(d.date) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #e5e7eb)" />
              <XAxis dataKey="dateLabel" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }}
                tickFormatter={(v) => fmtTokens(v)} />
              <Tooltip
                formatter={(value, name) => {
                  if (name === 'Tokens') return [fmtTokens(Number(value)), name];
                  return [value, name];
                }}
                labelStyle={{ fontSize: 11 }}
                contentStyle={{ fontSize: 11 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line yAxisId="left"  type="monotone" dataKey="requests"    name="Yêu cầu"  stroke="#1a56db" strokeWidth={2} dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="totalTokens" name="Tokens"   stroke="#0e9f6e" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Bar + Pie row */}
      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Top users — horizontal bar */}
          <div className="lg:col-span-2 bg-surface rounded-xl border border-default shadow-card p-4">
            <h2 className="text-[13px] font-medium text-content mb-3">Top user sử dụng nhiều nhất</h2>
            {data.topUsers.length === 0 ? (
              <p className="text-[12px] text-faint text-center py-8">Chưa có dữ liệu</p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(160, data.topUsers.length * 30)}>
                <BarChart data={data.topUsers.slice(0, 8).map((u) => ({ name: u.fullName, tokens: u.totalTokens, requests: u.requests }))}
                  layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #e5e7eb)" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => fmtTokens(v)} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                  <Tooltip
                    formatter={(v, n) => n === 'tokens' ? [fmtTokens(Number(v)), 'Tokens'] : [v, 'Yêu cầu']}
                    contentStyle={{ fontSize: 11 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="tokens" name="Tokens" fill="#1a56db" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Feature breakdown — pie */}
          <div className="bg-surface rounded-xl border border-default shadow-card p-4">
            <h2 className="text-[13px] font-medium text-content mb-3">Phân loại tính năng</h2>
            {data.featureBreakdown.length === 0 ? (
              <p className="text-[12px] text-faint text-center py-8">Chưa có dữ liệu</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={data.featureBreakdown} dataKey="requests" nameKey="feature"
                      cx="50%" cy="50%" outerRadius={65} innerRadius={35}>
                      {data.featureBreakdown.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v, name) => [v, FEATURE_LABELS[String(name)] ?? name]}
                      contentStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 mt-2">
                  {data.featureBreakdown.map((f, i) => (
                    <div key={f.feature} className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="text-subtle">{FEATURE_LABELS[f.feature] ?? f.feature}</span>
                      </div>
                      <span className="font-medium text-content">{f.pct}%</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Recent logs table */}
      {data && (
        <div className="bg-surface rounded-xl border border-default shadow-card overflow-hidden">
          <div className="px-4 py-3 border-b border-default">
            <h2 className="text-[13px] font-medium text-content">Lịch sử gần đây</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-muted border-b border-default text-left">
                  <th className="px-4 py-2.5 text-subtle font-medium">Thời gian</th>
                  <th className="px-4 py-2.5 text-subtle font-medium">User</th>
                  <th className="px-4 py-2.5 text-subtle font-medium">Tính năng</th>
                  <th className="px-4 py-2.5 text-subtle font-medium">Model</th>
                  <th className="px-4 py-2.5 text-subtle font-medium text-right">Tokens</th>
                  <th className="px-4 py-2.5 text-subtle font-medium text-right">Chi phí</th>
                  <th className="px-4 py-2.5 text-subtle font-medium text-right">Latency</th>
                  <th className="px-4 py-2.5 text-subtle font-medium text-center">TT</th>
                </tr>
              </thead>
              <tbody>
                {data.recentLogs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-faint">Chưa có dữ liệu trong kỳ này</td>
                  </tr>
                ) : data.recentLogs.map((log) => (
                  <tr key={log.id} className="border-b border-default last:border-0 hover:bg-muted/40 transition-colors">
                    <td className="px-4 py-2 text-subtle whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-2 text-content">{log.userName ?? <span className="text-faint italic">Hệ thống</span>}</td>
                    <td className="px-4 py-2">
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-primary-tint text-primary font-medium">
                        {FEATURE_LABELS[log.feature] ?? log.feature}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-subtle font-mono text-[11px]">{log.modelName}</td>
                    <td className="px-4 py-2 text-right text-content font-medium">{fmtTokens(log.totalTokens)}</td>
                    <td className="px-4 py-2 text-right text-subtle">{fmtCost(log.costUsd)}</td>
                    <td className="px-4 py-2 text-right text-subtle">
                      {log.durationMs !== null ? (
                        <span className="flex items-center justify-end gap-1">
                          <Clock size={10} />
                          {log.durationMs >= 1000 ? `${(log.durationMs / 1000).toFixed(1)}s` : `${log.durationMs}ms`}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-2 text-center">
                      {log.status === 'success'
                        ? <CheckCircle size={14} className="text-success mx-auto" />
                        : <XCircle size={14} className="text-danger mx-auto" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!data && !loading && (
        <div className="bg-surface rounded-xl border border-default shadow-card p-8 text-center text-[12px] text-faint">
          Không có dữ liệu
        </div>
      )}
    </div>
  );
}
