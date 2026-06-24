'use client';

import React, { useState } from 'react';

interface ExportButtonProps {
  companyId: string;
  accessToken: string;
  type?: 'compliance';
  label?: string;
}

export function ExportButton({ companyId, accessToken, type = 'compliance', label = 'Xuất Excel' }: ExportButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/company/${companyId}/export?type=${type}&format=xlsx`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        alert(json.error ?? 'Lỗi xuất báo cáo');
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}-${companyId}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="px-4 py-2 text-sm border rounded-lg bg-white hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
    >
      {loading ? (
        <>
          <span className="inline-block w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          Đang xuất...
        </>
      ) : (
        <>
          <span>↓</span>
          {label}
        </>
      )}
    </button>
  );
}
