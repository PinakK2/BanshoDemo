import { memo } from 'react';
import {
  BaseEdge, EdgeLabelRenderer, Handle, NodeResizer, Position, useInternalNode,
  type EdgeProps, type InternalNode, type Node, type NodeProps,
} from '@xyflow/react';
import { KIND_LABEL, type Card, type Group, type Idea, type LinkTone } from '../types';

export type CardData = { card: Card; pick?: boolean; dim?: boolean; fresh?: boolean; delay?: number };
export type IdeaData = { idea: Idea; pick?: boolean; dim?: boolean };
export type GroupData = { group: Group; onRename: (t: string) => void };

const Handles = () => (
  <>
    <Handle type="target" position={Position.Top} className="handle" isConnectable={false} />
    <Handle type="source" position={Position.Top} className="handle" isConnectable={false} />
  </>
);

export const CardNode = memo(({ data, selected }: NodeProps<Node<CardData>>) => {
  const c = data.card;
  return (
    <div className={`node-card ${c.kind} ${selected ? 'selected' : ''} ${data.pick ? 'pick' : ''} ${data.dim ? 'dim' : ''} ${data.fresh ? 'fresh' : ''}`}
      style={data.delay ? { animationDelay: `${data.delay}ms` } : undefined}>
      <Handles />
      <div className="top"><span className="eyebrow">{KIND_LABEL[c.kind]}</span><span className="code">{c.code}</span></div>
      <h3>{c.title || <span className="muted">Untitled</span>}</h3>
      {c.body && <p className="body">{c.body}</p>}
      <div className="foot"><span>Open to explore</span><span>↗</span></div>
    </div>
  );
});

export const IdeaNode = memo(({ data, selected }: NodeProps<Node<IdeaData>>) => {
  const i = data.idea;
  return (
    <div className={`node-card idea ${i.mine ? 'mine' : ''} ${i.status === 'rejected' ? 'rejected' : ''} ${selected ? 'selected' : ''} ${data.pick ? 'pick' : ''} ${data.dim ? 'dim' : ''} ${i.fresh ? 'fresh' : ''}`}>
      <Handles />
      <div className="top">
        <span className="eyebrow">{i.status === 'rejected' ? 'Set aside' : i.mine ? '✳ My idea' : '✳ Tentative idea'}</span>
        <span className="code">{i.code}</span>
      </div>
      <h3>{i.title || <span className="muted">Untitled idea</span>}</h3>
      <p className="body">{i.claim}</p>
      <div className="foot"><span>A possibility, not a conclusion</span><span>↗</span></div>
    </div>
  );
});

export const GroupNode = memo(({ data, selected }: NodeProps<Node<GroupData>>) => (
  <div className={`node-group ${selected ? 'selected' : ''}`}>
    <NodeResizer isVisible={!!selected} minWidth={260} minHeight={160} />
    <div className="ghead group-handle">
      <span className="grip">⠿⠿</span>
      <input className="nodrag" value={data.group.title} onChange={(e) => data.onRename(e.target.value)} aria-label="Group name" />
      <span className="eyebrow" style={{ fontSize: 9.5 }}>Loose group</span>
    </div>
  </div>
));

/* ---------- Floating edge: attaches to the nearest side of each node ---------- */

function center(n: InternalNode) {
  const w = n.measured.width ?? 250, h = n.measured.height ?? 160;
  const p = n.internals.positionAbsolute;
  return { x: p.x + w / 2, y: p.y + h / 2, w, h };
}
function borderPoint(from: ReturnType<typeof center>, to: { x: number; y: number }) {
  const dx = to.x - from.x, dy = to.y - from.y;
  if (!dx && !dy) return { x: from.x, y: from.y };
  const sx = (from.w / 2 + 6) / Math.abs(dx || 1e-6);
  const sy = (from.h / 2 + 6) / Math.abs(dy || 1e-6);
  const s = Math.min(sx, sy);
  return { x: from.x + dx * s, y: from.y + dy * s };
}

export type LinkEdgeData = { label: string; tone: LinkTone; fresh?: boolean; dim?: boolean; onLabel: (id: string, x: number, y: number) => void };

export function LinkEdge({ id, source, target, data, markerEnd }: EdgeProps & { data?: LinkEdgeData }) {
  const s = useInternalNode(source);
  const t = useInternalNode(target);
  if (!s || !t || !data) return null;
  const a = center(s), b = center(t);
  const p1 = borderPoint(a, b), p2 = borderPoint(b, a);
  // Gentle curve: offset the control point perpendicular to the line.
  const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
  const dx = p2.x - p1.x, dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy) || 1;
  const bend = Math.min(40, len * 0.12);
  const cx = mx - (dy / len) * bend, cy = my + (dx / len) * bend;
  const path = `M ${p1.x},${p1.y} Q ${cx},${cy} ${p2.x},${p2.y}`;
  const lx = (p1.x + 2 * cx + p2.x) / 4, ly = (p1.y + 2 * cy + p2.y) / 4;
  const cls = `${data.tone} ${data.fresh ? 'fresh' : ''} ${data.dim ? 'dim' : ''}`;
  return (
    <>
      <BaseEdge id={id} path={path} className={`edge-path ${cls}`} markerEnd={markerEnd} />
      <EdgeLabelRenderer>
        <button className={`edge-label nodrag nopan ${cls}`}
          style={{ transform: `translate(-50%, -50%) translate(${lx}px, ${ly}px)` }}
          onClick={(e) => { e.stopPropagation(); data.onLabel(id, e.clientX, e.clientY); }}>
          {data.label}
        </button>
      </EdgeLabelRenderer>
    </>
  );
}

export const nodeTypes = { card: CardNode, idea: IdeaNode, group: GroupNode };
export const edgeTypes = { link: LinkEdge };
