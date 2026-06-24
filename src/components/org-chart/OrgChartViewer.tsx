'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  addEdge,
  Controls,
  MiniMap,
  Background,
  Handle,
  Position,
  useReactFlow,
  type Node,
  type Edge,
  type Connection,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import axios from 'axios';

// ── Types ─────────────────────────────────────────────────────

interface OrgNode {
  id: string;
  name: string;
  code: string;
  type: string;
  parentId: string | null;
}

interface OrgChartViewerProps {
  companyId: string;
  accessToken: string;
}

// ── Colors per org type ────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  group: 'bg-purple-100 border-purple-400 text-purple-800',
  company: 'bg-blue-100 border-blue-400 text-blue-800',
  dept: 'bg-green-100 border-green-400 text-green-800',
  team: 'bg-yellow-100 border-yellow-400 text-yellow-800',
};

const TYPE_LABELS: Record<string, string> = {
  group: 'Tập đoàn',
  company: 'Công ty',
  dept: 'Phòng ban',
  team: 'Tổ nhóm',
};

// ── Custom node component ──────────────────────────────────────

function OrgNodeCard({ data }: NodeProps) {
  const { name, code, type, onExpand, hasChildren } = data as {
    name: string;
    code: string;
    type: string;
    onExpand?: () => void;
    hasChildren?: boolean;
  };

  const colorClass = TYPE_COLORS[type] ?? 'bg-gray-100 border-gray-400 text-gray-800';
  const typeLabel = TYPE_LABELS[type] ?? type;

  return (
    <div
      className={`relative border-2 rounded-lg p-3 min-w-[160px] max-w-[200px] shadow-sm ${colorClass}`}
    >
      <Handle type="target" position={Position.Top} className="opacity-0" />

      <div className="font-semibold text-sm leading-tight">{name}</div>
      <div className="text-xs opacity-70 mt-0.5">{code}</div>

      <span className="inline-block mt-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-white/60">
        {typeLabel}
      </span>

      {hasChildren && onExpand && (
        <button
          onClick={onExpand}
          className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-xs bg-white border rounded-full px-2 py-0.5 shadow hover:bg-gray-50"
        >
          + Mở rộng
        </button>
      )}

      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
}

const nodeTypes = { orgNode: OrgNodeCard };

// ── Dagre layout ───────────────────────────────────────────────

const NODE_WIDTH = 200;
const NODE_HEIGHT = 90;

function applyDagreLayout(nodes: Node[], edges: Edge[]): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', ranksep: 60, nodesep: 30 });

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
  onExpand: (id: string) => void,
  expandedIds: Set<string>,
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = orgs.map((o) => ({
    id: o.id,
    type: 'orgNode',
    position: { x: 0, y: 0 },
    data: {
      name: o.name,
      code: o.code,
      type: o.type,
      hasChildren: true,  // will be updated after children check
      onExpand: expandedIds.has(o.id) ? undefined : () => onExpand(o.id),
    },
  }));

  const edges: Edge[] = orgs
    .filter((o) => o.parentId)
    .map((o) => ({
      id: `e-${o.parentId}-${o.id}`,
      source: o.parentId!,
      target: o.id,
      type: 'smoothstep',
    }));

  return applyDagreLayout(nodes, edges);
}

// ── Main component ────────────────────────────────────────────

function OrgChartInner({ companyId, accessToken }: OrgChartViewerProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loadedOrgs, setLoadedOrgs] = useState<OrgNode[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const { fitView } = useReactFlow();

  const headers = { Authorization: `Bearer ${accessToken}` };

  // Initial load: fetch flat list (2 levels)
  useEffect(() => {
    axios
      .get(`/api/organizations/${companyId}/flat`, { headers })
      .then((res) => {
        const orgs: OrgNode[] = res.data.data;
        // Only show first 2 levels initially
        const root = orgs.find((o) => !o.parentId || o.type === 'company');
        const level2Ids = new Set(
          orgs.filter((o) => o.parentId === root?.id).map((o) => o.id),
        );
        const visible = orgs.filter(
          (o) => !o.parentId || o.parentId === root?.id || level2Ids.has(o.parentId ?? ''),
        );
        setLoadedOrgs(visible);
      })
      .catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const handleExpand = useCallback(
    async (parentId: string) => {
      if (expandedIds.has(parentId)) return;
      try {
        const res = await axios.get(`/api/organizations/${parentId}/children`, { headers });
        const children: OrgNode[] = res.data.data;
        setLoadedOrgs((prev) => {
          const existingIds = new Set(prev.map((o) => o.id));
          return [...prev, ...children.filter((c) => !existingIds.has(c.id))];
        });
        setExpandedIds((prev) => new Set([...prev, parentId]));
      } catch (err) {
        console.error('Failed to load children:', err);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [expandedIds],
  );

  // Rebuild graph whenever loadedOrgs or expandedIds change
  useEffect(() => {
    if (!loadedOrgs.length) return;
    const { nodes: newNodes, edges: newEdges } = buildGraph(loadedOrgs, handleExpand, expandedIds);
    setNodes(newNodes);
    setEdges(newEdges);
    setTimeout(() => fitView({ padding: 0.2 }), 100);
  }, [loadedOrgs, expandedIds, handleExpand, setNodes, setEdges, fitView]);

  const onConnect = useCallback((c: Connection) => setEdges((e) => addEdge(c, e)), [setEdges]);

  // Export PNG
  const handleExportPng = useCallback(() => {
    const svgEl = document.querySelector('.react-flow__renderer svg') as SVGElement | null;
    if (!svgEl) return;
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const canvas = document.createElement('canvas');
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext('2d')!.drawImage(img, 0, 0);
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `org-chart-${companyId}.png`;
      a.click();
    };
    img.src = `data:image/svg+xml;base64,${btoa(svgData)}`;
  }, [companyId]);

  return (
    <div className="relative w-full h-full">
      <button
        onClick={handleExportPng}
        className="absolute top-3 right-3 z-10 text-sm bg-white border rounded-md px-3 py-1.5 shadow hover:bg-gray-50"
      >
        Xuất PNG
      </button>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-right"
      >
        <Controls />
        <MiniMap zoomable pannable />
        <Background gap={16} />
      </ReactFlow>
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
