'use client';

import React, { useEffect, useState } from 'react';

interface QuizConfig {
  id?: string;
  bankIds: string[];
  totalQuestions: number;
  easyCount: number;
  mediumCount: number;
  hardCount: number;
  passingScore: number;
  timeLimitMins: number | null;
  maxAttempts: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
}

interface Bank {
  id: string;
  name: string;
  _count: { questions: number };
}

interface QuizConfigFormProps {
  lessonId: string;
  accessToken: string;
  companyId: string;
  onSaved?: () => void;
}

const DEFAULT_CONFIG: QuizConfig = {
  bankIds: [],
  totalQuestions: 10,
  easyCount: 3,
  mediumCount: 5,
  hardCount: 2,
  passingScore: 70,
  timeLimitMins: 30,
  maxAttempts: 3,
  shuffleQuestions: true,
  shuffleOptions: true,
};

export function QuizConfigForm({ lessonId, accessToken, companyId, onSaved }: QuizConfigFormProps) {
  const [cfg, setCfg] = useState<QuizConfig>(DEFAULT_CONFIG);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<{ total: number; byDifficulty: Record<string, number> } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    // Load available banks
    fetch('/api/question-banks', { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.json())
      .then((d) => { if (d.success) setBanks(d.data); });

    // Load existing config
    fetch(`/api/lessons/${lessonId}/quiz-config`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.json())
      .then((d) => { if (d.success && d.data) setCfg(d.data); });
  }, [lessonId, accessToken]);

  const selectedBanks = banks.filter((b) => cfg.bankIds.includes(b.id));
  const totalPoolSize = selectedBanks.reduce((s, b) => s + b._count.questions, 0);
  const totalConfigured = cfg.easyCount + cfg.mediumCount + cfg.hardCount;

  const toggleBank = (bankId: string) => {
    setCfg((c) => ({
      ...c,
      bankIds: c.bankIds.includes(bankId)
        ? c.bankIds.filter((id) => id !== bankId)
        : [...c.bankIds, bankId],
    }));
  };

  const handleSave = async () => {
    if (cfg.bankIds.length === 0) { setError('Chọn ít nhất 1 ngân hàng câu hỏi'); return; }
    if (totalConfigured !== cfg.totalQuestions) {
      setError(`Tổng easy+medium+hard (${totalConfigured}) phải bằng totalQuestions (${cfg.totalQuestions})`);
      return;
    }
    setSaving(true);
    setError('');
    const res = await fetch(`/api/lessons/${lessonId}/quiz-config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(cfg),
    });
    const json = await res.json();
    if (json.success) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSaved?.();
    } else {
      setError(json.error ?? 'Lỗi lưu cấu hình');
    }
    setSaving(false);
  };

  const handlePreview = async () => {
    if (cfg.bankIds.length === 0) return;
    setLoadingPreview(true);
    // Count questions by difficulty in selected banks
    let easy = 0, medium = 0, hard = 0;
    for (const bank of selectedBanks) {
      const res = await fetch(
        `/api/question-banks/${bank.id}/questions?status=approved&limit=1000`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      const json = await res.json();
      if (json.success) {
        for (const q of json.data) {
          if (q.difficulty === 'easy') easy++;
          else if (q.difficulty === 'medium') medium++;
          else if (q.difficulty === 'hard') hard++;
        }
      }
    }
    setPreview({ total: easy + medium + hard, byDifficulty: { easy, medium, hard } });
    setLoadingPreview(false);
  };

  return (
    <div className="space-y-5">
      {/* Bank selection */}
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-2">Ngân hàng câu hỏi nguồn</label>
        {banks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có ngân hàng câu hỏi nào</p>
        ) : (
          <div className="space-y-1.5">
            {banks.map((b) => (
              <label key={b.id} className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="checkbox" checked={cfg.bankIds.includes(b.id)} onChange={() => toggleBank(b.id)} />
                <span className="font-medium">{b.name}</span>
                <span className="text-muted-foreground text-xs">({b._count.questions} câu)</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Question count config */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-3">
        <p className="text-sm font-medium text-gray-700">Phân bổ câu hỏi</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500">Tổng câu</label>
            <input type="number" min={1} value={cfg.totalQuestions}
              onChange={(e) => setCfg({ ...cfg, totalQuestions: parseInt(e.target.value) || 10 })}
              className="w-full border rounded px-2 py-1.5 text-sm mt-1" />
          </div>
          <div />
          <div>
            <label className="text-xs text-green-600">Dễ</label>
            <input type="number" min={0} value={cfg.easyCount}
              onChange={(e) => setCfg({ ...cfg, easyCount: parseInt(e.target.value) || 0 })}
              className="w-full border rounded px-2 py-1.5 text-sm mt-1 border-green-200" />
          </div>
          <div>
            <label className="text-xs text-yellow-600">Trung bình</label>
            <input type="number" min={0} value={cfg.mediumCount}
              onChange={(e) => setCfg({ ...cfg, mediumCount: parseInt(e.target.value) || 0 })}
              className="w-full border rounded px-2 py-1.5 text-sm mt-1 border-yellow-200" />
          </div>
          <div>
            <label className="text-xs text-red-600">Khó</label>
            <input type="number" min={0} value={cfg.hardCount}
              onChange={(e) => setCfg({ ...cfg, hardCount: parseInt(e.target.value) || 0 })}
              className="w-full border rounded px-2 py-1.5 text-sm mt-1 border-red-200" />
          </div>
          <div className="flex items-end">
            <p className={`text-xs ${totalConfigured === cfg.totalQuestions ? 'text-green-600' : 'text-red-600'}`}>
              Tổng: {totalConfigured}/{cfg.totalQuestions}
            </p>
          </div>
        </div>

        {/* Pool size info */}
        {cfg.bankIds.length > 0 && (
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground">Pool: ~{totalPoolSize} câu (câu hỏi đã duyệt)</p>
            <button onClick={handlePreview} disabled={loadingPreview}
              className="text-xs text-blue-500 hover:underline disabled:opacity-50">
              {loadingPreview ? 'Đang đếm...' : 'Xem phân bố thực tế'}
            </button>
          </div>
        )}

        {preview && (
          <div className="text-xs bg-white border rounded p-2 space-y-0.5">
            <p className="font-medium">Phân bố câu hỏi đã duyệt trong pool:</p>
            <p className="text-green-600">Dễ: {preview.byDifficulty.easy} câu</p>
            <p className="text-yellow-600">Trung bình: {preview.byDifficulty.medium} câu</p>
            <p className="text-red-600">Khó: {preview.byDifficulty.hard} câu</p>
            <p className="text-gray-500">Tổng: {preview.total} câu</p>
          </div>
        )}
      </div>

      {/* Settings */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-600 block mb-1">Điểm đạt (%)</label>
          <input type="number" min={0} max={100} value={cfg.passingScore}
            onChange={(e) => setCfg({ ...cfg, passingScore: parseInt(e.target.value) || 70 })}
            className="w-full border rounded px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-600 block mb-1">Thời gian (phút, để trống = không giới hạn)</label>
          <input type="number" min={0}
            value={cfg.timeLimitMins ?? ''}
            onChange={(e) => setCfg({ ...cfg, timeLimitMins: e.target.value ? parseInt(e.target.value) : null })}
            className="w-full border rounded px-2 py-1.5 text-sm"
            placeholder="Không giới hạn" />
        </div>
        <div>
          <label className="text-xs text-gray-600 block mb-1">Số lần làm bài tối đa</label>
          <input type="number" min={1} value={cfg.maxAttempts}
            onChange={(e) => setCfg({ ...cfg, maxAttempts: parseInt(e.target.value) || 3 })}
            className="w-full border rounded px-2 py-1.5 text-sm" />
        </div>
        <div className="space-y-2 flex flex-col justify-end">
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input type="checkbox" checked={cfg.shuffleQuestions}
              onChange={(e) => setCfg({ ...cfg, shuffleQuestions: e.target.checked })} />
            Xáo trộn câu hỏi
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input type="checkbox" checked={cfg.shuffleOptions}
              onChange={(e) => setCfg({ ...cfg, shuffleOptions: e.target.checked })} />
            Xáo trộn đáp án
          </label>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button onClick={handleSave} disabled={saving}
        className={`w-full py-2 text-sm rounded font-medium ${saved ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'} disabled:opacity-50`}>
        {saved ? '✓ Đã lưu' : saving ? 'Đang lưu...' : 'Lưu cấu hình Quiz'}
      </button>
    </div>
  );
}
