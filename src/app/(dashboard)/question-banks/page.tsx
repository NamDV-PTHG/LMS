'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { useToast } from '@/components/ui/toast';
import Link from 'next/link';

interface Bank {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  _count: { questions: number };
}

export default function QuestionBanksPage() {
  const { accessToken } = useAuth();
  const { toast } = useToast();
  const [banks, setBanks] = useState<Bank[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [creating, setCreating] = useState(false);

  const fetchBanks = async (token: string) => {
    try {
      const res = await fetch('/api/question-banks', { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (json.success) setBanks(json.data);
      else toast('error', 'Không thể tải danh sách ngân hàng', json.error);
    } catch {
      toast('error', 'Lỗi kết nối server');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (accessToken) fetchBanks(accessToken);
  }, [accessToken]); // eslint-disable-line

  const handleCreate = async () => {
    if (!form.name.trim() || !accessToken) return;
    setCreating(true);
    try {
      const res = await fetch('/api/question-banks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (json.success) {
        setShowCreate(false);
        setForm({ name: '', description: '' });
        toast('success', 'Tạo ngân hàng thành công', form.name);
        fetchBanks(accessToken);
      } else {
        toast('error', 'Tạo ngân hàng thất bại', json.error ?? 'Vui lòng thử lại');
      }
    } catch {
      toast('error', 'Lỗi kết nối server');
    } finally {
      setCreating(false);
    }
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Đang tải...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ngân hàng câu hỏi</h1>
          <p className="text-sm text-muted-foreground mt-1">Quản lý câu hỏi và nhập từ tài liệu AI</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">
          + Tạo ngân hàng
        </button>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md space-y-4">
            <h2 className="font-semibold text-lg">Tạo ngân hàng câu hỏi</h2>
            <input
              type="text"
              placeholder="Tên ngân hàng *"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border rounded px-3 py-2 text-sm"
              autoFocus
            />
            <textarea
              placeholder="Mô tả (tùy chọn)"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full border rounded px-3 py-2 text-sm resize-none"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm border rounded hover:bg-gray-50">Hủy</button>
              <button
                onClick={handleCreate}
                disabled={creating || !form.name.trim()}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {creating ? 'Đang tạo...' : 'Tạo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {banks.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">Chưa có ngân hàng câu hỏi nào</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {banks.map((b) => (
            <Link key={b.id} href={`/question-banks/${b.id}`}
              className="block border rounded-xl p-5 bg-white hover:shadow-md transition-shadow">
              <h3 className="font-semibold text-gray-900">{b.name}</h3>
              {b.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{b.description}</p>}
              <p className="text-xs text-muted-foreground mt-3">{b._count.questions} câu hỏi</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
