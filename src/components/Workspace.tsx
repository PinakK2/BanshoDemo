import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background, BackgroundVariant, MarkerType, ReactFlow, ReactFlowProvider,
  useReactFlow, useViewport, type Edge, type Node, type NodeChange, type NodeChangeset,
} from '@xyflow/react';
import { store, uid, useStore } from '../store';
import type { Card, Group, LinkTone, Project } from '../types';
import { edgeTypes, nodeTypes } from './nodes';
import {
  BriefPanel, CardPanel, ComparePanel, FindPanel, HelpPanel, IdeaPanel, MaterialPanel,
  type Api, type PanelState,
} from './panels';
import { suggestLabels, toneOf } from '../engine/engine';
import type { ScriptedIdea } from '../data/samples';
import { toast } from './ui';
import { mark } from '../presenter';
import { liveOn, suggestLabelsLive, useAi } from '../engine/live';

type Mode = 'arrange' | 'pan' | 'connect';
type LinkPop =
  | { kind: 'new'; from: string; to: string; x: number; y: number }
  | { kind: 'edit'; id: string; x: number; y: number };

export function Workspace({ projectId, onHome }: { projectId: string; onHome: () => void }) {
  return (
    <ReactFlowProvider>
      <Inner projectId={projectId} onHome={onHome} />
    </ReactFlowProvider>
  );
}

function Inner({ projectId, onHome }: { projectId: string; onHome: () => void }) {
  const project = useStore((s) => s.projects[projectId]);
  const ai = useAi();
  const rf = useReactFlow();
  const [panel, setPanel] = useState<PanelState>(null);
  const [mode, setMode] = useState<Mode>('arrange');
  const [pickFrom, setPickFrom] = useState<string | null>(null);
  const [linkPop, setLinkPop] = useState<LinkPop | null>(null);
  const [freshEdges, setFreshEdges] = useState<Set<string>>(new Set());
  const [, force] = useState(0);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragMembers = useRef<{ group: string; ids: string[]; start: { x: number; y: number } } | null>(null);

  useEffect(() => { if (project?.sampleKey === 'convenience') mark('open'); }, [project?.sampleKey]);

  const update = useCallback((fn: (p: Project) => Project, history?: boolean) => {
    store.update(projectId, fn, { history });
    force((n) => n + 1);
  }, [projectId]);

  // Clear "fresh" (arrival animation) flags shortly after mount or after new items appear.
  const hasFresh = project?.cards.some((c) => c.fresh) || project?.ideas.some((i) => i.fresh);
  useEffect(() => {
    if (!hasFresh) return;
    const t = setTimeout(() => store.update(projectId, (p) => ({
      ...p, cards: p.cards.map((c) => (c.fresh ? { ...c, fresh: false } : c)), ideas: p.ideas.map((i) => (i.fresh ? { ...i, fresh: false } : i)),
    })), 2400);
    return () => clearTimeout(t);
  }, [hasFresh, projectId]);

  /* ---------------- focus / highlight ---------------- */
  const focusId = panel?.type === 'card' || panel?.type === 'idea' ? panel.id : null;
  const related = useMemo(() => {
    if (!focusId || !project) return null;
    const s = new Set([focusId]);
    project.links.forEach((l) => { if (l.from === focusId) s.add(l.to); if (l.to === focusId) s.add(l.from); });
    return s;
  }, [focusId, project]);

  /* ---------------- nodes ---------------- */
  const [nodes, setNodes] = useState<Node[]>([]);
  const renameGroup = useCallback((id: string, title: string) => {
    store.update(projectId, (p) => ({ ...p, groups: p.groups.map((g) => (g.id === id ? { ...g, title } : g)) }));
  }, [projectId]);

  useEffect(() => {
    if (!project) return;
    setNodes((prev) => {
      const old = new Map(prev.map((n) => [n.id, n]));
      const keep = (n: Node): Node => {
        const o = old.get(n.id);
        return o?.measured ? { ...n, measured: o.measured } : n;
      };
      const freshCards = project.cards.filter((c) => c.fresh);
      const groups: Node[] = project.groups.map((g) => keep({
        id: g.id, type: 'group', position: { x: g.x, y: g.y }, data: { group: g, onRename: (t: string) => renameGroup(g.id, t) },
        style: { width: g.w, height: g.h }, width: g.w, height: g.h, zIndex: -1, dragHandle: '.group-handle', selectable: true,
        selected: old.get(g.id)?.selected ?? false,
      }));
      const cards: Node[] = project.cards.map((c) => keep({
        id: c.id, type: 'card', position: { x: c.x, y: c.y },
        data: { card: c, pick: pickFrom === c.id, dim: !!related && !related.has(c.id), fresh: c.fresh, delay: c.fresh ? freshCards.indexOf(c) * 90 : 0 },
        selected: focusId === c.id,
      }));
      const ideas: Node[] = project.ideas.map((i) => keep({
        id: i.id, type: 'idea', position: { x: i.x, y: i.y },
        data: { idea: i, pick: pickFrom === i.id, dim: !!related && !related.has(i.id) }, selected: focusId === i.id,
      }));
      return [...groups, ...cards, ...ideas];
    });
  }, [project, pickFrom, related, focusId, renameGroup]);

  const onNodesChange = useCallback((set: NodeChangeset<Node>) => {
    setNodes((ns) => set.applyTo(ns));
    const changes: NodeChange[] = set.toArray();
    const moves = changes.filter((c): c is Extract<NodeChange, { type: 'position' }> => c.type === 'position' && !!c.position);
    const sizes = changes.filter((c): c is Extract<NodeChange, { type: 'dimensions' }> => c.type === 'dimensions' && !!c.resizing && !!c.dimensions);
    if (!moves.length && !sizes.length) return;
    store.update(projectId, (p) => {
      let { cards, ideas, groups } = p;
      for (const m of moves) {
        const pos = m.position!;
        if (cards.some((c) => c.id === m.id)) cards = cards.map((c) => (c.id === m.id ? { ...c, x: pos.x, y: pos.y } : c));
        else if (ideas.some((i) => i.id === m.id)) ideas = ideas.map((i) => (i.id === m.id ? { ...i, x: pos.x, y: pos.y } : i));
        else {
          const g = groups.find((x) => x.id === m.id);
          if (!g) continue;
          const dx = pos.x - g.x, dy = pos.y - g.y;
          groups = groups.map((x) => (x.id === m.id ? { ...x, x: pos.x, y: pos.y } : x));
          const dm = dragMembers.current;
          if (dm?.group === m.id && (dx || dy)) {
            const ids = new Set(dm.ids);
            cards = cards.map((c) => (ids.has(c.id) ? { ...c, x: c.x + dx, y: c.y + dy } : c));
            ideas = ideas.map((i) => (ids.has(i.id) ? { ...i, x: i.x + dx, y: i.y + dy } : i));
          }
        }
      }
      for (const s of sizes) groups = groups.map((g) => (g.id === s.id ? { ...g, w: s.dimensions!.width, h: s.dimensions!.height } : g));
      return { ...p, cards, ideas, groups };
    });
  }, [projectId]);

  const onNodeDragStart = useCallback((_: unknown, node: Node) => {
    store.checkpoint(projectId);
    force((n) => n + 1);
    if (node.type !== 'group') return;
    const p = store.get().projects[projectId];
    const g = p.groups.find((x) => x.id === node.id)!;
    const inside = (x: number, y: number) => x >= g.x && x <= g.x + g.w && y >= g.y && y <= g.y + g.h;
    const ids = [...p.cards.map((c) => ({ id: c.id, x: c.x + 125, y: c.y + 60 })), ...p.ideas.map((i) => ({ id: i.id, x: i.x + 135, y: i.y + 60 }))]
      .filter((o) => inside(o.x, o.y)).map((o) => o.id);
    dragMembers.current = { group: g.id, ids, start: { x: g.x, y: g.y } };
  }, [projectId]);

  /* ---------------- edges ---------------- */
  const openLinkEdit = useCallback((id: string, x: number, y: number) => setLinkPop({ kind: 'edit', id, x, y }), []);
  const edges: Edge[] = useMemo(() => (project?.links ?? []).map((l) => ({
    id: l.id, source: l.from, target: l.to, type: 'link',
    markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: l.tone === 'challenges' || l.tone === 'complicates' ? 'var(--clay)' : 'var(--edge)' },
    data: { label: l.label, tone: l.tone, fresh: freshEdges.has(l.id), dim: !!related && !(related.has(l.from) && related.has(l.to) && (l.from === focusId || l.to === focusId)), onLabel: openLinkEdit },
  })), [project?.links, freshEdges, related, focusId, openLinkEdit]);

  /* ---------------- actions ---------------- */
  const focus = useCallback((id: string) => {
    const n = rf.getNode(id);
    if (!n) return;
    const w = n.measured?.width ?? n.width ?? 250, h = n.measured?.height ?? n.height ?? 160;
    rf.setCenter(n.position.x + w / 2 + 160, n.position.y + h / 2, { zoom: Math.max(rf.getZoom(), 0.9), duration: 600 });
    if (n.type === 'card') setPanel({ type: 'card', id });
    else if (n.type === 'idea') setPanel({ type: 'idea', id });
  }, [rf]);

  const addNote = useCallback((at?: { x: number; y: number }) => {
    const p = store.get().projects[projectId];
    const rect = canvasRef.current?.getBoundingClientRect();
    const pos = at ?? rf.screenToFlowPosition({ x: (rect?.left ?? 0) + (rect?.width ?? 800) / 2 - 300, y: (rect?.top ?? 0) + (rect?.height ?? 600) / 2 });
    const id = uid('c');
    const card: Card = { id, code: `C${p.cardSeq + 1}`, kind: 'messy', title: '', body: '', x: pos.x - 125, y: pos.y - 60, fresh: true };
    update((pp) => ({ ...pp, cardSeq: pp.cardSeq + 1, cards: [...pp.cards, card] }), true);
    setPanel({ type: 'card', id });
  }, [projectId, rf, update]);

  const addGroup = useCallback(() => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const pos = rf.screenToFlowPosition({ x: (rect?.left ?? 0) + 80, y: (rect?.top ?? 0) + 60 });
    const g: Group = { id: uid('g'), title: 'A loose group', x: pos.x, y: pos.y, w: 560, h: 380 };
    update((p) => ({ ...p, groups: [...p.groups, g] }), true);
    toast('Group added. Drag its heading to move it; resize from the corners.');
  }, [rf, update]);

  const addIdea = useCallback((s: ScriptedIdea) => {
    const p = store.get().projects[projectId];
    if (p.ideas.some((i) => i.scriptKey === s.key)) return;
    const id = `i-${s.key}`;
    const byCode = new Map(p.cards.map((c) => [c.code, c.id]));
    const links = s.material.filter((m) => byCode.has(m.code)).map((m) => ({ id: uid('l'), from: byCode.get(m.code)!, to: id, label: m.label, tone: m.tone }));
    store.update(projectId, (pp) => ({
      ...pp, ideaSeq: pp.ideaSeq + 1,
      ideas: [...pp.ideas, { id, code: `I${pp.ideaSeq + 1}`, title: s.title, claim: s.claim, unsettled: s.unsettled, x: s.pos.x, y: s.pos.y, status: 'tentative', scriptKey: s.key, why: s.why, live: s.key.startsWith('live-'), fresh: true }],
      links: [...pp.links, ...links],
    }), { history: true });
    setFreshEdges((f) => new Set([...f, ...links.map((l) => l.id)]));
    // Bring the new idea into view, left of the open panel.
    const z = Math.min(rf.getZoom(), 0.7);
    setTimeout(() => rf.setCenter(s.pos.x + 135 + 220 / z, s.pos.y + 60, { zoom: z, duration: 700 }), 60);
    setTimeout(() => setFreshEdges((f) => { const n = new Set(f); links.forEach((l) => n.delete(l.id)); return n; }), 2500);
  }, [projectId, rf]);

  const addChallenge = useCallback((ideaId: string, ch: { title: string; body: string }) => {
    const p = store.get().projects[projectId];
    const idea = p.ideas.find((i) => i.id === ideaId)!;
    const count = p.links.filter((l) => l.to === ideaId && l.tone === 'challenges').length;
    const id = uid('c');
    const link = { id: uid('l'), from: id, to: ideaId, label: 'challenges', tone: 'challenges' as LinkTone };
    update((pp) => ({
      ...pp, cardSeq: pp.cardSeq + 1,
      cards: [...pp.cards, { id, code: `C${pp.cardSeq + 1}`, kind: 'counter', title: ch.title, body: ch.body, aside: 'Raised when challenging an idea.', x: idea.x + 330, y: idea.y + count * 230 - 40, fresh: true }],
      links: [...pp.links, link],
    }), true);
    setFreshEdges((f) => new Set([...f, link.id]));
    toast('Counterargument added to the canvas');
  }, [projectId, update]);

  /** Fit everything into the part of the canvas not covered by the side panel. */
  const fitAll = useCallback((panelOpen = true) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const b = rf.getNodesBounds(rf.getNodes());
    const availW = rect.width - (panelOpen ? 450 : 0) - 80, availH = rect.height - 80;
    const zoom = Math.min(availW / b.width, availH / b.height, 0.85);
    rf.setViewport({ x: 40 + (availW - b.width * zoom) / 2 - b.x * zoom, y: 40 + (availH - b.height * zoom) / 2 - b.y * zoom, zoom }, { duration: 900 });
  }, [rf]);

  const connectFrom = useCallback((id: string) => {
    setMode('connect'); setPickFrom(id); setPanel(null);
  }, []);

  const api: Api | null = project ? {
    project, update, open: setPanel, focus, connectFrom, editLink: openLinkEdit, addIdea, addChallenge, fitAll,
  } : null;

  /* ---------------- canvas events ---------------- */
  const onNodeClick = useCallback((e: React.MouseEvent, node: Node) => {
    if (node.type === 'group') return;
    if (mode === 'connect') {
      if (!pickFrom) { setPickFrom(node.id); return; }
      if (pickFrom === node.id) { setPickFrom(null); return; }
      setLinkPop({ kind: 'new', from: pickFrom, to: node.id, x: e.clientX, y: e.clientY });
      return;
    }
    setPanel({ type: node.type === 'idea' ? 'idea' : 'card', id: node.id });
  }, [mode, pickFrom]);

  const onDouble = (e: React.MouseEvent) => {
    if (!(e.target as HTMLElement).classList.contains('react-flow__pane')) return;
    addNote(rf.screenToFlowPosition({ x: e.clientX, y: e.clientY }));
  };

  useEffect(() => {
    const undo = () => { store.undo(projectId); force((n) => n + 1); };
    const on = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = !!t.closest('input, textarea, select');
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !typing) {
        e.preventDefault();
        if (e.shiftKey) store.redo(projectId); else store.undo(projectId);
        force((n) => n + 1);
      } else if (e.key === 'Escape') {
        if (linkPop) setLinkPop(null);
        else if (mode === 'connect') { setMode('arrange'); setPickFrom(null); }
        else setPanel(null);
      } else if (!typing && !e.metaKey && !e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'n') { e.preventDefault(); addNote(); }
    };
    window.addEventListener('keydown', on);
    document.addEventListener('baansho:undo', undo);
    return () => { window.removeEventListener('keydown', on); document.removeEventListener('baansho:undo', undo); };
  }, [projectId, linkPop, mode, addNote]);

  useEffect(() => {
    const t = setTimeout(() => rf.fitView({ padding: 0.08, duration: 0, maxZoom: 0.9 }), 50);
    return () => clearTimeout(t);
  }, [rf]);

  if (!project || !api) return null;
  const tentative = project.ideas.filter((i) => i.status !== 'rejected');

  return (
    <div className="ws">
      <header className="ws-head">
        <button className="brand" onClick={onHome} title="All projects">baansho <span className="star">✳</span></button>
        <span className="divider" />
        <div className="ws-title">
          <input className="ws-title-input" value={project.title} onChange={(e) => update((p) => ({ ...p, title: e.target.value }))} aria-label="Project title" />
          <div className="eyebrow" style={{ marginTop: 4 }}>{project.subtitle}</div>
        </div>
        <div className="right">
          <button className="iconbtn" onClick={() => setPanel({ type: 'help' })} aria-label="How Baansho works">?</button>
          {project.sampleKey === 'convenience' && (
            <button className="btn" onClick={() => { store.resetSample(); setPanel(null); setTimeout(() => rf.fitView({ padding: 0.08, duration: 500 }), 60); toast('Sample reset'); }}>↺ Reset sample</button>
          )}
          <button className="btn btn-primary" onClick={() => setPanel({ type: 'brief' })}>Articulation brief ↗</button>
        </div>
      </header>

      <div className="toolbar">
        <button className={`btn ${mode === 'arrange' ? 'on' : ''}`} onClick={() => { setMode('arrange'); setPickFrom(null); }}>↖ Arrange</button>
        <button className={`btn ${mode === 'pan' ? 'on' : ''}`} onClick={() => { setMode('pan'); setPickFrom(null); }}>✥ Pan</button>
        <button className={`btn ${mode === 'connect' ? 'on' : ''}`} onClick={() => { setMode(mode === 'connect' ? 'arrange' : 'connect'); setPickFrom(null); setPanel(null); }}>⤴ Connect</button>
        <span className="sep" />
        <button className="btn" onClick={() => addNote()}>+ Note</button>
        <button className="btn" onClick={addGroup}>▧ Group</button>
        <span className="sep" />
        <button className="btn" onClick={() => { store.undo(projectId); force((n) => n + 1); }} disabled={!store.canUndo(projectId)} aria-label="Undo">↶</button>
        <button className="btn" onClick={() => { store.redo(projectId); force((n) => n + 1); }} disabled={!store.canRedo(projectId)} aria-label="Redo">↷</button>
        <span className="grow" />
        {ai.mode === 'live' && <span className="live-pill" title="AI responses are generated live by Claude">● Live AI</span>}
        <button className="btn btn-spark" onClick={() => setPanel({ type: 'find' })}>✳ Find ideas</button>
        <button className="btn" onClick={() => setPanel({ type: 'compare' })}>Compare ideas{tentative.length ? ` · ${tentative.length}` : ''}</button>
        <button className="btn" onClick={() => setPanel({ type: 'material' })}>☷ All material</button>
      </div>

      <div className="canvas" ref={canvasRef} onDoubleClick={onDouble}>
        <ReactFlow
          nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
          onNodesChange={onNodesChange} onNodeDragStart={onNodeDragStart} onNodeDragStop={() => { dragMembers.current = null; }}
          onNodeClick={onNodeClick} onPaneClick={() => { setPickFrom(null); if (panel?.type === 'card' || panel?.type === 'idea') setPanel(null); }}
          nodesDraggable={mode !== 'pan'} nodesConnectable={false} elementsSelectable={mode !== 'pan'}
          panOnDrag={mode === 'pan' ? true : [1]} selectionOnDrag={false} panOnScroll zoomOnScroll={false} zoomOnPinch zoomOnDoubleClick={false}
          minZoom={0.2} maxZoom={1.6} proOptions={{ hideAttribution: true }} deleteKeyCode={null}
          className={mode === 'connect' ? 'connecting' : ''}
        >
          <Background variant={BackgroundVariant.Dots} gap={22} size={1.3} color="var(--dot)" />
        </ReactFlow>
        {mode === 'arrange' && <PanOnEmptyDrag />}
        {mode === 'connect' && (
          <div className="connect-banner">
            {pickFrom ? 'Now choose the second card or idea' : 'Choose the first card or idea to connect'}
            <button onClick={() => { setMode('arrange'); setPickFrom(null); }}>Done</button>
          </div>
        )}
        <span className="canvas-hint">Drag to arrange · double-click to add a note · ⌘ / Ctrl + scroll to zoom</span>
        <Zoom />

        {panel?.type === 'card' && <CardPanel key={panel.id} api={api} id={panel.id} onClose={() => setPanel(null)} />}
        {panel?.type === 'idea' && <IdeaPanel key={panel.id} api={api} id={panel.id} onClose={() => setPanel(null)} />}
        {panel?.type === 'find' && <FindPanel api={api} onClose={() => setPanel(null)} />}
        {panel?.type === 'compare' && <ComparePanel api={api} onClose={() => setPanel(null)} />}
        {panel?.type === 'material' && <MaterialPanel api={api} onClose={() => setPanel(null)} />}
        {panel?.type === 'brief' && <BriefPanel key={(panel.ideaId ?? '') + String(panel.autoDraft)} api={api} ideaId={panel.ideaId} autoDraft={panel.autoDraft} onClose={() => setPanel(null)} />}
        {panel?.type === 'help' && <HelpPanel onClose={() => setPanel(null)} />}

        {linkPop && <LinkPopover pop={linkPop} project={project} canvas={canvasRef.current} onClose={() => setLinkPop(null)}
          onCreate={(label) => {
            if (linkPop.kind !== 'new') return;
            const l = { id: uid('l'), from: linkPop.from, to: linkPop.to, label, tone: toneOf(label) };
            update((p) => ({ ...p, links: [...p.links, l] }), true);
            setFreshEdges((f) => new Set([...f, l.id]));
            setLinkPop(null); setPickFrom(null);
            mark('connect');
          }}
          onEdit={(id, label, tone) => update((p) => ({ ...p, links: p.links.map((l) => (l.id === id ? { ...l, label, tone } : l)) }), true)}
          onDelete={(id) => { update((p) => ({ ...p, links: p.links.filter((l) => l.id !== id) }), true); setLinkPop(null); }}
        />}
      </div>

      <footer className="statusbar">
        <span><span className="dot" />Saved on this browser</span>
        <span className="grow" />
        <span>{project.cards.length} cards · {tentative.length} ideas · {project.links.length} connections</span>
      </footer>
    </div>
  );
}

/** In Arrange mode, dragging empty canvas pans (cards still drag). */
function PanOnEmptyDrag() {
  const rf = useReactFlow();
  useEffect(() => {
    const pane = document.querySelector('.canvas .react-flow__pane') as HTMLElement | null;
    if (!pane) return;
    let start: { x: number; y: number; vx: number; vy: number } | null = null;
    const down = (e: PointerEvent) => {
      if (e.button !== 0 || e.target !== pane) return;
      const v = rf.getViewport();
      start = { x: e.clientX, y: e.clientY, vx: v.x, vy: v.y };
      pane.style.cursor = 'grabbing';
    };
    const move = (e: PointerEvent) => {
      if (!start) return;
      rf.setViewport({ x: start.vx + e.clientX - start.x, y: start.vy + e.clientY - start.y, zoom: rf.getZoom() });
    };
    const up = () => { start = null; pane.style.cursor = ''; };
    pane.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => { pane.removeEventListener('pointerdown', down); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  }, [rf]);
  return null;
}

function Zoom() {
  const rf = useReactFlow();
  const { zoom } = useViewport();
  return (
    <div className="zoom">
      <button onClick={() => rf.zoomOut({ duration: 200 })} aria-label="Zoom out">−</button>
      <span className="pct">{Math.round(zoom * 100)}%</span>
      <button onClick={() => rf.zoomIn({ duration: 200 })} aria-label="Zoom in">+</button>
      <button className="fit" onClick={() => rf.fitView({ padding: 0.08, duration: 500, maxZoom: 0.9 })}>Fit canvas</button>
    </div>
  );
}

function LinkPopover({ pop, project, canvas, onClose, onCreate, onEdit, onDelete }: {
  pop: LinkPop; project: Project; canvas: HTMLDivElement | null; onClose: () => void;
  onCreate: (label: string) => void; onEdit: (id: string, label: string, tone: LinkTone) => void; onDelete: (id: string) => void;
}) {
  const find = (id: string) => project.cards.find((c) => c.id === id) ?? project.ideas.find((i) => i.id === id);
  const existing = pop.kind === 'edit' ? project.links.find((l) => l.id === pop.id) : undefined;
  const fromId = pop.kind === 'new' ? pop.from : existing?.from ?? '';
  const toId = pop.kind === 'new' ? pop.to : existing?.to ?? '';
  const a = find(fromId), b = find(toId);
  const [label, setLabel] = useState(existing?.label ?? '');
  const [thinking, setThinking] = useState(pop.kind === 'new');
  const kindOf = (x?: object) => (x && 'kind' in x ? { kind: (x as Card).kind } : { kind: 'idea' });
  const [suggestions, setSuggestions] = useState(() => suggestLabels(kindOf(a), kindOf(b)));
  useEffect(() => {
    if (!thinking) return;
    if (liveOn() && a && b) {
      const ctl = new AbortController();
      suggestLabelsLive(a, b, ctl.signal).then(setSuggestions).catch(() => undefined).finally(() => { if (!ctl.signal.aborted) setThinking(false); });
      return () => ctl.abort();
    }
    const t = setTimeout(() => setThinking(false), 650);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const r = canvas?.getBoundingClientRect();
  const left = Math.min(Math.max(12, pop.x - (r?.left ?? 0) - 170), (r?.width ?? 1200) - 352);
  const top = Math.min(Math.max(12, pop.y - (r?.top ?? 0) + 14), (r?.height ?? 800) - 300);

  return (
    <div className="popover" style={{ left, top }} role="dialog" aria-label="Name this connection">
      <h4>{pop.kind === 'new' ? 'Name what connects them' : 'Edit connection'}</h4>
      <p className="between">“{a?.title}” → “{b?.title}”</p>
      <input className="input" autoFocus value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. complicates, an example of…"
        onKeyDown={(e) => { if (e.key === 'Enter' && label.trim()) { if (pop.kind === 'new') onCreate(label.trim()); else { onEdit(pop.id, label.trim(), toneOf(label)); onClose(); } } }} aria-label="Connection name" />
      <div className="eyebrow" style={{ marginTop: 12 }}>{thinking ? (liveOn() ? '✳ Claude is thinking…' : '✳ Thinking…') : '✳ Suggested'}</div>
      <div className="chips">
        {!thinking && suggestions.map((s) => <button key={s} className={`chip ${label === s ? 'on' : ''}`} onClick={() => setLabel(s)}>{s}</button>)}
      </div>
      <div className="row">
        {pop.kind === 'edit' && <button className="btn btn-sm btn-danger" onClick={() => onDelete(pop.id)}>Remove</button>}
        <span style={{ flex: 1 }} />
        <button className="btn btn-sm" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary btn-sm" disabled={!label.trim()} onClick={() => {
          if (pop.kind === 'new') onCreate(label.trim()); else { onEdit(pop.id, label.trim(), toneOf(label)); onClose(); }
        }}>{pop.kind === 'new' ? 'Connect' : 'Save'}</button>
      </div>
    </div>
  );
}
