'use client';

import React, { useState } from 'react';

type FieldType = 'job_level' | 'job_title' | 'company_id' | 'department_id';
type OpType = 'eq' | 'in' | 'contains';

interface Condition {
  field: FieldType;
  op: OpType;
  value: string; // comma-separated for 'in'
}

interface RuleBuilderProps {
  value: { logic: 'AND' | 'OR'; conditions: Condition[] } | null;
  onChange: (rule: { logic: 'AND' | 'OR'; conditions: { field: FieldType; op: OpType; value: string | string[] }[] }) => void;
}

const FIELD_LABELS: Record<FieldType, string> = {
  job_level: 'Cấp độ công việc',
  job_title: 'Chức danh',
  company_id: 'Công ty (ID)',
  department_id: 'Phòng ban (ID)',
};

const OP_LABELS: Record<OpType, string> = {
  eq: 'bằng',
  in: 'nằm trong (cách nhau bởi dấu phẩy)',
  contains: 'chứa',
};

export function RuleBuilder({ value, onChange }: RuleBuilderProps) {
  const [logic, setLogic] = useState<'AND' | 'OR'>(value?.logic ?? 'AND');
  const [conditions, setConditions] = useState<Condition[]>(
    value?.conditions.map((c) => ({
      ...c,
      value: Array.isArray(c.value) ? c.value.join(',') : c.value,
    })) ?? [],
  );

  const emit = (newLogic: 'AND' | 'OR', newConds: Condition[]) => {
    onChange({
      logic: newLogic,
      conditions: newConds.map((c) => ({
        ...c,
        value: c.op === 'in' ? c.value.split(',').map((v) => v.trim()).filter(Boolean) : c.value.trim(),
      })),
    });
  };

  const setLogicAndEmit = (l: 'AND' | 'OR') => {
    setLogic(l);
    emit(l, conditions);
  };

  const addCondition = () => {
    const newConds = [...conditions, { field: 'job_level' as FieldType, op: 'eq' as OpType, value: '' }];
    setConditions(newConds);
    emit(logic, newConds);
  };

  const removeCondition = (i: number) => {
    const newConds = conditions.filter((_, idx) => idx !== i);
    setConditions(newConds);
    emit(logic, newConds);
  };

  const updateCondition = (i: number, patch: Partial<Condition>) => {
    const newConds = conditions.map((c, idx) => (idx === i ? { ...c, ...patch } : c));
    setConditions(newConds);
    emit(logic, newConds);
  };

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-gray-700">Kết hợp điều kiện bằng:</span>
        {(['AND', 'OR'] as const).map((l) => (
          <button
            key={l}
            onClick={() => setLogicAndEmit(l)}
            className={`px-3 py-1 text-sm rounded border ${logic === l ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
          >
            {l}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {conditions.map((c, i) => (
          <div key={i} className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-400 w-6 text-right">{i > 0 ? logic : 'NẾU'}</span>

            <select
              value={c.field}
              onChange={(e) => updateCondition(i, { field: e.target.value as FieldType, value: '' })}
              className="border rounded px-2 py-1 text-sm"
            >
              {Object.entries(FIELD_LABELS).map(([f, label]) => (
                <option key={f} value={f}>{label}</option>
              ))}
            </select>

            <select
              value={c.op}
              onChange={(e) => updateCondition(i, { op: e.target.value as OpType })}
              className="border rounded px-2 py-1 text-sm"
            >
              {Object.entries(OP_LABELS).map(([op, label]) => (
                <option key={op} value={op}>{label}</option>
              ))}
            </select>

            <input
              type="text"
              value={c.value}
              onChange={(e) => updateCondition(i, { value: e.target.value })}
              placeholder={c.op === 'in' ? 'value1, value2, ...' : 'Giá trị...'}
              className="flex-1 border rounded px-2 py-1 text-sm min-w-[140px]"
            />

            <button
              onClick={() => removeCondition(i)}
              className="text-red-500 hover:text-red-700 text-lg px-1"
              title="Xóa điều kiện"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={addCondition}
        className="text-sm text-blue-600 hover:underline"
      >
        + Thêm điều kiện
      </button>

      {conditions.length === 0 && (
        <p className="text-xs text-gray-400">Chưa có điều kiện — nhóm sẽ không tự động đồng bộ thành viên</p>
      )}
    </div>
  );
}
