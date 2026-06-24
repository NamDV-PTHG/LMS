'use client';

import React, { useState } from 'react';

interface MemberSearchProps {
  groupId: string;
  accessToken: string;
  onAdded: () => void;
}

export function MemberSearch({ groupId, accessToken, onAdded }: MemberSearchProps) {
  const [identifier, setIdentifier] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleAdd = async () => {
    if (!identifier.trim()) return;
    setStatus('loading');
    setMessage('');

    try {
      const res = await fetch(`/api/learning-groups/${groupId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ identifier: identifier.trim() }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? 'Lỗi thêm thành viên');
      setStatus('success');
      setMessage('Đã thêm thành công');
      setIdentifier('');
      onAdded();
    } catch (err: unknown) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Lỗi không xác định');
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-gray-700">Thêm thành viên</label>
      <div className="flex gap-2">
        <input
          type="text"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="Email hoặc mã nhân viên..."
          className="flex-1 border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleAdd}
          disabled={status === 'loading' || !identifier.trim()}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {status === 'loading' ? 'Đang thêm...' : 'Thêm'}
        </button>
      </div>
      {message && (
        <p className={`text-xs ${status === 'error' ? 'text-red-600' : 'text-green-600'}`}>
          {message}
        </p>
      )}
      <p className="text-xs text-gray-500">
        Nhập email hoặc mã nhân viên — không hiển thị danh sách toàn công ty
      </p>
    </div>
  );
}
