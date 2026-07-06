'use client';

import React, { useEffect, useState } from 'react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

interface QuestionCategory { id: string; name: string; color?: string | null }

interface Question {
  id: string;
  type: string;
  difficulty: string;
  questionText: string;
  options: { key: string; text: string }[];
  correctAnswer: string;
  tags: string[];
  status: string;
  reviewComment: string | null;
  scorePoints: number;
  categoryId: string | null;
  category: { id: string; name: string; color?: string | null } | null;
  createdBy: { fullName: string };
}

interface QuestionListProps {
  bankId: string;
  accessToken: string;
  onEdit: (q: Question) => void;
  refreshTrigger?: number;
  categories?: QuestionCategory[];
}

const DIFFICULTY_BADGE: Record<string, string> = {
  easy:   'bg-green-100 text-green-700',
  medium: 'bg-yellow-100 text-yellow-700',
  hard:   'bg-red-100 text-red-700',
};

const STATUS_BADGE: Record<string, string> = {
  draft:    'bg-gray-100 text-gray-600',
  review:   'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

const STATUS_LABEL: Record<string, string> = {
  draft: 'Nháp', review: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Từ chối',
};

const TYPE_LABEL: Record<string, string> = {
  single_choice: 'Một đáp án',
  multi_choice: 'Nhiều đáp án',
  true_false: 'Đúng/Sai',
  fill_blank: 'Điền chỗ trống',
};

export function QuestionList({ bankId, accessToken, onEdit, refreshTrigger, categories = [] }: QuestionListProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ type: '', difficulty: '', status: '', search: '', categoryId: '' });
  const [page, setPage] = useState(1);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; qId: string }>({ open: false, qId: '' });
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; qId: string; comment: string }>({ open: false, qId: '', comment: '' });

  const fetchQuestions = async () => {
    setLoading(true);
    const sp = new URLSearchParams();
    if (filters.type) sp.set('type', filters.type);
    if (filters.difficulty) sp.set('difficulty', filters.difficulty);
    if (filters.status) sp.set('status', filters.status);
    if (filters.search) sp.set('search', filters.search);
    if (filters.categoryId) sp.set('categoryId', filters.categoryId);
    sp.set('page', String(page));
    sp.set('limit', '20');

    const res = await fetch(`/api/question-banks/${bankId}/questions?${sp}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const json = await res.json();
    if (json.success) { setQuestions(json.data); setTotal(json.meta.total); }
    setLoading(false);
  };

  useEffect(() => { fetchQuestions(); }, [filters, page, refreshTrigger]);

  const handleAction = async (qId: string, action: string, comment?: string) => {
    const body: Record<string, string> = { action };
    if (comment) body.comment = comment;
    await fetch(`/api/question-banks/${bankId}/questions/${qId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(body),
    });
    fetchQuestions();
  };

  const handleDelete = async (qId: string) => {
    await fetch(`/api/question-banks/${bankId}/questions/${qId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    fetchQuestions();
  };

  return (
    <>
    <ConfirmDialog
      open={deleteDialog.open}
      title="Xóa câu hỏi này?"
      message="Thao tác này không thể hoàn tác."
      confirmLabel="Xóa"
      onConfirm={() => { handleDelete(deleteDialog.qId); setDeleteDialog({ open: false, qId: '' }); }}
      onCancel={() => setDeleteDialog({ open: false, qId: '' })}
    />
    <ConfirmDialog
      open={rejectDialog.open}
      title="Từ chối câu hỏi"
      confirmLabel="Từ chối"
      confirmClass="flex-1 px-4 py-2 text-[12px] font-medium rounded-lg text-white transition-colors disabled:opacity-50 bg-danger hover:bg-danger/90"
      inputLabel="Lý do từ chối"
      inputPlaceholder="Nhập lý do từ chối..."
      inputRequired
      onConfirm={(comment) => {
        handleAction(rejectDialog.qId, 'reject', comment);
        setRejectDialog({ open: false, qId: '', comment: '' });
      }}
      onCancel={() => setRejectDialog({ open: false, qId: '', comment: '' })}
    />
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <input
          type="text"
          placeholder="Tìm câu hỏi..."
          value={filters.search}
          onChange={(e) => { setFilters({ ...filters, search: e.target.value }); setPage(1); }}
          className="border rounded px-3 py-1.5 text-sm flex-1 min-w-[160px]"
        />
        {[
          { key: 'type', options: [['', 'Tất cả loại'], ['single_choice', 'Một đáp án'], ['multi_choice', 'Nhiều đáp án'], ['true_false', 'Đúng/Sai'], ['fill_blank', 'Điền chỗ']] },
          { key: 'difficulty', options: [['', 'Tất cả độ khó'], ['easy', 'Dễ'], ['medium', 'Trung bình'], ['hard', 'Khó']] },
          { key: 'status', options: [['', 'Tất cả trạng thái'], ['draft', 'Nháp'], ['review', 'Chờ duyệt'], ['approved', 'Đã duyệt'], ['rejected', 'Từ chối']] },
        ].map(({ key, options }) => (
          <select key={key} value={(filters as Record<string, string>)[key]}
            onChange={(e) => { setFilters({ ...filters, [key]: e.target.value }); setPage(1); }}
            className="border rounded px-2 py-1.5 text-sm">
            {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        ))}
        {/* Category filter */}
        {categories.length > 0 && (
          <select
            value={filters.categoryId}
            onChange={(e) => { setFilters({ ...filters, categoryId: e.target.value }); setPage(1); }}
            className="border rounded px-2 py-1.5 text-sm"
          >
            <option value="">Tất cả danh mục</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
        <span className="text-xs text-muted-foreground self-center ml-auto">{total} câu hỏi</span>
      </div>

      {/* List */}
      {loading ? (
        <div className="py-8 text-center text-muted-foreground text-sm">Đang tải...</div>
      ) : questions.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground text-sm">Không có câu hỏi nào</div>
      ) : (
        <div className="divide-y border rounded-lg overflow-hidden">
          {questions.map((q) => (
            <div key={q.id} className="p-4 hover:bg-gray-50">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 line-clamp-2">{q.questionText}</p>
                  <div className="flex gap-2 mt-1.5 flex-wrap items-center">
                    <span className="text-xs text-muted-foreground">{TYPE_LABEL[q.type] ?? q.type}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${DIFFICULTY_BADGE[q.difficulty] ?? 'bg-gray-100'}`}>
                      {q.difficulty}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_BADGE[q.status] ?? 'bg-gray-100'}`}>
                      {STATUS_LABEL[q.status] ?? q.status}
                    </span>
                    {q.category && (
                      <span
                        className="text-xs px-1.5 py-0.5 rounded font-medium"
                        style={{
                          backgroundColor: q.category.color ? `${q.category.color}20` : '#f3f4f6',
                          color: q.category.color ?? '#6b7280',
                          border: `1px solid ${q.category.color ?? '#e5e7eb'}`,
                        }}
                      >
                        {q.category.name}
                      </span>
                    )}
                    {q.tags.map((t) => (
                      <span key={t} className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{t}</span>
                    ))}
                  </div>
                  {q.status === 'rejected' && q.reviewComment && (
                    <p className="text-xs text-red-600 mt-1">Lý do: {q.reviewComment}</p>
                  )}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  {q.status === 'draft' && (
                    <button onClick={() => handleAction(q.id, 'submit_review')}
                      className="text-xs px-2 py-1 border rounded hover:bg-gray-50 text-blue-600">Gửi duyệt</button>
                  )}
                  {q.status === 'review' && (
                    <>
                      <button onClick={() => handleAction(q.id, 'approve')}
                        className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700">Duyệt</button>
                      <button onClick={() => setRejectDialog({ open: true, qId: q.id, comment: '' })}
                        className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700">Từ chối</button>
                    </>
                  )}
                  <button onClick={() => onEdit(q)}
                    className="text-xs px-2 py-1 border rounded hover:bg-gray-50">Sửa</button>
                  <button onClick={() => setDeleteDialog({ open: true, qId: q.id })}
                    className="text-xs px-2 py-1 text-red-500 border border-red-200 rounded hover:bg-red-50">Xóa</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > 20 && (
        <div className="flex gap-2 justify-center">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1.5 text-sm border rounded disabled:opacity-40">‹ Trước</button>
          <span className="text-sm py-1.5">Trang {page} / {Math.ceil(total / 20)}</span>
          <button onClick={() => setPage((p) => p + 1)} disabled={page >= Math.ceil(total / 20)}
            className="px-3 py-1.5 text-sm border rounded disabled:opacity-40">Sau ›</button>
        </div>
      )}
    </div>
    </>
  );
}
