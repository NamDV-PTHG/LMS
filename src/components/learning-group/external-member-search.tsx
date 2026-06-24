'use client';

import React, { useState } from 'react';

interface ExternalMemberSearchProps {
  groupId: string;
  accessToken: string;
  onAdded: () => void;
}

export function ExternalMemberSearch({ groupId, accessToken, onAdded }: ExternalMemberSearchProps) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'warning' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [wasCreated, setWasCreated] = useState(false);

  const handleAdd = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;

    // Basic format check before hitting server
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      setStatus('warning');
      setMessage('Định dạng email không hợp lệ. Vui lòng kiểm tra lại.');
      return;
    }

    setStatus('loading');
    setMessage('');
    setWasCreated(false);

    try {
      const res = await fetch(`/api/learning-groups/${groupId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ identifier: trimmed }),
      });
      const json = await res.json();

      if (!json.success) {
        // Server-side validation error (e.g. MX record invalid, conflict)
        setStatus('warning');
        setMessage(json.error ?? 'Không thể thêm thành viên này');
        return;
      }

      const created = json.data?.wasCreated ?? false;
      setWasCreated(created);
      setStatus('success');
      setMessage(
        created
          ? `Đã tạo tài khoản và gửi thông tin đăng nhập đến ${trimmed}`
          : `Đã thêm ${trimmed} vào nhóm`,
      );
      setEmail('');
      onAdded();
    } catch {
      setStatus('error');
      setMessage('Lỗi kết nối. Vui lòng thử lại.');
    }
  };

  const statusColors = {
    idle: '',
    loading: '',
    success: 'text-green-600',
    warning: 'text-amber-600',
    error: 'text-red-600',
  };

  const statusIcons = {
    idle: '',
    loading: '',
    success: wasCreated ? '✓ Tài khoản mới: ' : '✓ ',
    warning: '⚠ ',
    error: '✕ ',
  };

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-3">
      <div>
        <p className="text-sm font-medium text-orange-800">+ Thêm người dùng ngoài hệ thống</p>
        <p className="text-xs text-orange-600 mt-0.5">
          Nhập email — nếu chưa có tài khoản, hệ thống sẽ tự tạo và gửi thông tin đăng nhập.
        </p>
      </div>

      <div className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setStatus('idle'); setMessage(''); }}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="email@domain.com"
          className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
          disabled={status === 'loading'}
        />
        <button
          onClick={handleAdd}
          disabled={status === 'loading' || !email.trim()}
          className="px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 disabled:opacity-50 whitespace-nowrap"
        >
          {status === 'loading' ? 'Đang xử lý...' : 'Thêm'}
        </button>
      </div>

      {message && (
        <p className={`text-xs px-3 py-1.5 rounded-lg ${status === 'success' ? 'bg-green-50 text-green-700' : status === 'warning' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
          {statusIcons[status]}{message}
        </p>
      )}
    </div>
  );
}
