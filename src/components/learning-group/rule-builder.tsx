'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';

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

interface Organization { id: string; name: string; type: string }

const FIELD_LABELS: Record<FieldType, string> = {
  job_level: 'Cấp độ công việc',
  job_title: 'Chức danh',
  company_id: 'Công ty',
  department_id: 'Phòng ban',
};

const OP_LABELS: Record<OpType, string> = {
  eq: 'bằng',
  in: 'thuộc (nhiều, cách nhau dấu phẩy)',
  contains: 'chứa',
};

const selectClass =
  'border border-default rounded-lg px-2 py-1.5 text-[12px] text-content bg-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors';
const inputClass =
  'flex-1 border border-default rounded-lg px-2 py-1.5 text-[12px] text-content placeholder:text-faint bg-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors min-w-[140px]';

export function RuleBuilder({ value, onChange }: RuleBuilderProps) {
  const { accessToken } = useAuth();
  const [logic, setLogic] = useState<'AND' | 'OR'>(value?.logic ?? 'AND');
  const [conditions, setConditions] = useState<Condition[]>(
    value?.conditions.map((c) => ({
      ...c,
      value: Array.isArray(c.value) ? c.value.join(',') : c.value,
    })) ?? [],
  );
  const [orgs, setOrgs] = useState<Organization[]>([]);

  useEffect(() => {
    if (!accessToken) return;
    fetch('/api/organizations', { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.json())
      .then((res) => setOrgs(res.data ?? []))
      .catch(() => {});
  }, [accessToken]);

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
    const newConds = [...conditions, { field: 'department_id' as FieldType, op: 'eq' as OpType, value: '' }];
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

  const depts = orgs.filter((o) => o.type === 'dept' || o.type === 'department');
  const companies = orgs.filter((o) => o.type === 'company');

  return (
    <div className="bg-surface border border-default rounded-xl p-4 space-y-4">
      {/* Logic toggle */}
      <div className="flex items-center gap-3">
        <span className="text-[12px] font-medium text-content">Kết hợp điều kiện bằng:</span>
        {(['AND', 'OR'] as const).map((l) => (
          <button
            key={l}
            onClick={() => setLogicAndEmit(l)}
            className={`px-3 py-1 text-[12px] rounded-lg border transition-colors ${
              logic === l
                ? 'bg-primary text-white border-primary font-medium'
                : 'border-default text-subtle hover:bg-muted'
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {/* Conditions */}
      <div className="space-y-2">
        {conditions.map((c, i) => (
          <div key={i} className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-faint w-10 text-right shrink-0">
              {i === 0 ? 'NẾU' : logic}
            </span>

            {/* Field */}
            <select
              value={c.field}
              onChange={(e) => updateCondition(i, { field: e.target.value as FieldType, value: '' })}
              className={selectClass}
            >
              {Object.entries(FIELD_LABELS).map(([f, label]) => (
                <option key={f} value={f}>{label}</option>
              ))}
            </select>

            {/* Operator — only eq/in for dept/company */}
            {c.field !== 'department_id' && c.field !== 'company_id' && (
              <select
                value={c.op}
                onChange={(e) => updateCondition(i, { op: e.target.value as OpType })}
                className={selectClass}
              >
                {Object.entries(OP_LABELS).map(([op, label]) => (
                  <option key={op} value={op}>{label}</option>
                ))}
              </select>
            )}

            {/* Value — smart input based on field */}
            {c.field === 'department_id' ? (
              <select
                value={c.value}
                onChange={(e) => updateCondition(i, { value: e.target.value, op: 'eq' })}
                className={`${selectClass} flex-1 min-w-[180px]`}
              >
                <option value="">-- Chọn phòng ban --</option>
                {depts.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            ) : c.field === 'company_id' ? (
              <select
                value={c.value}
                onChange={(e) => updateCondition(i, { value: e.target.value, op: 'eq' })}
                className={`${selectClass} flex-1 min-w-[180px]`}
              >
                <option value="">-- Chọn công ty --</option>
                {companies.map((co) => (
                  <option key={co.id} value={co.id}>{co.name}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={c.value}
                onChange={(e) => updateCondition(i, { value: e.target.value })}
                placeholder={c.op === 'in' ? 'value1, value2, ...' : 'Giá trị...'}
                className={inputClass}
              />
            )}

            <button
              onClick={() => removeCondition(i)}
              className="text-faint hover:text-danger transition-colors shrink-0 text-[16px] px-1"
              title="Xóa điều kiện"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={addCondition}
        className="text-[12px] text-primary hover:text-primary-dark font-medium transition-colors"
      >
        + Thêm điều kiện
      </button>

      {conditions.length === 0 && (
        <p className="text-[11px] text-faint">Chưa có điều kiện — nhóm sẽ không tự động đồng bộ thành viên</p>
      )}
    </div>
  );
}
