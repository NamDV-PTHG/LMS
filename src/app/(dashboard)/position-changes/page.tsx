'use client';

import React, { useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { useToast } from '@/components/ui/toast';
import useSWR from 'swr';
import { Clock } from 'lucide-react';

const fetcher = (url: string, token: string) =>
  fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());

interface PositionChangeEvent {
  id: string;
  status: string;
  changedAt: string;
  effectiveDate: string;
  notes?: string;
  gapAnalysisResult?: {
    overallReadinessScore: number;
    totalCompetencies: number;
    metCount: number;
    gapItems: { competencyName: string; gap: number }[];
  };
  user: { id: string; fullName: string; email: string; employeeCode?: string };
  fromPosition?: { id: string; title: string; code?: string };
  toPosition: { id: string; title: string; code?: string };
  changedBy: { id: string; fullName: string };
}

const STATUS_LABELS: Record<string, string> = {
  PENDING_GAP_ANALYSIS: 'Đang phân tích',
  GAP_ANALYZED: 'Đã phân tích — Chờ duyệt',
  PENDING_APPROVAL: 'Chờ duyệt',
  PENDING_EFFECTIVE: 'Chờ ngày hiệu lực',
  APPROVED: 'Đã duyệt',
  ENROLLED: 'Đã đăng ký lộ trình',
  COMPLETED: 'Hoàn thành',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING_GAP_ANALYSIS: 'bg-gray-100 text-gray-600',
  GAP_ANALYZED:         'bg-blue-100 text-blue-700',
  PENDING_APPROVAL:     'bg-yellow-100 text-yellow-700',
  PENDING_EFFECTIVE:    'bg-orange-100 text-orange-700',
  APPROVED:             'bg-green-100 text-green-700',
  ENROLLED:             'bg-purple-100 text-purple-700',
  COMPLETED:            'bg-green-200 text-green-800',
};

function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function PositionChangesPage() {
  const { accessToken } = useAuth();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [approving, setApproving] = useState<string | null>(null);

  const { data, mutate } = useSWR(
    accessToken ? [`/api/position-changes?${statusFilter ? `status=${statusFilter}` : ''}`, accessToken] : null,
    ([url, token]) => fetcher(url, token),
  );

  const events: PositionChangeEvent[] = data?.items ?? [];

  const handleApprove = async (eventId: string) => {
    setApproving(eventId);
    try {
      const res = await fetch(`/api/position-changes/${eventId}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json();
      if (!json.success) {
        toast('error', json.error ?? 'Duyệt thất bại');
      } else {
        toast('success', 'Đã duyệt thành công');
        await mutate();
      }
    } catch {
      toast('error', 'Lỗi kết nối');
    } finally {
      setApproving(null);
    }
  };

  const readinessColor = (score: number) =>
    score >= 80 ? 'text-green-600' : score >= 50 ? 'text-orange-500' : 'text-red-500';

  const canApprove = (status: string) =>
    status === 'PENDING_APPROVAL' || status === 'GAP_ANALYZED';

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div>
        <h1 className="text-[18px] font-medium text-content">Đổi vị trí & Gap Analysis</h1>
        <p className="text-[12px] text-subtle mt-1">Quản lý sự kiện chuyển vị trí và kết quả phân tích năng lực</p>
      </div>

      {/* Status filter */}
      <div className="flex gap-1.5 flex-wrap">
        {(['', 'PENDING_APPROVAL', 'GAP_ANALYZED', 'PENDING_EFFECTIVE', 'APPROVED', 'ENROLLED'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`text-[11px] px-3 py-1.5 rounded-full border transition-colors ${
              statusFilter === s
                ? 'bg-primary text-white border-primary'
                : 'bg-surface border-default text-subtle hover:bg-muted'
            }`}
          >
            {s ? STATUS_LABELS[s] : 'Tất cả'}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-2">
        {!data && (
          <div className="text-center py-12 text-[12px] text-faint">Đang tải...</div>
        )}
        {data && events.length === 0 && (
          <div className="text-center py-12 text-[12px] text-faint">Không có sự kiện đổi vị trí nào</div>
        )}

        {events.map((ev) => {
          const days = daysUntil(ev.effectiveDate);
          const isFutureEffective = days > 0;

          return (
            <div key={ev.id} className="bg-surface border border-default rounded-xl overflow-hidden shadow-card">
              <div
                className="p-4 flex items-start gap-4 cursor-pointer hover:bg-muted transition-colors"
                onClick={() => setExpandedId(expandedId === ev.id ? null : ev.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13px] font-medium text-content">{ev.user.fullName}</span>
                    <span className="text-[10px] text-faint">{ev.user.employeeCode ?? ev.user.email}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[ev.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {STATUS_LABELS[ev.status] ?? ev.status}
                    </span>
                  </div>
                  <div className="text-[12px] text-subtle mt-1">
                    <span className="text-faint">{ev.fromPosition?.title ?? 'Chưa có vị trí'}</span>
                    {' → '}
                    <span className="font-medium text-content">{ev.toPosition.title}</span>
                  </div>
                  <div className="flex gap-4 text-[11px] text-faint mt-1 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Clock size={10} />
                      Hiệu lực: {new Date(ev.effectiveDate).toLocaleDateString('vi-VN')}
                      {isFutureEffective && ev.status === 'PENDING_EFFECTIVE' && (
                        <span className="text-orange-500 font-medium ml-1">(còn {days} ngày)</span>
                      )}
                    </span>
                    <span>Bởi: {ev.changedBy.fullName}</span>
                    {ev.gapAnalysisResult && (
                      <span className={`font-medium ${readinessColor(ev.gapAnalysisResult.overallReadinessScore)}`}>
                        Sẵn sàng: {ev.gapAnalysisResult.overallReadinessScore}%
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 shrink-0 items-center">
                  {canApprove(ev.status) && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleApprove(ev.id); }}
                      disabled={approving === ev.id}
                      className="text-[11px] px-3 py-1.5 bg-success hover:bg-success/90 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                    >
                      {approving === ev.id ? 'Đang duyệt...' : 'Duyệt'}
                    </button>
                  )}
                  <span className="text-faint text-[11px]">{expandedId === ev.id ? '▲' : '▼'}</span>
                </div>
              </div>

              {/* Expanded gap analysis */}
              {expandedId === ev.id && ev.gapAnalysisResult && (
                <div className="border-t border-default p-4 bg-muted space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-surface rounded-xl p-3 text-center border border-default">
                      <div className={`text-[22px] font-medium ${readinessColor(ev.gapAnalysisResult.overallReadinessScore)}`}>
                        {ev.gapAnalysisResult.overallReadinessScore}%
                      </div>
                      <div className="text-[10px] text-faint mt-0.5">Độ sẵn sàng</div>
                    </div>
                    <div className="bg-surface rounded-xl p-3 text-center border border-default">
                      <div className="text-[22px] font-medium text-success">{ev.gapAnalysisResult.metCount}</div>
                      <div className="text-[10px] text-faint mt-0.5">Năng lực đạt</div>
                    </div>
                    <div className="bg-surface rounded-xl p-3 text-center border border-default">
                      <div className="text-[22px] font-medium text-danger">
                        {ev.gapAnalysisResult.totalCompetencies - ev.gapAnalysisResult.metCount}
                      </div>
                      <div className="text-[10px] text-faint mt-0.5">Cần phát triển</div>
                    </div>
                  </div>

                  {ev.gapAnalysisResult.gapItems.length > 0 && (
                    <div>
                      <p className="text-[12px] font-medium text-content mb-2">Năng lực cần phát triển:</p>
                      <div className="space-y-1">
                        {ev.gapAnalysisResult.gapItems.map((gap, i) => (
                          <div key={i} className="flex items-center gap-3 bg-surface rounded-lg px-3 py-2 border border-default text-[12px]">
                            <span className="flex-1 text-subtle">{gap.competencyName}</span>
                            <span className="text-danger font-medium shrink-0">Thiếu {gap.gap} cấp</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {ev.notes && (
                    <p className="text-[12px] text-subtle">Ghi chú: {ev.notes}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
