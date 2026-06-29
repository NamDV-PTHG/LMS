'use client';

import { useAuth } from '@/components/providers/auth-provider';
import { useEffect, useState, useCallback } from 'react';

interface SystemInfo {
  platform: string;
  nodeVersion: string;
  uptimeSeconds: number;
  memory: {
    totalMB: number;
    usedMB: number;
    freeMB: number;
    usedPct: number;
    processMB: number;
    heapUsedMB: number;
    heapTotalMB: number;
  };
}

interface CompanyStat {
  id: string;
  name: string;
  code: string;
  users: number;
  onlineNow: number;
  enrollments: number;
  completed: number;
}

interface OperationsData {
  system: SystemInfo;
  online: { total: number; windowMinutes: number };
  stats: {
    totalUsers: number;
    activeUsers: number;
    totalCourses: number;
    totalEnrollments: number;
    completedEnrollments: number;
  };
  companies: CompanyStat[];
  generatedAt: string;
}

const REFRESH_INTERVAL = 30; // seconds

function fmtUptime(sec: number) {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function MemBar({ pct, color = 'bg-blue-500' }: { pct: number; color?: string }) {
  const c = pct > 85 ? 'bg-red-500' : pct > 65 ? 'bg-amber-500' : color;
  return (
    <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-500 ${c}`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

function StatCard({ label, value, sub, color = 'text-gray-900' }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-white border rounded-xl p-5 space-y-1">
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
      <p className={`text-3xl font-bold ${color}`}>{value.toLocaleString()}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

export default function OperationsPage() {
  const { accessToken } = useAuth();
  const [data, setData] = useState<OperationsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const [lastRefresh, setLastRefresh] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/operations', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        setLastRefresh(new Date().toLocaleTimeString('vi-VN'));
        setError('');
      } else {
        setError(json.error ?? 'Lỗi tải dữ liệu');
      }
    } catch {
      setError('Không thể kết nối API');
    } finally {
      setLoading(false);
      setCountdown(REFRESH_INTERVAL);
    }
  }, [accessToken]);

  // Initial fetch
  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-refresh every REFRESH_INTERVAL seconds
  useEffect(() => {
    const interval = setInterval(() => fetchData(), REFRESH_INTERVAL * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Countdown ticker
  useEffect(() => {
    const tick = setInterval(() => setCountdown((c) => (c > 0 ? c - 1 : REFRESH_INTERVAL)), 1000);
    return () => clearInterval(tick);
  }, []);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
          <p className="font-semibold">Lỗi tải dữ liệu</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { system, online, stats, companies } = data;
  const maxUsers = Math.max(...companies.map((c) => c.users), 1);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Vận hành hệ thống</h1>
          <p className="text-sm text-gray-500 mt-0.5">Cập nhật lúc {lastRefresh} · tự làm mới sau {countdown}s</p>
        </div>
        <button
          onClick={fetchData}
          className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50 flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Làm mới
        </button>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard
          label="Đang online"
          value={online.total}
          sub={`Trong ${online.windowMinutes} phút qua`}
          color="text-green-600"
        />
        <StatCard label="Người dùng" value={stats.activeUsers} sub={`/ ${stats.totalUsers} tổng`} />
        <StatCard label="Khóa học" value={stats.totalCourses} />
        <StatCard label="Ghi danh" value={stats.totalEnrollments} />
        <StatCard
          label="Hoàn thành"
          value={`${stats.totalEnrollments > 0 ? Math.round((stats.completedEnrollments / stats.totalEnrollments) * 100) : 0}%`}
          sub={`${stats.completedEnrollments.toLocaleString()} khóa`}
        />
      </div>

      {/* System resources + server info */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Memory */}
        <div className="bg-white border rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-gray-800">Bộ nhớ hệ thống</h2>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">RAM hệ thống</span>
                <span className="font-medium">
                  {system.memory.usedMB.toLocaleString()} / {system.memory.totalMB.toLocaleString()} MB
                  <span className="text-gray-400 ml-1">({system.memory.usedPct}%)</span>
                </span>
              </div>
              <MemBar pct={system.memory.usedPct} />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Process Node.js (RSS)</span>
                <span className="font-medium">{system.memory.processMB} MB</span>
              </div>
              <MemBar pct={Math.round((system.memory.processMB / system.memory.totalMB) * 100)} color="bg-purple-500" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Heap V8</span>
                <span className="font-medium">{system.memory.heapUsedMB} / {system.memory.heapTotalMB} MB</span>
              </div>
              <MemBar
                pct={Math.round((system.memory.heapUsedMB / Math.max(system.memory.heapTotalMB, 1)) * 100)}
                color="bg-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Server info */}
        <div className="bg-white border rounded-xl p-5 space-y-3">
          <h2 className="font-semibold text-gray-800">Thông tin server</h2>
          <dl className="space-y-2 text-sm">
            {[
              ['Uptime', fmtUptime(system.uptimeSeconds)],
              ['Node.js', system.nodeVersion],
              ['Platform', system.platform],
              ['RAM trống', `${system.memory.freeMB.toLocaleString()} MB`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-gray-50 pb-1.5">
                <span className="text-gray-500">{k}</span>
                <span className="font-medium font-mono text-gray-800">{v}</span>
              </div>
            ))}
          </dl>

          <div className="pt-2">
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
              ${system.memory.usedPct < 70 ? 'bg-green-100 text-green-700' : system.memory.usedPct < 85 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${system.memory.usedPct < 70 ? 'bg-green-500' : system.memory.usedPct < 85 ? 'bg-amber-500' : 'bg-red-500'}`} />
              {system.memory.usedPct < 70 ? 'Hệ thống ổn định' : system.memory.usedPct < 85 ? 'RAM đang cao' : 'RAM nguy hiểm — cần xử lý'}
            </div>
          </div>
        </div>
      </div>

      {/* Company breakdown */}
      <div className="bg-white border rounded-xl p-5">
        <h2 className="font-semibold text-gray-800 mb-4">Theo công ty</h2>
        {companies.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Không có dữ liệu công ty</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b">
                  <th className="pb-2 font-medium">Công ty</th>
                  <th className="pb-2 font-medium text-right">Người dùng</th>
                  <th className="pb-2 font-medium text-center">Đang online</th>
                  <th className="pb-2 font-medium text-right">Ghi danh</th>
                  <th className="pb-2 font-medium text-right">Hoàn thành</th>
                  <th className="pb-2 font-medium w-32">Tỷ lệ hoàn thành</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {companies.map((c) => {
                  const pct = c.enrollments > 0 ? Math.round((c.completed / c.enrollments) * 100) : 0;
                  const barWidth = Math.round((c.users / maxUsers) * 100);
                  return (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="py-3 pr-4">
                        <p className="font-medium text-gray-900">{c.name}</p>
                        <p className="text-xs text-gray-400 font-mono">{c.code}</p>
                        <div className="mt-1 h-1 bg-gray-100 rounded-full overflow-hidden w-24">
                          <div className="h-full bg-blue-400 rounded-full" style={{ width: `${barWidth}%` }} />
                        </div>
                      </td>
                      <td className="py-3 text-right font-medium">{c.users.toLocaleString()}</td>
                      <td className="py-3 text-center">
                        {c.onlineNow > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                            {c.onlineNow}
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="py-3 text-right">{c.enrollments.toLocaleString()}</td>
                      <td className="py-3 text-right">{c.completed.toLocaleString()}</td>
                      <td className="py-3 pl-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-blue-500' : 'bg-gray-400'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 w-8 text-right">{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer */}
      <p className="text-xs text-gray-400 text-center">
        Online users = người dùng có request trong 15 phút qua · dữ liệu DB theo thời gian thực
      </p>
    </div>
  );
}
