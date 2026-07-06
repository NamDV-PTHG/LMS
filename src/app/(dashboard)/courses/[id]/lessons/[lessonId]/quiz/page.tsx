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

interface QuestionCategory {
  id: string;
  name: string;
  color: string | null;
  competencyId: string | null;
  competency?: { id: string; name: string } | null;
  questionCount?: number;
}

interface QuizConfig {
  bankIds: string[];
  filterCategoryIds: string[];
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
  filterCategoryIds: [],
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

const inputClass =
  'w-full border border-default rounded-lg px-3 py-2 text-[12px] text-content placeholder:text-faint focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors';

export default function LessonQuizPage() {
  const { accessToken } = useAuth();
  const { id: courseId, lessonId } = useParams<{ id: string; lessonId: string }>();
  const router = useRouter();

  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [categories, setCategories] = useState<QuestionCategory[]>([]);
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
      fetch('/api/question-categories', { headers: h }).then((r) => r.json()),
    ]).then(([banksRes, cfgRes, catsRes]) => {
      if (banksRes.success) setBanks(banksRes.data ?? []);
      if (cfgRes.success && cfgRes.data) {
        setConfig({ ...DEFAULT_CONFIG, ...cfgRes.data, filterCategoryIds: cfgRes.data.filterCategoryIds ?? [] });
      }
      if (catsRes.success) setCategories(catsRes.data ?? []);
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

  const toggleCategory = (catId: string) => {
    setConfig((c) => ({
      ...c,
      filterCategoryIds: c.filterCategoryIds.includes(catId)
        ? c.filterCategoryIds.filter((id) => id !== catId)
        : [...c.filterCategoryIds, catId],
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

  if (isLoading) return (
    <div className="flex items-center justify-center py-16 gap-2 text-faint">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      Đang tải...
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[12px] text-faint">
        <button onClick={() => router.push('/courses')} className="hover:text-primary transition-colors">Khóa học</button>
        <span>/</span>
        <button onClick={() => router.push(`/courses/${courseId}`)} className="hover:text-primary transition-colors">Chỉnh sửa</button>
        <span>/</span>
        <span className="text-content font-medium">Cấu hình Quiz</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary-tint flex items-center justify-center text-[16px] shrink-0 text-primary">✏</div>
        <div>
          <h1 className="text-[16px] font-medium text-content">Cấu hình bài kiểm tra (Quiz)</h1>
          <p className="text-[12px] text-subtle">Chọn ngân hàng câu hỏi và thiết lập thông số bài thi</p>
        </div>
      </div>

      {/* Bank selection */}
      <div className="bg-surface border border-default rounded-xl shadow-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[13px] font-medium text-content">Ngân hàng câu hỏi</h2>
          <a href="/question-banks" target="_blank" className="text-[11px] text-primary hover:underline">
            Quản lý ngân hàng →
          </a>
        </div>

        {banks.length === 0 ? (
          <div className="text-center py-8 text-faint">
            <p className="text-[12px]">Chưa có ngân hàng câu hỏi nào.</p>
            <a href="/question-banks" className="text-[12px] text-primary hover:underline mt-2 inline-block">
              Tạo ngân hàng câu hỏi →
            </a>
          </div>
        ) : (
          <div className="space-y-2">
            {banks.map((bank) => {
              const selected = config.bankIds.includes(bank.id);
              return (
                <label key={bank.id} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  selected ? 'bg-primary-tint border-primary/40' : 'border-default hover:bg-muted'
                }`}>
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleBank(bank.id)}
                    className="mt-0.5 w-4 h-4 accent-primary"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[12px] text-content">{bank.name}</p>
                    {bank.description && <p className="text-[11px] text-faint truncate">{bank.description}</p>}
                  </div>
                  {bank._count && (
                    <span className="text-[11px] text-faint shrink-0">{bank._count.questions} câu</span>
                  )}
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* Category filter */}
      {categories.length > 0 && (
        <div className="bg-surface border border-default rounded-xl shadow-card p-5 space-y-4">
          <div>
            <h2 className="text-[13px] font-medium text-content">Lọc theo danh mục năng lực</h2>
            <p className="text-[11px] text-faint mt-0.5">
              Tùy chọn — Chỉ lấy câu hỏi thuộc các danh mục được chọn (để trống = lấy tất cả)
            </p>
          </div>
          <div className="space-y-2">
            {categories.map((cat) => {
              const selected = config.filterCategoryIds.includes(cat.id);
              return (
                <label key={cat.id} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  selected ? 'bg-primary-tint border-primary/40' : 'border-default hover:bg-muted'
                }`}>
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleCategory(cat.id)}
                    className="mt-0.5 w-4 h-4 accent-primary"
                  />
                  <div className="flex-1 flex items-center gap-2 min-w-0">
                    {cat.color && (
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                    )}
                    <p className="font-medium text-[12px] text-content">{cat.name}</p>
                    {cat.competency && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-primary-tint text-primary rounded">
                        → {cat.competency.name}
                      </span>
                    )}
                  </div>
                  {cat.questionCount !== undefined && (
                    <span className="text-[11px] text-faint shrink-0">{cat.questionCount} câu</span>
                  )}
                </label>
              );
            })}
          </div>
          {config.filterCategoryIds.length > 0 && (
            <p className="text-[11px] text-primary">
              ✓ Đã chọn {config.filterCategoryIds.length} danh mục — câu hỏi sẽ chỉ lấy từ các danh mục này
            </p>
          )}
        </div>
      )}

      {/* Quiz settings */}
      <div className="bg-surface border border-default rounded-xl shadow-card p-5 space-y-4">
        <h2 className="text-[13px] font-medium text-content">Thông số bài thi</h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-[12px] font-medium text-content mb-1">Tổng số câu hỏi</label>
            <input
              type="number"
              min={1}
              value={config.totalQuestions}
              onChange={(e) => setConfig({ ...config, totalQuestions: num(e.target.value) })}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-content mb-1">Điểm đạt (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              value={config.passingScore}
              onChange={(e) => setConfig({ ...config, passingScore: num(e.target.value) })}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-content mb-1">Thời gian (phút)</label>
            <input
              type="number"
              min={1}
              value={config.timeLimitMins ?? ''}
              placeholder="Không giới hạn"
              onChange={(e) => setConfig({ ...config, timeLimitMins: e.target.value ? num(e.target.value) : null })}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-content mb-1">Số lần làm tối đa</label>
            <input
              type="number"
              min={1}
              value={config.maxAttempts}
              onChange={(e) => setConfig({ ...config, maxAttempts: num(e.target.value) })}
              className={inputClass}
            />
          </div>
        </div>

        {/* Difficulty distribution */}
        <div>
          <label className="block text-[12px] font-medium text-content mb-2">
            Phân bổ độ khó
            <span className={`ml-2 text-[11px] font-normal ${
              config.easyCount + config.mediumCount + config.hardCount === config.totalQuestions
                ? 'text-success' : 'text-danger'
            }`}>
              ({config.easyCount + config.mediumCount + config.hardCount} / {config.totalQuestions})
            </span>
          </label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { key: 'easyCount', label: 'Dễ', color: 'text-success' },
              { key: 'mediumCount', label: 'Trung bình', color: 'text-warning' },
              { key: 'hardCount', label: 'Khó', color: 'text-danger' },
            ].map(({ key, label, color }) => (
              <div key={key}>
                <label className={`block text-[11px] font-medium mb-1 ${color}`}>{label}</label>
                <input
                  type="number"
                  min={0}
                  value={config[key as keyof QuizConfig] as number}
                  onChange={(e) => setConfig({ ...config, [key]: num(e.target.value) })}
                  className={inputClass}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Toggles */}
        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={config.shuffleQuestions}
              onChange={(e) => setConfig({ ...config, shuffleQuestions: e.target.checked })}
              className="w-4 h-4 accent-primary"
            />
            <span className="text-[12px] text-content">Xáo trộn câu hỏi</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={config.shuffleOptions}
              onChange={(e) => setConfig({ ...config, shuffleOptions: e.target.checked })}
              className="w-4 h-4 accent-primary"
            />
            <span className="text-[12px] text-content">Xáo trộn đáp án</span>
          </label>
        </div>
      </div>

      {msg && (
        <div className={`rounded-xl px-4 py-3 text-[12px] border ${
          msg.type === 'ok'
            ? 'bg-success-tint text-success border-success/20'
            : 'bg-danger-tint text-danger border-danger/20'
        }`}>
          {msg.type === 'ok' ? '✓ ' : '✗ '}{msg.text}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={() => router.push(`/courses/${courseId}`)}
          className="px-4 py-2 border border-default rounded-lg text-[12px] text-subtle hover:bg-muted transition-colors"
        >
          ← Quay lại
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2 bg-primary hover:bg-primary-dark text-white text-[12px] font-medium rounded-lg disabled:opacity-50 transition-colors"
        >
          {saving ? 'Đang lưu...' : 'Lưu cấu hình Quiz'}
        </button>
      </div>

      {/* Info */}
      <div className="bg-muted rounded-xl border border-default p-4 text-[11px] text-subtle space-y-1">
        <p className="font-medium text-content text-[12px]">Cách hoạt động:</p>
        <ul className="list-disc pl-4 space-y-0.5">
          <li>Hệ thống tự động chọn ngẫu nhiên câu hỏi từ các ngân hàng đã chọn theo phân bổ độ khó</li>
          <li>Lọc danh mục: nếu chọn danh mục năng lực, chỉ câu hỏi thuộc danh mục đó được rút ra</li>
          <li>Sau mỗi lần nộp bài, hồ sơ năng lực được cập nhật tự động theo điểm từng danh mục</li>
          <li>Câu hỏi được tạo và quản lý tại <a href="/question-banks" className="text-primary underline">Ngân hàng câu hỏi</a></li>
        </ul>
      </div>
    </div>
  );
}
