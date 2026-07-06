'use client';

import React, { useEffect, useRef, useState } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** Accepts string or any ReactNode for rich content */
  message?: React.ReactNode;
  confirmLabel?: string;
  confirmClass?: string;
  cancelLabel?: string;
  /** Called with the textarea value when inputLabel is provided, or empty string otherwise */
  onConfirm: (inputValue: string) => void;
  onCancel: () => void;
  variant?: 'danger' | 'warning' | 'primary';
  /** Optional — renders a textarea input inside the dialog */
  inputLabel?: string;
  inputPlaceholder?: string;
  inputRequired?: boolean;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Xác nhận',
  confirmClass,
  cancelLabel = 'Hủy',
  onConfirm,
  onCancel,
  variant = 'danger',
  inputLabel,
  inputPlaceholder,
  inputRequired = false,
}: ConfirmDialogProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    if (open) {
      setInputValue('');
      if (inputLabel) setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, inputLabel]);

  if (!open) return null;

  const isConfirmDisabled = inputRequired && inputLabel && !inputValue.trim();

  const variantBtn = {
    danger:  'bg-danger hover:bg-danger/90',
    warning: 'bg-warning hover:bg-warning/90',
    primary: 'bg-primary hover:bg-primary/90',
  }[variant];

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="bg-surface rounded-xl shadow-xl border border-default w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-5 pt-5 pb-2">
          <h3 className="text-[14px] font-semibold text-content">{title}</h3>
          {message && (
            typeof message === 'string'
              ? <p className="text-[12px] text-subtle mt-1.5 leading-relaxed">{message}</p>
              : <div className="text-[12px] text-subtle mt-2 leading-relaxed">{message}</div>
          )}
        </div>

        {/* Optional textarea input */}
        {inputLabel && (
          <div className="px-5 pb-2 pt-1">
            <label className="block text-[12px] font-medium text-content mb-1.5">{inputLabel}</label>
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={inputPlaceholder}
              rows={3}
              className="w-full border border-default rounded-lg px-3 py-2 text-[12px] text-content placeholder:text-faint focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none transition-colors"
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 px-5 py-4">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 text-[12px] font-medium border border-default rounded-lg text-subtle hover:bg-muted transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => onConfirm(inputValue)}
            disabled={!!isConfirmDisabled}
            className={
              confirmClass ??
              `flex-1 px-4 py-2 text-[12px] font-medium rounded-lg text-white transition-colors disabled:opacity-50 ${variantBtn}`
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
