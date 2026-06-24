'use client';

import React, { useRef, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { useToast } from '@/components/ui/toast';
import { QuestionList } from '@/components/question-bank/question-list';
import { QuestionForm } from '@/components/question-bank/question-form';
import { ImportDocumentModal } from '@/components/question-bank/import-document-modal';
import { ReviewQueue } from '@/components/question-bank/review-queue';

type Tab = 'all' | 'review' | 'create';

export default function QuestionBankDetailPage({ params }: { params: { id: string } }) {
  const { accessToken } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>('all');
  const [showImport, setShowImport] = useState(false);
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Parameters<typeof QuestionForm>[0]['initial']>(undefined);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importingCsv, setImportingCsv] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        refresh();
        setActiveTab('all');
      } else if (res.details?.length) {
        toast('error', res.error ?? 'Import thất bại');
        // Show first few errors
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
        {(['all', 'review', 'create'] as Tab[]).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {tab === 'all' ? 'Tất cả câu hỏi' : tab === 'review' ? '⏳ Chờ duyệt' : '+ Tạo mới'}
          </button>
        ))}
      </div>

      {activeTab === 'all' && (
        <QuestionList
          bankId={params.id}
          accessToken={accessToken!}
          refreshTrigger={refreshTrigger}
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
            onSaved={() => { refresh(); setActiveTab('all'); setEditingQuestion(undefined); }}
            onCancel={() => { setActiveTab('all'); setEditingQuestion(undefined); }}
          />
        </div>
      )}

      {/* AI Import Modal */}
      {showImport && (
        <ImportDocumentModal
          bankId={params.id}
          accessToken={accessToken!}
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
                <p>question, type, option_a…d, correct_answer, difficulty, explanation, points</p>
                <p>type: <code>single_choice</code> | <code>true_false</code> | <code>fill_blank</code></p>
                <p>correct_answer: A/B/C/D (single_choice), true/false (true_false), text (fill_blank)</p>
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
