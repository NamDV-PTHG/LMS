'use client';

import { useAuth } from '@/components/providers/auth-provider';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface QuestionBank {
  id: string;
  name: string;
  description?: string | null;
  _count?: { questions: number };
}

interface QuizConfig {
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

export default function LessonQuizPage() {
  const { accessToken } = useAuth();
  const { id: courseId, lessonId } = useParams<{ id: string; lessonId: string }>();
  const router = useRouter();

  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [config, setConfig] = useState<QuizConfig>(DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const authHeader = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };

  useEffect(() => {
    if (!accessToken) return;
    const h = { Authorization: `Bearer ${accessToken}` };

    Promise.all([
      fetch('/api/question-banks?limit=100', { headers: h }).then((r) => r.json()),
      fetch(`/api/lessons/${lessonId}/quiz-config`, { headers: h }).then((r) => r.json()),
    ]).then(([banksRes, cfgRes]) => {
      if (banksRes.success) setBanks(banksRes.data ?? []);
      if (cfgRes.success && cfgRes.data) {
        setConfig({ ...DEFAULT_CONFIG, ...cfgRes.data });
      }
    }).catch(() => {}).finally(() => setIsLoading(false));
  }, [accessToken, lessonId]);

  const toggleBank = (bankId: string) => {
    setConfig((c) => ({
      ...c,
      bankIds: c.bankIds.includes(bankId)
        ? c.bankIds.filter((b) => b !== bankId)
        : [...c.bankIds, bankId],
    }));
  };

  const handleSave = async () => {
    setMsg(null);
    if (config.bankIds.length === 0) {
      setMsg({ type: 'err', text: 'Chọn ít nhất một ngân hàng câu hỏi' });
      return;
    }
    const sum = config.easyCount + config.mediumCount + config.hardCount;
    if (sum !== config.totalQuestions) {
      setMsg({ type: 'err', text: `Số câu dễ + trung bình + khó (${sum}) phải bằng tổng câu hỏi (${config.totalQuestions})` });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/lessons/${lessonId}/quiz-config`, {
        method: 'PUT',
        headers: authHeader,
        body: JSON.stringify(config),
      }).then((r) => r.json());

      if (res.success) {
        setMsg({ type: 'ok', text: 'Đã lưu cấu hình bài kiểm tra!' });
      } else {
        setMsg({ type: 'err', text: res.error ?? 'Lỗi lưu cấu hình' });
      }
    } catch {
      setMsg({ type: 'err', text: 'Lỗi kết nối' });
    } finally {
      setSaving(false);
    }
  };

  const num = (v: string) => Math.max(0, parseInt(v) || 0);

  if (isLoading) return <div className="flex h-64 items-center justify-center text-gray-400">Đang tải...</div>;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <button onClick={() => router.push('/courses')} className="hover:text-blue-600">Khóa học</button>
        <span>/</span>
        <button onClick={() => router.push(`/courses/${courseId}`)} className="hover:text-blue-600">Chỉnh sửa</button>
        <span>/</span>
        <span className="text-gray-900 font-medium">Cấu hình Quiz</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center text-xl shrink-0">✏</div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Cấu hình bài kiểm tra (Quiz)</h1>
          <p className="text-sm text-gray-500">Chọn ngân hàng câu hỏi và thiết lập thông số bài thi</p>
        </div>
      </div>

      {/* Bank selection */}
      <div className="bg-white rounded-xl border p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Ngân hàng câu hỏi</h2>
          <a href="/question-banks" target="_blank" className="text-xs text-blue-600 hover:underline">
            Quản lý ngân hàng →
          </a>
        </div>

        {banks.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p>Chưa có ngân hàng câu hỏi nào.</p>
            <a href="/question-banks" className="text-sm text-blue-600 hover:underline mt-2 inline-block">
              Tạo ngân hàng câu hỏi →
            </a>
          </div>
        ) : (
          <div className="space-y-2">
            {banks.map((bank) => {
              const selected = config.bankIds.includes(bank.id);
              return (
                <label key={bank.id} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  selected ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50'
                }`}>
                  <input type="checkbox" checked={selected} onChange={() => toggleBank(bank.id)}
                    className="mt-0.5 w-4 h-4 accent-blue-600" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900">{bank.name}</p>
                    {bank.description && <p className="text-xs text-gray-400 truncate">{bank.description}</p>}
                  </div>
                  {bank._count && (
                    <span className="text-xs text-gray-400 shrink-0">{bank._count.questions} câu</span>
                  )}
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* Quiz settings */}
      <div className="bg-white rounded-xl border p-5 space-y-5">
        <h2 className="font-semibold text-gray-800">Thông số bài thi</h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tổng số câu hỏi</label>
            <input type="number" min={1} value={config.totalQuestions}
              onChange={(e) => setConfig({ ...config, totalQuestions: num(e.target.value) })}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Điểm đạt (%)</label>
            <input type="number" min={0} max={100} value={config.passingScore}
              onChange={(e) => setConfig({ ...config, passingScore: num(e.target.value) })}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Thời gian (phút)</label>
            <input type="number" min={1} value={config.timeLimitMins ?? ''}
              placeholder="Không giới hạn"
              onChange={(e) => setConfig({ ...config, timeLimitMins: e.target.value ? num(e.target.value) : null })}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Số lần làm tối đa</label>
            <input type="number" min={1} value={config.maxAttempts}
              onChange={(e) => setConfig({ ...config, maxAttempts: num(e.target.value) })}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        {/* Difficulty distribution */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Phân bổ độ khó
            <span className={`ml-2 text-xs font-normal ${
              config.easyCount + config.mediumCount + config.hardCount === config.totalQuestions
                ? 'text-green-600' : 'text-red-500'
            }`}>
              ({config.easyCount + config.mediumCount + config.hardCount} / {config.totalQuestions})
            </span>
          </label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { key: 'easyCount', label: 'Dễ', color: 'text-green-600' },
              { key: 'mediumCount', label: 'Trung bình', color: 'text-yellow-600' },
              { key: 'hardCount', label: 'Khó', color: 'text-red-600' },
            ].map(({ key, label, color }) => (
              <div key={key}>
                <label className={`block text-xs font-medium mb-1 ${color}`}>{label}</label>
                <input type="number" min={0} value={config[key as keyof QuizConfig] as number}
                  onChange={(e) => setConfig({ ...config, [key]: num(e.target.value) })}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            ))}
          </div>
        </div>

        {/* Toggles */}
        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={config.shuffleQuestions}
              onChange={(e) => setConfig({ ...config, shuffleQuestions: e.target.checked })}
              className="w-4 h-4 accent-blue-600" />
            <span className="text-sm text-gray-700">Xáo trộn câu hỏi</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={config.shuffleOptions}
              onChange={(e) => setConfig({ ...config, shuffleOptions: e.target.checked })}
              className="w-4 h-4 accent-blue-600" />
            <span className="text-sm text-gray-700">Xáo trộn đáp án</span>
          </label>
        </div>
      </div>

      {msg && (
        <div className={`rounded-xl px-4 py-3 text-sm border ${
          msg.type === 'ok' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
        }`}>
          {msg.type === 'ok' ? '✓ ' : '✗ '}{msg.text}
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={() => router.push(`/courses/${courseId}`)}
          className="px-4 py-2 border rounded-lg text-sm text-gray-700 hover:bg-gray-50">
          ← Quay lại
        </button>
        <button onClick={handleSave} disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {saving ? 'Đang lưu...' : 'Lưu cấu hình Quiz'}
        </button>
      </div>

      {/* Info */}
      <div className="bg-gray-50 rounded-xl border p-4 text-xs text-gray-500 space-y-1">
        <p className="font-medium text-gray-700">Cách hoạt động:</p>
        <ul className="list-disc pl-4 space-y-0.5">
          <li>Hệ thống tự động chọn ngẫu nhiên câu hỏi từ các ngân hàng đã chọn theo phân bổ độ khó</li>
          <li>Mỗi lần làm bài, câu hỏi được rút ngẫu nhiên — đảm bảo không trùng lặp</li>
          <li>Câu hỏi được tạo và quản lý tại <a href="/question-banks" className="text-blue-600 underline">Ngân hàng câu hỏi</a></li>
        </ul>
      </div>
    </div>
  );
}
