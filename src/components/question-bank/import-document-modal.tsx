'use client';

import React, { useEffect, useRef, useState } from 'react';

interface ImportDocumentModalProps {
  bankId: string;
  accessToken: string;
  onClose: () => void;
  onImported: () => void;
}

type Stage = 'upload' | 'processing' | 'done' | 'error';

export function ImportDocumentModal({ bankId, accessToken, onClose, onImported }: ImportDocumentModalProps) {
  const [stage, setStage] = useState<Stage>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [questionTypes, setQuestionTypes] = useState({ mcq: true, true_false: true, fill_blank: false });
  const [difficulty, setDifficulty] = useState('medium');
  const [questionsPerChunk, setQuestionsPerChunk] = useState(3);
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState({ status: 'pending', questionsGenerated: 0, error: '' });
  const [uploading, setUploading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  const stopPoll = () => { if (pollRef.current) clearInterval(pollRef.current); };

  useEffect(() => {
    if (!jobId || stage !== 'processing') return;

    pollRef.current = setInterval(async () => {
      const res = await fetch(`/api/question-banks/${bankId}/import-jobs/${jobId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json();
      if (!json.success) return;
      const job = json.data;

      setProgress({
        status: job.status,
        questionsGenerated: job.questionsGenerated,
        error: job.errorMessage ?? '',
      });

      if (job.status === 'completed') {
        setStage('done');
        stopPoll();
        onImported();
      } else if (job.status === 'failed') {
        setStage('error');
        stopPoll();
      }
    }, 3000);

    return stopPoll;
  }, [jobId, stage]);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);

    const types = Object.entries(questionTypes)
      .filter(([, v]) => v)
      .map(([k]) => k)
      .join(',');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('questionTypes', types);
    formData.append('difficulty', difficulty);
    formData.append('questionsPerChunk', String(questionsPerChunk));

    const res = await fetch(`/api/question-banks/${bankId}/import-document`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    });
    const json = await res.json();
    setUploading(false);

    if (json.success) {
      setJobId(json.data.jobId);
      setStage('processing');
    } else {
      setProgress({ status: 'failed', questionsGenerated: 0, error: json.error ?? 'Lỗi upload' });
      setStage('error');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Nhập câu hỏi từ tài liệu</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>

        {/* Upload stage */}
        {stage === 'upload' && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">Chọn file (PDF, DOCX, PPTX — tối đa 20MB)</label>
              <input
                type="file"
                accept=".pdf,.docx,.pptx"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="w-full text-sm border rounded px-3 py-2"
              />
              {file && <p className="text-xs text-muted-foreground mt-1">{file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)</p>}
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">Loại câu hỏi muốn sinh</label>
              <div className="space-y-1">
                {[['mcq', 'Trắc nghiệm (MCQ)'], ['true_false', 'Đúng / Sai'], ['fill_blank', 'Điền vào chỗ trống']].map(([k, l]) => (
                  <label key={k} className="flex items-center gap-2 cursor-pointer text-sm">
                    <input type="checkbox" checked={(questionTypes as Record<string, boolean>)[k]}
                      onChange={(e) => setQuestionTypes({ ...questionTypes, [k]: e.target.checked })} />
                    {l}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-600 block mb-1">Độ khó</label>
                <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}
                  className="w-full border rounded px-2 py-1.5 text-sm">
                  <option value="easy">Dễ</option>
                  <option value="medium">Trung bình</option>
                  <option value="hard">Khó</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-600 block mb-1">Câu hỏi / đoạn văn</label>
                <input type="number" min={1} max={10} value={questionsPerChunk}
                  onChange={(e) => setQuestionsPerChunk(parseInt(e.target.value) || 3)}
                  className="w-full border rounded px-2 py-1.5 text-sm" />
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <button onClick={onClose} className="px-4 py-2 text-sm border rounded hover:bg-gray-50">Hủy</button>
              <button onClick={handleUpload} disabled={!file || uploading || !Object.values(questionTypes).some(Boolean)}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50">
                {uploading ? 'Đang tải lên...' : 'Bắt đầu tạo câu hỏi'}
              </button>
            </div>
          </div>
        )}

        {/* Processing stage */}
        {stage === 'processing' && (
          <div className="text-center py-8 space-y-4">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="font-medium">AI đang xử lý tài liệu...</p>
            <p className="text-sm text-muted-foreground">
              Đã sinh được <strong>{progress.questionsGenerated}</strong> câu hỏi
            </p>
            <p className="text-xs text-muted-foreground">Trang này sẽ tự cập nhật khi hoàn thành</p>
          </div>
        )}

        {/* Done stage */}
        {stage === 'done' && (
          <div className="text-center py-8 space-y-3">
            <div className="text-5xl">✅</div>
            <p className="font-semibold text-green-700">Hoàn thành!</p>
            <p className="text-sm text-muted-foreground">
              Đã tạo <strong>{progress.questionsGenerated}</strong> câu hỏi (trạng thái: Chờ duyệt)
            </p>
            <button onClick={onClose} className="px-6 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700">
              Đóng & xem câu hỏi
            </button>
          </div>
        )}

        {/* Error stage */}
        {stage === 'error' && (
          <div className="text-center py-8 space-y-3">
            <div className="text-5xl">❌</div>
            <p className="font-semibold text-red-700">Có lỗi xảy ra</p>
            {progress.error && <p className="text-sm text-red-600">{progress.error}</p>}
            <div className="flex gap-2 justify-center">
              <button onClick={() => setStage('upload')}
                className="px-4 py-2 border rounded text-sm hover:bg-gray-50">Thử lại</button>
              <button onClick={onClose} className="px-4 py-2 bg-gray-600 text-white text-sm rounded">Đóng</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
