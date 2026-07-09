'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  Controls,
  MiniMap,
  Background,
  Handle,
  Position,
  useReactFlow,
  type Node,
  type Edge,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Users, Briefcase, X, Edit2, Eye, Plus, AlertTriangle,
  ChevronRight, Crown, UserMinus, Search, Move,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────

interface OrgNode {
  id: string;
  name: string;
  code: string;
  type: string;
  parentId: string | null;
  userCount?: number;
  positionCount?: number;
}

interface OrgMember {
  id: string;
  fullName: string;
  jobTitle: string | null;
  roles: string[];
}

interface OrgDetail {
  id: string;
  name: string;
  code: string;
  type: string;
  description: string | null;
  positions: { id: string; title: string; code: string | null; level: string | null; _count: { users: number } }[];
  users: OrgMember[];
}

interface UserItem {
  id: string;
  fullName: string;
  email: string;
  jobTitle: string | null;
}

interface OrgChartViewerProps {
  companyId: string;
  accessToken: string;
  canEdit?: boolean;
}

// ── Colors per org type ────────────────────────────────────────

const TYPE_BG: Record<string, string> = {
  group:   '#f3f0ff',
  company: '#eff6ff',
  dept:    '#f0fdf4',
  team:    '#fefce8',
};

const TYPE_BORDER: Record<string, string> = {
  group:   '#7c3aed',
  company: '#2563eb',
  dept:    '#16a34a',
  team:    '#ca8a04',
};

const TYPE_LABELS: Record<string, string> = {
  group: 'Tập đoàn',
  company: 'Công ty',
  dept: 'Phòng ban',
  team: 'Tổ nhóm',
};

// ── Custom node component ──────────────────────────────────────

function OrgNodeCard({ data }: NodeProps) {
  const {
    name, code, type, userCount, positionCount, isSelected, onClick,
    isEditMode, onAddChild, onDeactivate, onDrop, isDraggable, onMove, isDragTarget,
  } = data as {
    name: string;
    code: string;
    type: string;
    userCount?: number;
    positionCount?: number;
    isSelected?: boolean;
    isEditMode?: boolean;
    isDraggable?: boolean;
    isDragTarget?: boolean;
    onClick?: () => void;
    onAddChild?: () => void;
    onDeactivate?: () => void;
    onDrop?: (userId: string) => void;
    onMove?: () => void;
  };

  const [isDragOver, setIsDragOver] = useState(false);
  const bg = TYPE_BG[type] ?? '#f9fafb';
  const border = TYPE_BORDER[type] ?? '#6b7280';
  const typeLabel = TYPE_LABELS[type] ?? type;
  const canDeactivate = type !== 'company' && type !== 'group';

  return (
    <div
      onClick={onClick}
      onDragOver={(e) => { if (isEditMode) { e.preventDefault(); setIsDragOver(true); } }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        const userId = e.dataTransfer.getData('userId');
        if (userId && onDrop) onDrop(userId);
      }}
      style={{
        background: isDragOver ? `${TYPE_BORDER[type] ?? '#3b82f6'}15` : bg,
        borderColor: isDragTarget ? '#3b82f6' : isDragOver ? (TYPE_BORDER[type] ?? '#3b82f6') : isSelected ? '#185FA5' : border,
        borderWidth: isDragOver || isSelected || isDragTarget ? 2 : 1.5,
        borderStyle: isDragOver ? 'dashed' : 'solid',
        boxShadow: isDragTarget
          ? '0 0 0 3px rgba(59,130,246,0.35)'
          : isSelected
          ? '0 0 0 3px rgba(24,95,165,0.2)'
          : '0 1px 3px rgba(0,0,0,0.08)',
      }}
      className="border rounded-xl p-3 min-w-[180px] max-w-[220px] cursor-pointer transition-all hover:shadow-md relative"
    >
      <Handle type="target" position={Position.Top} className="opacity-0" />

      <div className="flex items-start justify-between gap-1 mb-1">
        <span
          style={{ color: border, backgroundColor: `${border}18` }}
          className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wide"
        >
          {typeLabel}
        </span>

        {/* Context menu buttons — show on hover in edit mode */}
        {isEditMode && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              title="Thêm đơn vị con"
              onClick={(e) => { e.stopPropagation(); onAddChild?.(); }}
              className="w-5 h-5 flex items-center justify-center rounded bg-green-100 text-green-700 hover:bg-green-200 text-[10px] transition-colors"
            >
              <Plus size={10} />
            </button>
            {onMove && (
              <button
                title="Di chuyển vào..."
                onClick={(e) => { e.stopPropagation(); onMove(); }}
                className="w-5 h-5 flex items-center justify-center rounded bg-indigo-100 text-indigo-600 hover:bg-indigo-200 text-[10px] transition-colors"
              >
                <Move size={10} />
              </button>
            )}
            {canDeactivate && (
              <button
                title="Vô hiệu hóa"
                onClick={(e) => { e.stopPropagation(); onDeactivate?.(); }}
                className="w-5 h-5 flex items-center justify-center rounded bg-red-100 text-red-600 hover:bg-red-200 text-[10px] transition-colors"
              >
                <AlertTriangle size={10} />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="font-semibold text-[12px] text-gray-800 leading-tight">{name}</div>
      <div className="text-[10px] text-gray-400 mt-0.5 font-mono">{code}</div>

      {isDragOver && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl pointer-events-none">
          <span className="text-[10px] font-medium" style={{ color: border }}>Thả để thêm</span>
        </div>
      )}

      {(userCount !== undefined || positionCount !== undefined) && !isDragOver && (
        <div className="flex items-center gap-3 mt-2 pt-2 border-t border-gray-200/80">
          {userCount !== undefined && (
            <span className="flex items-center gap-1 text-[10px] text-gray-500">
              <Users size={10} /> {userCount} NV
            </span>
          )}
          {positionCount !== undefined && (
            <span className="flex items-center gap-1 text-[10px] text-gray-500">
              <Briefcase size={10} /> {positionCount} VT
            </span>
          )}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
}

const nodeTypes = { orgNode: OrgNodeCard };

// ── Tree layout (custom Reingold-Tilford style) ───────────────
//
// Thuật toán:
//   1. DFS post-order: leaf nodes được đặt từ trái → phải theo thứ tự duyệt.
//   2. Mỗi node cha được căn giữa giữa node con đầu tiên và node con cuối cùng.
//   3. Kết quả: không bao giờ có node đè nhau, mọi cha nằm chính giữa các con.
//
// Không dùng dagre vì dagre center parent theo subtree-width, dẫn đến lệch
// khi các nhánh anh em có số cháu không đều.

const NODE_WIDTH  = 220;
const NODE_HEIGHT = 110;
const H_GAP       = 50;   // khoảng cách ngang giữa các sibling
const V_GAP       = 80;   // khoảng cách dọc giữa các level

function computeTreeLayout(nodes: Node[], edges: Edge[]): { nodes: Node[]; edges: Edge[] } {
  if (nodes.length === 0) return { nodes, edges };

  // Build adjacency
  const childrenOf = new Map<string, string[]>();
  const parentOf   = new Map<string, string>();
  const nodeIdSet  = new Set(nodes.map((n) => n.id));
  nodes.forEach((n) => childrenOf.set(n.id, []));
  edges.forEach((e) => {
    // Skip edges whose source is not in the node set (orphaned / cross-company edges)
    if (!nodeIdSet.has(e.source)) return;
    childrenOf.get(e.source)?.push(e.target);
    parentOf.set(e.target, e.source);
  });

  // Find root(s)
  const roots = nodes.filter((n) => !parentOf.has(n.id)).map((n) => n.id);
  if (roots.length === 0) return { nodes, edges };

  // BFS to assign depth (Y level)
  const depthOf = new Map<string, number>();
  const bfsQ: string[] = [];
  roots.forEach((r) => { depthOf.set(r, 0); bfsQ.push(r); });
  for (let i = 0; i < bfsQ.length; i++) {
    const id = bfsQ[i];
    const d  = depthOf.get(id)!;
    for (const c of childrenOf.get(id) ?? []) {
      depthOf.set(c, d + 1);
      bfsQ.push(c);
    }
  }

  // DFS post-order: assign X to leaves sequentially, center parents over children
  const xOf = new Map<string, number>();
  let leafIndex = 0;
  const step = NODE_WIDTH + H_GAP;

  function dfs(id: string): void {
    const children = childrenOf.get(id) ?? [];
    if (children.length === 0) {
      // Leaf: place at next slot
      xOf.set(id, leafIndex * step);
      leafIndex++;
    } else {
      for (const c of children) dfs(c);
      // Center parent between first and last child
      const x0 = xOf.get(children[0])!;
      const xN = xOf.get(children[children.length - 1])!;
      xOf.set(id, (x0 + xN) / 2);
    }
  }

  for (const root of roots) dfs(root);

  return {
    nodes: nodes.map((n) => ({
      ...n,
      position: {
        x: xOf.get(n.id) ?? 0,
        y: (depthOf.get(n.id) ?? 0) * (NODE_HEIGHT + V_GAP),
      },
    })),
    edges,
  };
}

// ── Flat → RF nodes/edges ─────────────────────────────────────

function buildGraph(
  orgs: OrgNode[],
  selectedId: string | null,
  isEditMode: boolean,
  dragOverNodeId: string | null,
  onSelect: (id: string) => void,
  onAddChild: (id: string) => void,
  onDeactivate: (id: string) => void,
  onDrop: (userId: string, orgId: string) => void,
  onMove: (id: string) => void,
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = orgs.map((o) => ({
    id: o.id,
    type: 'orgNode',
    position: { x: 0, y: 0 },
    data: {
      name: o.name,
      code: o.code,
      type: o.type,
      userCount: o.userCount,
      positionCount: o.positionCount,
      isSelected: o.id === selectedId,
      isEditMode,
      isDragTarget: dragOverNodeId === o.id,
      onClick: () => onSelect(o.id),
      onAddChild: isEditMode ? () => onAddChild(o.id) : undefined,
      onDeactivate: isEditMode ? () => onDeactivate(o.id) : undefined,
      onDrop: (userId: string) => onDrop(userId, o.id),
      onMove: isEditMode ? () => onMove(o.id) : undefined,
    },
  }));

  const edges: Edge[] = orgs
    .filter((o) => o.parentId)
    .map((o) => ({
      id: `e-${o.parentId}-${o.id}`,
      source: o.parentId!,
      target: o.id,
      type: 'smoothstep',
      style: { stroke: '#d1d5db', strokeWidth: 1.5 },
    }));

  return computeTreeLayout(nodes, edges);
}

// ── Add Child Modal ────────────────────────────────────────────

function AddChildModal({
  parentName,
  parentId,
  companyId,
  accessToken,
  onClose,
  onCreated,
}: {
  parentName: string;
  parentId: string;
  companyId: string;
  accessToken: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({ name: '', code: '', type: 'dept' as 'dept' | 'team' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/organizations', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, parentId, companyId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Lỗi tạo đơn vị');
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi không xác định');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="text-[13px] font-semibold text-gray-800">Thêm đơn vị trực thuộc</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{parentName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div className="space-y-1">
            <label className="block text-[11px] font-medium text-gray-600">Tên đơn vị *</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="VD: Phòng Kỹ thuật"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-gray-600">Mã *</label>
              <input
                required
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="VD: KT"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-gray-600">Loại</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as 'dept' | 'team' })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              >
                <option value="dept">Phòng ban</option>
                <option value="team">Tổ nhóm</option>
              </select>
            </div>
          </div>
          {error && <p className="text-[11px] text-red-500">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-200 rounded-lg px-4 py-2 text-[12px] text-gray-600 hover:bg-gray-50 transition-colors">
              Hủy
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 text-[12px] font-medium transition-colors disabled:opacity-50">
              {saving ? 'Đang tạo...' : 'Tạo ngay'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Deactivate Wizard ──────────────────────────────────────────

function DeactivateWizard({
  orgId,
  orgName,
  companyId,
  accessToken,
  onClose,
  onDeactivated,
}: {
  orgId: string;
  orgName: string;
  companyId: string;
  accessToken: string;
  onClose: () => void;
  onDeactivated: () => void;
}) {
  const [step, setStep] = useState<'impact' | 'users' | 'courses' | 'confirm'>('impact');
  const [impact, setImpact] = useState<{ userCount: number; courseAssignmentCount: number; subOrgCount: number } | null>(null);
  const [targetOrgId, setTargetOrgId] = useState('');
  const [migrateCourses, setMigrateCourses] = useState(false);
  const [siblingOrgs, setSiblingOrgs] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };

  useEffect(() => {
    // Load impact
    fetch(`/api/organizations/${orgId}/impact`, { headers })
      .then((r) => r.json())
      .then((res) => { if (res.success) setImpact(res.data); });
    // Load sibling orgs for migration target
    fetch(`/api/organizations/${companyId}/flat`, { headers })
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setSiblingOrgs(res.data.filter((o: OrgNode) => o.id !== orgId));
        }
      });
  }, []); // eslint-disable-line

  const handleConfirm = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/organizations/${orgId}/deactivate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ targetOrgId: targetOrgId || undefined, migrateCourseAssignments: migrateCourses }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Lỗi vô hiệu hóa');
      onDeactivated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi không xác định');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <p className="text-[13px] font-semibold text-gray-800">Vô hiệu hóa: {orgName}</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>

        <div className="p-5">
          {/* Step: Impact */}
          {step === 'impact' && (
            <div className="space-y-4">
              {!impact ? (
                <p className="text-[12px] text-gray-400 text-center py-4">Đang kiểm tra tác động...</p>
              ) : (
                <>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
                    <p className="text-[12px] font-semibold text-amber-800 flex items-center gap-2">
                      <AlertTriangle size={14} /> Tác động khi vô hiệu hóa
                    </p>
                    <div className="space-y-1 text-[12px] text-amber-700">
                      <p>👥 <strong>{impact.userCount}</strong> nhân viên đang thuộc đơn vị này</p>
                      <p>📚 <strong>{impact.courseAssignmentCount}</strong> khóa học đang được giao</p>
                      {impact.subOrgCount > 0 && (
                        <p>🏢 <strong>{impact.subOrgCount}</strong> đơn vị con sẽ bị vô hiệu hóa theo</p>
                      )}
                      <p className="text-green-700 mt-2">✅ Lịch sử học tập sẽ được GIỮ NGUYÊN</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={onClose}
                      className="flex-1 border border-gray-200 rounded-lg px-4 py-2 text-[12px] text-gray-600 hover:bg-gray-50 transition-colors">
                      Quay lại
                    </button>
                    <button onClick={() => setStep('users')}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-lg px-4 py-2 text-[12px] font-medium transition-colors">
                      Tiếp tục →
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step: Users */}
          {step === 'users' && (
            <div className="space-y-4">
              <p className="text-[12px] text-gray-700 font-medium">Xử lý {impact?.userCount ?? 0} nhân viên</p>
              <div className="space-y-2">
                <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                  <input type="radio" name="migrate" checked={targetOrgId === ''} onChange={() => setTargetOrgId('')} className="mt-0.5" />
                  <div>
                    <p className="text-[12px] font-medium text-gray-700">Không chuyển</p>
                    <p className="text-[11px] text-gray-400">Nhân viên không thuộc bộ phận cụ thể nào</p>
                  </div>
                </label>
                <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                  <input type="radio" name="migrate" checked={targetOrgId !== ''} onChange={() => setTargetOrgId(siblingOrgs[0]?.id ?? '')} className="mt-0.5" />
                  <div className="flex-1">
                    <p className="text-[12px] font-medium text-gray-700">Chuyển sang bộ phận khác</p>
                    {targetOrgId !== '' && (
                      <select
                        value={targetOrgId}
                        onChange={(e) => setTargetOrgId(e.target.value)}
                        className="mt-1.5 w-full border border-gray-200 rounded-lg px-2 py-1.5 text-[11px] focus:outline-none focus:border-blue-400"
                      >
                        {siblingOrgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                      </select>
                    )}
                  </div>
                </label>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setStep('impact')}
                  className="flex-1 border border-gray-200 rounded-lg px-4 py-2 text-[12px] text-gray-600 hover:bg-gray-50 transition-colors">
                  ← Quay lại
                </button>
                <button onClick={() => setStep('courses')}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-lg px-4 py-2 text-[12px] font-medium transition-colors">
                  Tiếp tục →
                </button>
              </div>
            </div>
          )}

          {/* Step: Courses */}
          {step === 'courses' && (
            <div className="space-y-4">
              <p className="text-[12px] text-gray-700 font-medium">{impact?.courseAssignmentCount ?? 0} khóa học đang giao cho bộ phận này</p>
              <div className="space-y-2">
                <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                  <input type="radio" name="courses" checked={!migrateCourses} onChange={() => setMigrateCourses(false)} className="mt-0.5" />
                  <div>
                    <p className="text-[12px] font-medium text-gray-700">Giữ nguyên</p>
                    <p className="text-[11px] text-gray-400">NV đã đăng ký vẫn tiếp tục học, không giao thêm</p>
                  </div>
                </label>
                {targetOrgId && (
                  <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                    <input type="radio" name="courses" checked={migrateCourses} onChange={() => setMigrateCourses(true)} className="mt-0.5" />
                    <div>
                      <p className="text-[12px] font-medium text-gray-700">Chuyển sang bộ phận mới</p>
                      <p className="text-[11px] text-gray-400">Giao lại toàn bộ cho bộ phận đích</p>
                    </div>
                  </label>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setStep('users')}
                  className="flex-1 border border-gray-200 rounded-lg px-4 py-2 text-[12px] text-gray-600 hover:bg-gray-50 transition-colors">
                  ← Quay lại
                </button>
                <button onClick={() => setStep('confirm')}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-lg px-4 py-2 text-[12px] font-medium transition-colors">
                  Xem lại →
                </button>
              </div>
            </div>
          )}

          {/* Step: Confirm */}
          {step === 'confirm' && (
            <div className="space-y-4">
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2 text-[12px] text-gray-700">
                <p className="font-semibold text-gray-800 mb-2">Xác nhận vô hiệu hóa "{orgName}"</p>
                <p>👥 {impact?.userCount} NV → {targetOrgId ? `chuyển sang bộ phận khác` : 'không chuyển'}</p>
                <p>📚 {impact?.courseAssignmentCount} khóa học → {migrateCourses ? 'chuyển sang bộ phận mới' : 'giữ nguyên'}</p>
                <p>📊 Lịch sử học tập: <span className="text-green-600 font-medium">được giữ nguyên</span></p>
              </div>
              {error && <p className="text-[11px] text-red-500">{error}</p>}
              <div className="flex gap-2">
                <button onClick={() => setStep('courses')}
                  className="flex-1 border border-gray-200 rounded-lg px-4 py-2 text-[12px] text-gray-600 hover:bg-gray-50 transition-colors">
                  ← Quay lại
                </button>
                <button onClick={handleConfirm} disabled={saving}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-lg px-4 py-2 text-[12px] font-medium transition-colors disabled:opacity-50">
                  {saving ? 'Đang xử lý...' : 'Xác nhận vô hiệu hóa'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Side Panel ────────────────────────────────────────────────

function OrgSidePanel({
  orgDetail,
  onClose,
  accessToken,
  isEditMode,
  onMemberChanged,
}: {
  orgDetail: OrgDetail | null;
  onClose: () => void;
  accessToken: string;
  isEditMode: boolean;
  onMemberChanged: () => void;
}) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };

  if (!orgDetail) return null;

  const setAsDeptHead = async (userId: string) => {
    setActionLoading(`head-${userId}`);
    try {
      await fetch(`/api/users/${userId}/roles`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ role: 'dept_head', organizationId: orgDetail.id }),
      });
      onMemberChanged();
    } finally {
      setActionLoading(null);
    }
  };

  const removeAsDeptHead = async (userId: string) => {
    setActionLoading(`unhead-${userId}`);
    try {
      await fetch(`/api/users/${userId}/roles`, {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ role: 'dept_head', organizationId: orgDetail.id }),
      });
      onMemberChanged();
    } finally {
      setActionLoading(null);
    }
  };

  const removeMember = async (userId: string) => {
    setActionLoading(`remove-${userId}`);
    try {
      await fetch(`/api/users/${userId}/roles`, {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ role: 'learner', organizationId: orgDetail.id }),
      });
      onMemberChanged();
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="absolute top-0 right-0 h-full w-72 bg-white border-l border-gray-200 shadow-lg flex flex-col z-20">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div>
          <p className="text-[13px] font-semibold text-gray-800 leading-tight">{orgDetail.name}</p>
          <p className="text-[10px] text-gray-400 font-mono">{orgDetail.code}</p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {orgDetail.description && (
          <p className="text-[11px] text-gray-500 leading-relaxed">{orgDetail.description}</p>
        )}

        {/* Positions */}
        {orgDetail.positions.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
              <Briefcase size={10} /> Vị trí ({orgDetail.positions.length})
            </p>
            <div className="space-y-1">
              {orgDetail.positions.map((p) => (
                <div key={p.id} className="flex items-center justify-between px-2.5 py-1.5 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-[11px] font-medium text-gray-700">{p.title}</p>
                    <p className="text-[10px] text-gray-400">{p.code ?? ''}{p.level ? ` · ${p.level}` : ''}</p>
                  </div>
                  <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                    <Users size={9} /> {p._count.users}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Members */}
        <div>
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
            <Users size={10} /> Nhân viên ({orgDetail.users.length})
          </p>
          {orgDetail.users.length === 0 ? (
            <p className="text-[11px] text-gray-400 italic">
              {isEditMode ? 'Kéo nhân viên từ danh sách vào đây' : 'Chưa có nhân viên'}
            </p>
          ) : (
            <div className="space-y-1.5">
              {orgDetail.users.map((u) => {
                const isDeptHead = u.roles.includes('dept_head');
                const isLoading = actionLoading?.includes(u.id);
                return (
                  <div key={u.id} className="px-2.5 py-2 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-[9px] font-semibold flex items-center justify-center flex-shrink-0">
                        {u.fullName.split(' ').slice(-1)[0]?.[0]?.toUpperCase() ?? '?'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <p className="text-[11px] font-medium text-gray-700 truncate">{u.fullName}</p>
                          {isDeptHead && (
                            <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[9px] font-semibold flex-shrink-0">
                              <Crown size={8} /> Trưởng
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-400 truncate">{u.jobTitle ?? ''}</p>
                      </div>
                    </div>

                    {isEditMode && (
                      <div className="flex gap-1 mt-1.5 pl-8">
                        {isDeptHead ? (
                          <button
                            onClick={() => removeAsDeptHead(u.id)}
                            disabled={!!isLoading}
                            className="text-[10px] text-amber-600 hover:text-amber-800 flex items-center gap-0.5 disabled:opacity-50 transition-colors"
                          >
                            <Crown size={9} /> Bỏ trưởng
                          </button>
                        ) : (
                          <button
                            onClick={() => setAsDeptHead(u.id)}
                            disabled={!!isLoading}
                            className="text-[10px] text-blue-600 hover:text-blue-800 flex items-center gap-0.5 disabled:opacity-50 transition-colors"
                          >
                            <Crown size={9} /> Đặt làm trưởng
                          </button>
                        )}
                        <span className="text-gray-200 mx-1">|</span>
                        <button
                          onClick={() => removeMember(u.id)}
                          disabled={!!isLoading}
                          className="text-[10px] text-red-500 hover:text-red-700 flex items-center gap-0.5 disabled:opacity-50 transition-colors"
                        >
                          <UserMinus size={9} /> Gỡ
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── User List Panel ────────────────────────────────────────────

function UserListPanel({
  companyId,
  accessToken,
}: {
  companyId: string;
  accessToken: string;
}) {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch(`/api/users?limit=500`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => r.json())
      .then((res) => { if (res.success) setUsers(res.data ?? []); })
      .catch(console.error);
  }, [companyId]); // eslint-disable-line

  const filtered = users.filter((u) =>
    u.fullName.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="w-56 flex-shrink-0 border-r border-gray-200 flex flex-col bg-gray-50">
      <div className="p-2 border-b border-gray-200">
        <div className="relative">
          <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm nhân viên..."
            className="w-full pl-7 pr-3 py-1.5 text-[11px] border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 bg-white"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
        <p className="text-[9px] text-gray-400 px-1.5 pb-1 uppercase tracking-wider font-semibold">
          Kéo thả vào sơ đồ
        </p>
        {filtered.slice(0, 80).map((u) => (
          <div
            key={u.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('userId', u.id);
              e.dataTransfer.effectAllowed = 'copy';
            }}
            className="px-2 py-1.5 bg-white border border-gray-100 rounded-lg cursor-grab active:cursor-grabbing hover:border-blue-200 hover:bg-blue-50 transition-colors"
          >
            <p className="text-[11px] font-medium text-gray-700 truncate">{u.fullName}</p>
            <p className="text-[9px] text-gray-400 truncate">{u.jobTitle ?? u.email}</p>
          </div>
        ))}
        {filtered.length > 80 && (
          <p className="text-[10px] text-gray-400 text-center py-1">+{filtered.length - 80} người khác — tìm kiếm để lọc</p>
        )}
        {filtered.length === 0 && (
          <p className="text-[11px] text-gray-400 text-center py-4">Không tìm thấy</p>
        )}
      </div>
    </div>
  );
}

// ── MoveToParentModal ─────────────────────────────────────────

function MoveToParentModal({
  node,
  orgs,
  accessToken,
  onClose,
  onMoved,
}: {
  node: { id: string; name: string };
  orgs: OrgNode[];
  accessToken: string;
  onClose: () => void;
  onMoved: () => void;
}) {
  const [search, setSearch] = useState('');
  const [selectedParentId, setSelectedParentId] = useState('');
  const [loading, setLoading] = useState(false);

  function getDescendantIds(nodeId: string): Set<string> {
    const ids = new Set<string>();
    const queue = [nodeId];
    while (queue.length) {
      const cur = queue.shift()!;
      ids.add(cur);
      orgs.filter((o) => o.parentId === cur).forEach((o) => queue.push(o.id));
    }
    return ids;
  }

  const excluded = getDescendantIds(node.id);
  const candidates = orgs.filter((o) => !excluded.has(o.id));
  const filtered = candidates.filter(
    (o) =>
      o.name.toLowerCase().includes(search.toLowerCase()) ||
      o.code.toLowerCase().includes(search.toLowerCase()),
  );

  async function handleConfirm() {
    if (!selectedParentId || loading) return;
    setLoading(true);
    await fetch(`/api/organizations/${node.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ parentId: selectedParentId }),
    });
    setLoading(false);
    onMoved();
    onClose();
  }

  const typeBadgeColor: Record<string, string> = {
    group: 'bg-purple-100 text-purple-700',
    company: 'bg-blue-100 text-blue-700',
    dept: 'bg-green-100 text-green-700',
    team: 'bg-yellow-100 text-yellow-700',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-[420px] flex flex-col max-h-[560px]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">Di chuyển vào...</h3>
            <p className="text-xs text-gray-500 mt-0.5">Đơn vị: <strong>{node.name}</strong></p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm tên hoặc mã phòng ban..."
              className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              autoFocus
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-2 py-2 min-h-0">
          {filtered.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-6">Không tìm thấy</p>
          )}
          {filtered.map((o) => (
            <button
              key={o.id}
              onClick={() => setSelectedParentId(o.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors mb-0.5 ${
                selectedParentId === o.id
                  ? 'bg-blue-50 border border-blue-200'
                  : 'hover:bg-gray-50 border border-transparent'
              }`}
            >
              <span
                className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wide flex-shrink-0 ${
                  typeBadgeColor[o.type] ?? 'bg-gray-100 text-gray-600'
                }`}
              >
                {TYPE_LABELS[o.type] ?? o.type}
              </span>
              <span className="text-xs font-medium text-gray-800 flex-1 truncate">{o.name}</span>
              <span className="text-[10px] text-gray-400 font-mono flex-shrink-0">{o.code}</span>
              {selectedParentId === o.id && (
                <span className="text-blue-600 flex-shrink-0">✓</span>
              )}
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600"
          >
            Hủy
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedParentId || loading}
            className="px-4 py-2 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            <Move size={11} />
            {loading ? 'Đang di chuyển...' : 'Di chuyển'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────

interface ReparentConfirm {
  nodeId: string;
  nodeName: string;
  newParentId: string;
  newParentName: string;
}

function ReparentConfirmModal({
  confirm,
  onConfirm,
  onCancel,
}: {
  confirm: ReparentConfirm;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-[380px] p-6">
        <h3 className="font-semibold text-gray-900 mb-3">Di chuyển đơn vị</h3>
        <p className="text-sm text-gray-600 mb-5">
          Di chuyển <strong>{confirm.nodeName}</strong> vào <strong>{confirm.newParentName}</strong>?
          <br />
          <span className="text-xs text-gray-400 mt-1 block">Tất cả nhân viên và đơn vị con sẽ giữ nguyên.</span>
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50"
          >
            Hủy
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700"
          >
            Di chuyển
          </button>
        </div>
      </div>
    </div>
  );
}

function OrgChartInner({ companyId, accessToken, canEdit = false }: OrgChartViewerProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [orgs, setOrgs] = useState<OrgNode[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [orgDetail, setOrgDetail] = useState<OrgDetail | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [addChildTarget, setAddChildTarget] = useState<{ id: string; name: string } | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<{ id: string; name: string } | null>(null);
  const [moveTarget, setMoveTarget] = useState<{ id: string; name: string } | null>(null);
  const [reparentConfirm, setReparentConfirm] = useState<ReparentConfirm | null>(null);
  const [dragOverNodeId, setDragOverNodeId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const { fitView } = useReactFlow();

  const headers = { Authorization: `Bearer ${accessToken}` };

  const loadOrgs = useCallback(() => {
    fetch(`/api/organizations/${companyId}/flat?withStats=true`, { headers })
      .then((r) => r.json())
      .then((res) => { if (res.success) setOrgs(res.data); })
      .catch(console.error);
  }, [companyId]); // eslint-disable-line

  const loadOrgDetail = useCallback((id: string) => {
    setDetailLoading(true);
    fetch(`/api/organizations/${id}`, { headers })
      .then((r) => r.json())
      .then((res) => { if (res.success) setOrgDetail(res.data as OrgDetail); })
      .catch(console.error)
      .finally(() => setDetailLoading(false));
  }, []); // eslint-disable-line

  useEffect(() => { loadOrgs(); }, [loadOrgs]);

  useEffect(() => {
    if (!orgs.length) return;
    const { nodes: newNodes, edges: newEdges } = buildGraph(
      orgs, selectedId, isEditMode, dragOverNodeId,
      setSelectedId,
      (id) => {
        const org = orgs.find((o) => o.id === id);
        if (org) setAddChildTarget({ id, name: org.name });
      },
      (id) => {
        const org = orgs.find((o) => o.id === id);
        if (org) setDeactivateTarget({ id, name: org.name });
      },
      handleDrop,
      (id) => {
        const org = orgs.find((o) => o.id === id);
        if (org) setMoveTarget({ id, name: org.name });
      },
    );
    setNodes(newNodes);
    setEdges(newEdges);
    setTimeout(() => fitView({ padding: 0.15 }), 100);
  }, [orgs, selectedId, isEditMode, dragOverNodeId]); // eslint-disable-line

  useEffect(() => {
    if (!selectedId) { setOrgDetail(null); return; }
    loadOrgDetail(selectedId);
  }, [selectedId, loadOrgDetail]);

  async function handleDrop(userId: string, orgId: string) {
    const res = await fetch(`/api/users/${userId}/roles`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'learner', organizationId: orgId }),
    });
    if (res.ok) {
      loadOrgs();
      if (selectedId === orgId) loadOrgDetail(orgId);
    }
  }

  const handleDeselect = useCallback(() => {
    setSelectedId(null);
    setOrgDetail(null);
  }, []);

  const handleNodeDrag = useCallback(
    (_event: React.MouseEvent, draggedNode: { id: string; position: { x: number; y: number } }) => {
      if (!isEditMode) return;
      const cx = draggedNode.position.x + NODE_WIDTH / 2;
      const cy = draggedNode.position.y + NODE_HEIGHT / 2;
      const target = nodes.find(
        (n) =>
          n.id !== draggedNode.id &&
          cx >= n.position.x && cx <= n.position.x + NODE_WIDTH &&
          cy >= n.position.y && cy <= n.position.y + NODE_HEIGHT,
      );
      setDragOverNodeId(target?.id ?? null);
    },
    [isEditMode, nodes],
  );

  const handleNodeDragStop = useCallback(
    (_event: React.MouseEvent, draggedNode: { id: string; position: { x: number; y: number } }) => {
      setDragOverNodeId(null);
      if (!isEditMode) return;
      // Find any other node that overlaps with the dragged node's center
      const cx = draggedNode.position.x + NODE_WIDTH / 2;
      const cy = draggedNode.position.y + NODE_HEIGHT / 2;
      const target = nodes.find((n) => {
        if (n.id === draggedNode.id) return false;
        const nx = n.position.x;
        const ny = n.position.y;
        return cx >= nx && cx <= nx + NODE_WIDTH && cy >= ny && cy <= ny + NODE_HEIGHT;
      });
      if (!target) {
        // No overlap — just reload to reset positions (dagre controls layout)
        loadOrgs();
        return;
      }
      const draggedOrg = orgs.find((o) => o.id === draggedNode.id);
      const targetOrg = orgs.find((o) => o.id === target.id);
      if (!draggedOrg || !targetOrg) { loadOrgs(); return; }
      // Prevent setting parent to itself or to a current child
      if (draggedOrg.parentId === target.id) { loadOrgs(); return; }
      setReparentConfirm({
        nodeId: draggedNode.id,
        nodeName: draggedOrg.name,
        newParentId: target.id,
        newParentName: targetOrg.name,
      });
    },
    [isEditMode, nodes, orgs, loadOrgs],
  );

  async function handleReparentConfirm() {
    if (!reparentConfirm) return;
    const { nodeId, newParentId } = reparentConfirm;
    setReparentConfirm(null);
    await fetch(`/api/organizations/${nodeId}`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ parentId: newParentId }),
    });
    loadOrgs();
  }

  return (
    <div className="flex w-full h-full">
      {/* User list panel — only in edit mode */}
      {isEditMode && canEdit && (
        <UserListPanel companyId={companyId} accessToken={accessToken} />
      )}

      {/* Chart area */}
      <div className="relative flex-1 h-full">
        {/* Toolbar */}
        <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
          {canEdit && (
            <button
              onClick={() => setIsEditMode(!isEditMode)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-colors ${
                isEditMode
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {isEditMode ? <Edit2 size={12} /> : <Eye size={12} />}
              {isEditMode ? 'Đang chỉnh sửa' : 'Chỉnh sửa'}
            </button>
          )}
        </div>

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          proOptions={{ hideAttribution: true }}
          nodesDraggable={isEditMode}
          nodesConnectable={false}
          onPaneClick={handleDeselect}
          onNodeDrag={handleNodeDrag}
          onNodeDragStop={handleNodeDragStop}
        >
          <Controls />
          <MiniMap
            zoomable
            pannable
            nodeColor={(n) => TYPE_BORDER[(n.data as { type: string }).type] ?? '#9ca3af'}
          />
          <Background gap={16} color="#f0f0f0" />
        </ReactFlow>

        {/* Side panel */}
        {selectedId && (
          <OrgSidePanel
            orgDetail={orgDetail}
            onClose={handleDeselect}
            accessToken={accessToken}
            isEditMode={isEditMode}
            onMemberChanged={() => {
              loadOrgs();
              if (selectedId) loadOrgDetail(selectedId);
            }}
          />
        )}
      </div>

      {/* Add child modal */}
      {addChildTarget && (
        <AddChildModal
          parentName={addChildTarget.name}
          parentId={addChildTarget.id}
          companyId={companyId}
          accessToken={accessToken}
          onClose={() => setAddChildTarget(null)}
          onCreated={loadOrgs}
        />
      )}

      {/* Deactivate wizard */}
      {deactivateTarget && (
        <DeactivateWizard
          orgId={deactivateTarget.id}
          orgName={deactivateTarget.name}
          companyId={companyId}
          accessToken={accessToken}
          onClose={() => setDeactivateTarget(null)}
          onDeactivated={() => { loadOrgs(); handleDeselect(); }}
        />
      )}

      {/* Reparent confirmation */}
      {reparentConfirm && (
        <ReparentConfirmModal
          confirm={reparentConfirm}
          onConfirm={handleReparentConfirm}
          onCancel={() => { setReparentConfirm(null); loadOrgs(); }}
        />
      )}

      {/* Move to parent modal */}
      {moveTarget && (
        <MoveToParentModal
          node={moveTarget}
          orgs={orgs}
          accessToken={accessToken}
          onClose={() => setMoveTarget(null)}
          onMoved={() => { setMoveTarget(null); loadOrgs(); }}
        />
      )}
    </div>
  );
}

export function OrgChartViewer(props: OrgChartViewerProps) {
  return (
    <ReactFlowProvider>
      <OrgChartInner {...props} />
    </ReactFlowProvider>
  );
}
