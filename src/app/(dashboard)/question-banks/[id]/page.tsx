'use client';

import React, { useRef, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { useToast } from '@/components/ui/toast';
import { QuestionList } from '@/components/question-bank/question-list';
import { QuestionForm } from '@/components/question-bank/question-form';
import { ImportDocumentModal } from '@/components/question-bank/import-document-modal';
import { ReviewQueue } from '@/components/question-bank/review-queue';
import useSWR from 'swr';

type Tab = 'all' | 'review' | 'create' | 'categories';

interface QuestionCategory {
  id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  competencyId?: string | null;
  competency?: { id: string; name: string } | null;
  questionCount: number;
}

const fetcher = (url: string, token: string) =>
  fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());

const COLOR_PRESETS = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#06B6D4', '#EC4899', '#6366F1'];

export default function QuestionBankDetailPage({ params }: { params: { id: string } }) {
  const { accessToken, user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>('all');
  const [showImport, setShowImport] = useState(false);
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Parameters<typeof QuestionForm>[0]['initial']>(undefined);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvDefaultCategoryId, setCsvDefaultCategoryId] = useState('');
  const [importingCsv, setImportingCsv] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Category management state
  const [categoryModal, setCategoryModal] = useState<{ open: boolean; editing?: QuestionCategory }>({ open: false });
  const [catForm, setCatForm] = useState({ name: '', description: '', color: '#3B82F6', competencyId: '' });
  const [catSaving, setCatSaving] = useState(false);

  const { data: catData, mutate: mutateCategories } = useSWR(
    accessToken ? ['/api/question-categories', accessToken] : null,
    ([url, token]) => fetcher(url, token),
  );
  const categories: QuestionCategory[] = catData?.data ?? [];

  const refresh = () => setRefreshTrigger((n) => n + 1);

  const handleDownloadTemplate = async () => {
    try {
      const res = await fetch(`/api/question-banks/${params.id}/import-csv`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) { toast('error', 'Không tải được file mẫu'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'question_bank_template.csv'; a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast('error', 'Lỗi kết nối server');
    }
  };

  const handleCsvImport = async () => {
    if (!csvFile) return;
    setImportingCsv(true);
    const fd = new FormData();
    fd.append('file', csvFile);
    if (csvDefaultCategoryId) fd.append('defaultCategoryId', csvDefaultCategoryId);
    try {
      const res = await fetch(`/api/question-banks/${params.id}/import-csv`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: fd,
      }).then((r) => r.json());

      if (res.success) {
        toast('success', `Import thành công ${res.data.imported} câu hỏi`);
        setShowCsvImport(false);
        setCsvFile(null);
        setCsvDefaultCategoryId('');
        refresh();
        setActiveTab('all');
      } else if (res.details?.length) {
        toast('error', res.error ?? 'Import thất bại');
        const preview = res.details.slice(0, 3).join('\n') + (res.details.length > 3 ? `\n...và ${res.details.length - 3} lỗi khác` : '');
        toast('warning', preview);
      } else {
        toast('error', res.error ?? 'Import thất bại');
      }
    } catch {
      toast('error', 'Lỗi kết nối server');
    } finally {
      setImportingCsv(false);
    }
  };

  const openCategoryModal = (cat?: QuestionCategory) => {
    setCategoryModal({ open: true, editing: cat });
    setCatForm({
      name: cat?.name ?? '',
      description: cat?.description ?? '',
      color: cat?.color ?? '#3B82F6',
      competencyId: cat?.competencyId ?? '',
    });
  };

  const handleSaveCategory = async () => {
    if (!catForm.name.trim()) { toast('error', 'Tên danh mục là bắt buộc'); return; }
    setCatSaving(true);
    try {
      const url = categoryModal.editing
        ? `/api/question-categories/${categoryModal.editing.id}`
        : '/api/question-categories';
      const method = categoryModal.editing ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          name: catForm.name.trim(),
          description: catForm.description.trim() || null,
          color: catForm.color || null,
          competencyId: catForm.competencyId || null,
        }),
      }).then((r) => r.json());

      if (res.success) {
        toast('success', categoryModal.editing ? 'Đã cập nhật danh mục' : 'Đã tạo danh mục');
        setCategoryModal({ open: false });
        mutateCategories();
      } else {
        toast('error', res.error ?? 'Lỗi lưu danh mục');
      }
    } catch {
      toast('error', 'Lỗi kết nối server');
    } finally {
      setCatSaving(false);
    }
  };

  const handleDeleteCategory = async (cat: QuestionCategory) => {
    if (cat.questionCount > 0) {
      toast('error', `Không thể xóa: danh mục đang có ${cat.questionCount} câu hỏi`);
      return;
    }
    const res = await fetch(`/api/question-categories/${cat.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    }).then((r) => r.json());
    if (res.success) {
      toast('success', 'Đã xóa danh mục');
      mutateCategories();
    } else {
      toast('error', res.error ?? 'Lỗi xóa danh mục');
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Ngân hàng câu hỏi</h1>
        <div className="flex gap-2">
          <button
            onClick={handleDownloadTemplate}
            className="px-3 py-2 text-sm border rounded hover:bg-gray-50 flex items-center gap-1 text-blue-600 border-blue-300"
          >
            ↓ Mẫu CSV
          </button>
          <button
            onClick={() => { setShowCsvImport(true); setCsvFile(null); }}
            className="px-3 py-2 text-sm border rounded hover:bg-gray-50 flex items-center gap-1"
          >
            📥 Import CSV
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="px-3 py-2 text-sm border rounded hover:bg-gray-50 flex items-center gap-1"
          >
            🤖 Nhập từ tài liệu AI
          </button>
          <button
            onClick={() => { setEditingQuestion(undefined); setActiveTab('create'); }}
            className="px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
          >
            + Thêm câu hỏi
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {(['all', 'review', 'create', 'categories'] as Tab[]).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {tab === 'all' ? 'Tất cả câu hỏi'
              : tab === 'review' ? '⏳ Chờ duyệt'
              : tab === 'create' ? '+ Tạo mới'
              : `🏷️ Danh mục năng lực${categories.length ? ` (${categories.length})` : ''}`}
          </button>
        ))}
      </div>

      {activeTab === 'all' && (
        <QuestionList
          bankId={params.id}
          accessToken={accessToken!}
          refreshTrigger={refreshTrigger}
          categories={categories}
          userId={user?.id}
          onEdit={(q) => {
            setEditingQuestion({
              id: q.id,
              type: q.type as Parameters<typeof QuestionForm>[0]['initial'] extends { type: infer T } ? T : never,
              difficulty: q.difficulty as 'easy' | 'medium' | 'hard',
              questionText: q.questionText,
              options: q.options,
              correctAnswer: q.correctAnswer,
              explanation: (q as unknown as Record<string, unknown>).explanation as string ?? '',
              tags: q.tags.join(', '),
              scorePoints: q.scorePoints,
              categoryId: q.categoryId ?? '',
            });
            setActiveTab('create');
          }}
        />
      )}

      {activeTab === 'review' && (
        <ReviewQueue bankId={params.id} accessToken={accessToken!} onReviewed={refresh} />
      )}

      {activeTab === 'create' && (
        <div className="border rounded-xl p-6">
          <h2 className="font-semibold text-gray-900 mb-4">
            {editingQuestion?.id ? 'Chỉnh sửa câu hỏi' : 'Tạo câu hỏi mới'}
          </h2>
          <QuestionForm
            bankId={params.id}
            accessToken={accessToken!}
            initial={editingQuestion}
            categories={categories}
            onSaved={() => { refresh(); setActiveTab('all'); setEditingQuestion(undefined); }}
            onCancel={() => { setActiveTab('all'); setEditingQuestion(undefined); }}
          />
        </div>
      )}

      {/* Categories Tab */}
      {activeTab === 'categories' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Phân loại câu hỏi theo nhóm năng lực — giúp lọc và đo lường tự động qua quiz</p>
            <button
              onClick={() => openCategoryModal()}
              className="px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
            >
              + Thêm danh mục
            </button>
          </div>

          {categories.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm border rounded-xl">
              Chưa có danh mục năng lực nào. Tạo danh mục để phân loại câu hỏi.
            </div>
          ) : (
            <div className="divide-y border rounded-xl overflow-hidden">
              {categories.map((cat) => (
                <div key={cat.id} className="px-5 py-4 flex items-center gap-4 hover:bg-gray-50">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: cat.color ?? '#9CA3AF' }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900">{cat.name}</p>
                      {cat.competency && (
                        <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">
                          → {cat.competency.name}
                        </span>
                      )}
                    </div>
                    {cat.description && <p className="text-xs text-gray-500 mt-0.5">{cat.description}</p>}
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">{cat.questionCount} câu hỏi</span>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => openCategoryModal(cat)}
                      className="text-xs px-2 py-1 border rounded hover:bg-gray-100"
                    >
                      Sửa
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(cat)}
                      className="text-xs px-2 py-1 text-red-500 border border-red-200 rounded hover:bg-red-50"
                    >
                      Xóa
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Category Modal */}
      {categoryModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl">
            <div className="px-6 py-5 border-b flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">
                {categoryModal.editing ? 'Chỉnh sửa danh mục' : 'Thêm danh mục năng lực'}
              </h2>
              <button onClick={() => setCategoryModal({ open: false })} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Tên danh mục *</label>
                <input
                  type="text"
                  value={catForm.name}
                  onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
                  placeholder="Năng lực Quản trị, Năng lực Kỹ thuật..."
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Mô tả (tùy chọn)</label>
                <input
                  type="text"
                  value={catForm.description}
                  onChange={(e) => setCatForm({ ...catForm, description: e.target.value })}
                  placeholder="Mô tả ngắn về danh mục..."
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-2">Màu sắc</label>
                <div className="flex gap-2 flex-wrap">
                  {COLOR_PRESETS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCatForm({ ...catForm, color: c })}
                      className={`w-7 h-7 rounded-full border-2 transition-transform ${catForm.color === c ? 'border-gray-900 scale-110' : 'border-transparent'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setCategoryModal({ open: false })}
                  className="flex-1 border rounded-lg px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Hủy
                </button>
                <button
                  onClick={handleSaveCategory}
                  disabled={catSaving}
                  className="flex-1 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  {catSaving ? 'Đang lưu...' : categoryModal.editing ? 'Cập nhật' : 'Tạo danh mục'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Import Modal */}
      {showImport && (
        <ImportDocumentModal
          bankId={params.id}
          accessToken={accessToken!}
          categories={categories}
          onClose={() => setShowImport(false)}
          onImported={() => { refresh(); setActiveTab('review'); }}
        />
      )}

      {/* CSV Import Modal */}
      {showCsvImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl">
            <div className="px-6 py-5 border-b flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Import câu hỏi từ CSV</h2>
              <button onClick={() => setShowCsvImport(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                Tải file mẫu, điền câu hỏi theo format CSV, rồi import vào ngân hàng.
              </p>

              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                ↓ Tải file mẫu CSV
              </button>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Danh mục năng lực mặc định</label>
                {categories.length === 0 ? (
                  <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                    Chưa có danh mục nào. Vào tab <strong>Danh mục</strong> để tạo trước.
                  </p>
                ) : (
                  <select
                    value={csvDefaultCategoryId}
                    onChange={(e) => setCsvDefaultCategoryId(e.target.value)}
                    className="w-full border rounded px-3 py-2 text-sm"
                  >
                    <option value="">-- Dùng cột category trong file CSV --</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  Nếu chọn ở đây, tất cả câu hỏi sẽ được gán vào danh mục này (ưu tiên hơn cột category trong CSV)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Chọn file CSV đã điền</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border file:border-gray-300 file:text-sm file:bg-gray-50 hover:file:bg-gray-100"
                />
              </div>

              <div className="bg-blue-50 rounded-lg px-3 py-2 text-xs text-blue-700 space-y-1">
                <p className="font-medium">Cột trong file CSV:</p>
                <p>question, type, option_a…d, correct_answer, difficulty, explanation, points, <strong>category</strong></p>
                <p>category: tên danh mục năng lực (tùy chọn)</p>
                <p>type: <code>single_choice</code> | <code>true_false</code> | <code>fill_blank</code></p>
                <p>difficulty: <code>easy</code> | <code>medium</code> | <code>hard</code></p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCsvImport(false)}
                  className="flex-1 rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={!csvFile || importingCsv}
                  onClick={handleCsvImport}
                  className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {importingCsv ? 'Đang import...' : 'Import'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
