'use client';

import React, { useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import useSWR from 'swr';

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
  GAP_ANALYZED: 'Đã phân tích',
  PENDING_APPROVAL: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  ENROLLED: 'Đã đăng ký lộ trình',
  COMPLETED: 'Hoàn thành',
};
const STATUS_COLORS: Record<string, string> = {
  PENDING_GAP_ANALYSIS: 'bg-gray-100 text-gray-600',
  GAP_ANALYZED: 'bg-blue-100 text-blue-700',
  PENDING_APPROVAL: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-green-100 text-green-700',
  ENROLLED: 'bg-purple-100 text-purple-700',
  COMPLETED: 'bg-green-200 text-green-800',
};

export default function PositionChangesPage() {
  const { accessToken, user } = useAuth();
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
    const res = await fetch(`/api/position-changes/${eventId}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const json = await res.json();
    if (!json.success) alert('Lỗi: ' + json.error);
    await mutate();
    setApproving(null);
  };

  const readinessColor = (score: number) =>
    score >= 80 ? 'text-green-600' : score >= 50 ? 'text-orange-500' : 'text-red-500';

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Đổi vị trí & Gap Analysis</h1>
          <p className="text-sm text-muted-foreground mt-1">Quản lý sự kiện chuyển vị trí và kết quả phân tích năng lực</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {['', 'PENDING_APPROVAL', 'GAP_ANALYZED', 'APPROVED', 'ENROLLED'].map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`text-sm px-3 py-1.5 rounded-full border ${statusFilter === s ? 'bg-blue-600 text-white border-blue-600' : 'hover:bg-gray-50'}`}>
            {s ? STATUS_LABELS[s] : 'Tất cả'}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-3">
        {events.map((ev) => (
          <div key={ev.id} className="border rounded-xl overflow-hidden">
            <div
              className="p-4 flex items-start gap-4 cursor-pointer hover:bg-gray-50"
              onClick={() => setExpandedId(expandedId === ev.id ? null : ev.id)}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{ev.user.fullName}</span>
                  <span className="text-xs text-muted-foreground">{ev.user.employeeCode ?? ev.user.email}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[ev.status]}`}>
                    {STATUS_LABELS[ev.status]}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {ev.fromPosition ? ev.fromPosition.title : 'Chưa có vị trí'}
                  {' → '}
                  <span className="font-medium text-foreground">{ev.toPosition.title}</span>
                </div>
                <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                  <span>Thực hiện: {new Date(ev.effectiveDate).toLocaleDateString('vi-VN')}</span>
                  <span>Bởi: {ev.changedBy.fullName}</span>
                  {ev.gapAnalysisResult && (
                    <span className={`font-medium ${readinessColor(ev.gapAnalysisResult.overallReadinessScore)}`}>
                      Sẵn sàng: {ev.gapAnalysisResult.overallReadinessScore}%
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                {ev.status === 'PENDING_APPROVAL' && (
                  <button onClick={(e) => { e.stopPropagation(); handleApprove(ev.id); }}
                    disabled={approving === ev.id}
                    className="text-xs px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">
                    {approving === ev.id ? 'Đang duyệt...' : 'Duyệt & Đăng ký'}
                  </button>
                )}
                <span className="text-gray-400 text-sm">{expandedId === ev.id ? '▲' : '▼'}</span>
              </div>
            </div>

            {/* Expanded gap analysis */}
            {expandedId === ev.id && ev.gapAnalysisResult && (
              <div className="border-t p-4 bg-gray-50 space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-white rounded-lg p-3 text-center border">
                    <div className={`text-2xl font-bold ${readinessColor(ev.gapAnalysisResult.overallReadinessScore)}`}>
                      {ev.gapAnalysisResult.overallReadinessScore}%
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Độ sẵn sàng</div>
                  </div>
                  <div className="bg-white rounded-lg p-3 text-center border">
                    <div className="text-2xl font-bold text-green-600">{ev.gapAnalysisResult.metCount}</div>
                    <div className="text-xs text-muted-foreground mt-1">Năng lực đạt</div>
                  </div>
                  <div className="bg-white rounded-lg p-3 text-center border">
                    <div className="text-2xl font-bold text-red-500">
                      {ev.gapAnalysisResult.totalCompetencies - ev.gapAnalysisResult.metCount}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Cần phát triển</div>
                  </div>
                </div>

                {ev.gapAnalysisResult.gapItems.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Các năng lực cần phát triển:</p>
                    <div className="space-y-1.5">
                      {ev.gapAnalysisResult.gapItems.map((gap, i) => (
                        <div key={i} className="flex items-center gap-3 bg-white rounded p-2 border text-sm">
                          <span className="flex-1">{gap.competencyName}</span>
                          <span className="text-xs text-red-500 font-medium">Thiếu {gap.gap} cấp</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {ev.notes && (
                  <p className="text-sm text-muted-foreground">Ghi chú: {ev.notes}</p>
                )}
              </div>
            )}
          </div>
        ))}

        {events.length === 0 && data && (
          <div className="text-center py-12 text-muted-foreground">Không có sự kiện đổi vị trí nào</div>
        )}
        {!data && (
          <div className="text-center py-12 text-muted-foreground">Đang tải...</div>
        )}
      </div>
    </div>
  );
}
