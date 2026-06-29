'use client';

import React, { useEffect, useRef, useState } from 'react';

interface ImportDocumentModalProps {
  bankId: string;
  accessToken: string;
  onClose: () => void;
  onImported: () => void;
}

type Stage = 'upload' | 'processing' | 'done' | 'error';

const MAX_POLL_MS = 8 * 60 * 1000; // 8 minutes before declaring timeout

export function ImportDocumentModal({ bankId, accessToken, onClose, onImported }: ImportDocumentModalProps) {
  const [stage, setStage] = useState<Stage>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [questionTypes, setQuestionTypes] = useState({ mcq: true, true_false: true, fill_blank: false });
  const [difficulty, setDifficulty] = useState('medium');
  const [questionsPerChunk, setQuestionsPerChunk] = useState(3);
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState({ status: 'pending', questionsGenerated: 0, error: '' });
  const [uploading, setUploading] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval>>();
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const startTimeRef = useRef<number>(0);

  const stopAll = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  useEffect(() => {
    if (!jobId || stage !== 'processing') return;

    startTimeRef.current = Date.now();

    // Elapsed-time counter (updates every second for UX)
    timerRef.current = setInterval(() => {
      const sec = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setElapsedSec(sec);

      // Timeout guard — AI may be stuck
      if (Date.now() - startTimeRef.current > MAX_POLL_MS) {
        stopAll();
        setProgress((p) => ({
          ...p,
          error: 'Quá thời gian chờ (8 phút). AI service có thể đang bận hoặc có lỗi. Vui lòng thử lại sau.',
        }));
        setStage('error');
      }
    }, 1000);

    // Status polling every 3 seconds
    pollRef.current = setInterval(async () => {
      try {
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
          stopAll();
          setStage('done');
          onImported();
        } else if (job.status === 'failed') {
          stopAll();
          setStage('error');
        }
      } catch {
        // Network error during polling — keep trying
      }
    }, 3000);

    return stopAll;
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
      setElapsedSec(0);
      setJobId(json.data.jobId);
      setStage('processing');
    } else {
      setProgress({ status: 'failed', questionsGenerated: 0, error: json.error ?? 'Lỗi upload' });
      setStage('error');
    }
  };

  const fmtTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `${m}p ${s}s` : `${s}s`;
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Nhập câu hỏi từ tài liệu AI</h2>
          <button onClick={() => { stopAll(); onClose(); }} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>

        {/* Upload stage */}
        {stage === 'upload' && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700 space-y-1">
              <p className="font-medium">Yêu cầu</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>AI service phải đang chạy và có cấu hình hợp lệ</li>
                <li>File: PDF, DOCX, PPTX — tối đa 20MB</li>
                <li>Thời gian xử lý: 1–5 phút tùy kích thước file</li>
              </ul>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">Chọn file</label>
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
                {([['mcq', 'Trắc nghiệm (MCQ)'], ['true_false', 'Đúng / Sai'], ['fill_blank', 'Điền vào chỗ trống']] as [string, string][]).map(([k, l]) => (
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
              <button onClick={handleUpload}
                disabled={!file || uploading || !Object.values(questionTypes).some(Boolean)}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50">
                {uploading ? 'Đang kiểm tra AI & tải lên...' : 'Bắt đầu tạo câu hỏi'}
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
            <p className="text-xs text-muted-foreground">
              Thời gian: {fmtTime(elapsedSec)} — tự động cập nhật mỗi 3 giây
            </p>
            {elapsedSec > 120 && (
              <p className="text-xs text-amber-600">
                Đang xử lý lâu hơn bình thường — AI có thể đang tải model lần đầu
              </p>
            )}
          </div>
        )}

        {/* Done stage */}
        {stage === 'done' && (
          <div className="text-center py-8 space-y-3">
            <div className="text-5xl">✅</div>
            <p className="font-semibold text-green-700">Hoàn thành!</p>
            <p className="text-sm text-muted-foreground">
              Đã tạo <strong>{progress.questionsGenerated}</strong> câu hỏi — trạng thái: Chờ duyệt
            </p>
            <button onClick={() => { stopAll(); onClose(); }}
              className="px-6 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700">
              Đóng & xem câu hỏi
            </button>
          </div>
        )}

        {/* Error stage */}
        {stage === 'error' && (
          <div className="py-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="text-3xl">❌</div>
              <p className="font-semibold text-red-700">Có lỗi xảy ra</p>
            </div>
            {progress.error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 break-words">
                {progress.error}
              </div>
            )}
            <div className="bg-gray-50 border rounded-lg p-3 text-xs text-gray-600 space-y-1">
              <p className="font-medium">Gợi ý khắc phục:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>Kiểm tra AI service đang chạy (trang Cấu hình AI → Test kết nối)</li>
                <li>Đảm bảo có ít nhất 1 cấu hình AI đang hoạt động</li>
                <li>Thử lại với file nhỏ hơn nếu file lớn</li>
              </ul>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setStage('upload'); setProgress({ status: 'pending', questionsGenerated: 0, error: '' }); }}
                className="px-4 py-2 border rounded text-sm hover:bg-gray-50">Thử lại</button>
              <button onClick={() => { stopAll(); onClose(); }}
                className="px-4 py-2 bg-gray-600 text-white text-sm rounded">Đóng</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
