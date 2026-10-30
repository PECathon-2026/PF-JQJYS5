'use client';
import { Background, Controls, MiniMap, ReactFlow, type Edge, type Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

const nodeStyle = { width: 186, padding: 14, borderRadius: 14, background: 'rgba(18,18,22,.96)', color: '#f8fafc', border: '1px solid rgba(225,29,72,.36)', boxShadow: '0 0 28px rgba(225,29,72,.08)', fontSize: 12, fontWeight: 600 } as const;
const nodes: Node[] = [
  { id: 'user', position: { x: 30, y: 210 }, data: { label: '⌘  User / Software Request' }, style: { ...nodeStyle, border: '1px solid rgba(245,158,11,.45)' } },
  { id: 'planner', position: { x: 285, y: 210 }, data: { label: 'Ⅰ  Shogun Planner' }, style: nodeStyle },
  { id: 'developer', position: { x: 540, y: 210 }, data: { label: 'Ⅱ  Samurai Developer' }, style: { ...nodeStyle, border: '1px solid rgba(225,29,72,.65)' } },
  { id: 'tester', position: { x: 795, y: 210 }, data: { label: 'Ⅲ  Sentinel Tester' }, style: { ...nodeStyle, border: '1px solid rgba(56,189,248,.38)' } },
  { id: 'reviewer', position: { x: 1050, y: 105 }, data: { label: 'Ⅳ  Shadow Reviewer' }, style: { ...nodeStyle, border: '1px solid rgba(139,92,246,.5)' } },
  { id: 'security', position: { x: 1050, y: 315 }, data: { label: 'Ⅴ  Security Guardian' }, style: { ...nodeStyle, border: '1px solid rgba(52,211,153,.42)' } },
  { id: 'verifier', position: { x: 1305, y: 210 }, data: { label: 'Ⅵ  Imperial Verifier' }, style: { ...nodeStyle, border: '1px solid rgba(245,158,11,.5)' } },
  { id: 'human', position: { x: 1560, y: 210 }, data: { label: '◉  Human Approval Gate' }, style: { ...nodeStyle, border: '1px solid rgba(245,158,11,.75)', background: 'rgba(55,35,8,.75)' } },
  { id: 'memory', position: { x: 540, y: 430 }, data: { label: '◇  Shared MissionMemory' }, style: { ...nodeStyle, width: 240, border: '1px solid rgba(139,92,246,.45)', background: 'rgba(28,19,47,.92)' } }
];
const edgeBase: Partial<Edge> = { animated: true, style: { stroke: '#6b7280', strokeWidth: 1.6 }, type: 'smoothstep' };
const edges: Edge[] = [
  { id: 'e1', source: 'user', target: 'planner', ...edgeBase },
  { id: 'e2', source: 'planner', target: 'developer', ...edgeBase, label: 'mission plan', labelStyle: { fill: '#a1a1aa', fontSize: 10 } },
  { id: 'e3', source: 'developer', target: 'tester', ...edgeBase, label: 'candidate patch', labelStyle: { fill: '#a1a1aa', fontSize: 10 } },
  { id: 'e4', source: 'tester', target: 'developer', ...edgeBase, label: 'fail → fix', style: { stroke: '#e11d48', strokeWidth: 1.7 }, pathOptions: { borderRadius: 18 } },
  { id: 'e5', source: 'tester', target: 'reviewer', ...edgeBase },
  { id: 'e6', source: 'tester', target: 'security', ...edgeBase },
  { id: 'e7', source: 'reviewer', target: 'verifier', ...edgeBase },
  { id: 'e8', source: 'security', target: 'verifier', ...edgeBase },
  { id: 'e9', source: 'verifier', target: 'human', ...edgeBase, label: 'evidence + report', labelStyle: { fill: '#fbbf24', fontSize: 10 } },
  { id: 'e10', source: 'memory', target: 'developer', ...edgeBase, style: { stroke: '#8b5cf6', strokeDasharray: '5 5' } },
  { id: 'e11', source: 'planner', target: 'memory', ...edgeBase, style: { stroke: '#8b5cf6', strokeDasharray: '5 5' } },
  { id: 'e12', source: 'tester', target: 'memory', ...edgeBase, style: { stroke: '#8b5cf6', strokeDasharray: '5 5' } },
  { id: 'e13', source: 'verifier', target: 'memory', ...edgeBase, style: { stroke: '#8b5cf6', strokeDasharray: '5 5' } }
];

export function ArchitectureFlow() {
  return <div className="h-[570px] w-full overflow-hidden rounded-2xl border border-white/[.07] bg-[#0b0b0e]">
    <ReactFlow nodes={nodes} edges={edges} fitView fitViewOptions={{ padding: 0.15 }} minZoom={0.25} maxZoom={1.8} proOptions={{ hideAttribution: true }} nodesDraggable nodesConnectable={false} elementsSelectable>
      <Background color="#34343d" gap={24} size={1} />
      <Controls position="bottom-left" />
      <MiniMap position="bottom-right" nodeColor={(node) => node.id === 'human' ? '#f59e0b' : node.id === 'memory' ? '#8b5cf6' : '#e11d48'} maskColor="rgba(0,0,0,.65)" />
    </ReactFlow>
  </div>;
}
