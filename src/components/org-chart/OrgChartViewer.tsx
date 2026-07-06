'use client';

import React, { useCallback, useEffect, useState } from 'react';
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
import dagre from 'dagre';
import { Users, Briefcase, X, ChevronRight, Edit2, Eye } from 'lucide-react';

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

interface OrgDetail {
  id: string;
  name: string;
  code: string;
  type: string;
  description: string | null;
  positions: { id: string; title: string; code: string | null; level: string | null; _count: { users: number } }[];
  users: { id: string; fullName: string; jobTitle: string | null; role: string }[];
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
  const { name, code, type, userCount, positionCount, isSelected, onClick } = data as {
    name: string;
    code: string;
    type: string;
    userCount?: number;
    positionCount?: number;
    isSelected?: boolean;
    onClick?: () => void;
  };

  const bg = TYPE_BG[type] ?? '#f9fafb';
  const border = TYPE_BORDER[type] ?? '#6b7280';
  const typeLabel = TYPE_LABELS[type] ?? type;

  return (
    <div
      onClick={onClick}
      style={{
        background: bg,
        borderColor: isSelected ? '#185FA5' : border,
        borderWidth: isSelected ? 2 : 1.5,
        boxShadow: isSelected ? '0 0 0 3px rgba(24,95,165,0.2)' : '0 1px 3px rgba(0,0,0,0.08)',
      }}
      className="border rounded-xl p-3 min-w-[180px] max-w-[220px] cursor-pointer transition-all hover:shadow-md"
    >
      <Handle type="target" position={Position.Top} className="opacity-0" />

      <div className="flex items-start justify-between gap-1 mb-1">
        <span
          style={{ color: border, backgroundColor: `${border}18` }}
          className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wide"
        >
          {typeLabel}
        </span>
      </div>

      <div className="font-semibold text-[12px] text-gray-800 leading-tight">{name}</div>
      <div className="text-[10px] text-gray-400 mt-0.5 font-mono">{code}</div>

      {(userCount !== undefined || positionCount !== undefined) && (
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

// ── Dagre layout ───────────────────────────────────────────────

const NODE_WIDTH = 220;
const NODE_HEIGHT = 100;

function applyDagreLayout(nodes: Node[], edges: Edge[]): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', ranksep: 70, nodesep: 30 });

  nodes.forEach((n) => g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT }));
  edges.forEach((e) => g.setEdge(e.source, e.target));

  dagre.layout(g);

  return {
    nodes: nodes.map((n) => {
      const pos = g.node(n.id);
      return { ...n, position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 } };
    }),
    edges,
  };
}

// ── Flat → RF nodes/edges ─────────────────────────────────────

function buildGraph(
  orgs: OrgNode[],
  selectedId: string | null,
  onSelect: (id: string) => void,
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
      onClick: () => onSelect(o.id),
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

  return applyDagreLayout(nodes, edges);
}

// ── Side Panel ────────────────────────────────────────────────

function OrgSidePanel({
  orgDetail,
  onClose,
  accessToken,
}: {
  orgDetail: OrgDetail | null;
  onClose: () => void;
  accessToken: string;
}) {
  if (!orgDetail) return null;

  return (
    <div className="absolute top-0 right-0 h-full w-72 bg-white border-l border-gray-200 shadow-lg flex flex-col z-20">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div>
          <p className="text-[13px] font-semibold text-gray-800 leading-tight">{orgDetail.name}</p>
          <p className="text-[10px] text-gray-400 font-mono">{orgDetail.code}</p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Description */}
        {orgDetail.description && (
          <p className="text-[11px] text-gray-500 leading-relaxed">{orgDetail.description}</p>
        )}

        {/* Positions */}
        <div>
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
            <Briefcase size={10} /> Vị trí ({orgDetail.positions.length})
          </p>
          {orgDetail.positions.length === 0 ? (
            <p className="text-[11px] text-gray-400 italic">Chưa có vị trí nào</p>
          ) : (
            <div className="space-y-1">
              {orgDetail.positions.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between px-2.5 py-1.5 bg-gray-50 rounded-lg"
                >
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
          )}
        </div>

        {/* Users */}
        <div>
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
            <Users size={10} /> Nhân viên ({orgDetail.users.length})
          </p>
          {orgDetail.users.length === 0 ? (
            <p className="text-[11px] text-gray-400 italic">Chưa có nhân viên</p>
          ) : (
            <div className="space-y-1">
              {orgDetail.users.slice(0, 10).map((u) => (
                <div key={u.id} className="flex items-center gap-2 px-2.5 py-1.5 bg-gray-50 rounded-lg">
                  <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[9px] font-semibold flex items-center justify-center flex-shrink-0">
                    {u.fullName.split(' ').slice(-1)[0]?.[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-gray-700 truncate">{u.fullName}</p>
                    <p className="text-[10px] text-gray-400 truncate">{u.jobTitle ?? u.role}</p>
                  </div>
                </div>
              ))}
              {orgDetail.users.length > 10 && (
                <p className="text-[10px] text-gray-400 text-center pt-1">+{orgDetail.users.length - 10} người khác</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────

function OrgChartInner({ companyId, accessToken, canEdit = false }: OrgChartViewerProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [orgs, setOrgs] = useState<OrgNode[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [orgDetail, setOrgDetail] = useState<OrgDetail | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const { fitView } = useReactFlow();

  const headers = { Authorization: `Bearer ${accessToken}` };

  // Load all orgs with stats
  const loadOrgs = useCallback(() => {
    fetch(`/api/organizations/${companyId}/flat?withStats=true`, { headers })
      .then((r) => r.json())
      .then((res) => { if (res.success) setOrgs(res.data); })
      .catch(console.error);
  }, [companyId]); // eslint-disable-line

  useEffect(() => { loadOrgs(); }, [loadOrgs]);

  // Rebuild graph whenever orgs or selection change
  useEffect(() => {
    if (!orgs.length) return;
    const { nodes: newNodes, edges: newEdges } = buildGraph(orgs, selectedId, setSelectedId);
    setNodes(newNodes);
    setEdges(newEdges);
    setTimeout(() => fitView({ padding: 0.15 }), 100);
  }, [orgs, selectedId, setNodes, setEdges, fitView]);

  // Load side panel detail when a node is selected
  useEffect(() => {
    if (!selectedId) { setOrgDetail(null); return; }

    fetch(`/api/organizations/${selectedId}`, { headers })
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setOrgDetail(res.data as OrgDetail);
      })
      .catch(console.error);
  }, [selectedId]); // eslint-disable-line

  const handleDeselect = useCallback(() => {
    setSelectedId(null);
    setOrgDetail(null);
  }, []);

  return (
    <div className="relative w-full h-full">
      {/* Toolbar */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
        {canEdit && (
          <button
            onClick={() => setIsEditMode(!isEditMode)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-colors ${
              isEditMode
                ? 'bg-primary text-white border-primary'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {isEditMode ? <Edit2 size={12} /> : <Eye size={12} />}
            {isEditMode ? 'Đang chỉnh sửa' : 'Chỉnh sửa'}
          </button>
        )}
      </div>

      <div className="absolute top-3 right-3 z-10">
        <button
          onClick={() => {
            const a = document.createElement('a');
            a.href = '#';
            a.download = `org-chart-${companyId}.png`;
            a.click();
          }}
          className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-[11px] font-medium text-gray-600 hover:bg-gray-50 transition-colors shadow-sm"
        >
          Xuất PNG
        </button>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-right"
        nodesDraggable={isEditMode}
        nodesConnectable={isEditMode}
        onPaneClick={handleDeselect}
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
