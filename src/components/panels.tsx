import { useEffect, useMemo, useRef, useState } from 'react';
import { KIND_LABEL, type Brief, type Card, type CardKind, type Idea, type Link, type Project } from '../types';
import { ideasFor, readingSteps, scriptFor, wait } from '../engine/engine';
import type { ScriptedIdea } from '../data/samples';
import { AutoText, Panel, Stream, toast } from './ui';
import { mark } from '../presenter';
import { challengeLive, draftBriefLive, findIdeasLive, liveOn } from '../engine/live';

export type PanelState =
  | { type: 'card'; id: string }
  | { type: 'idea'; id: string }
  | { type: 'find' }
  | { type: 'compare' }
  | { type: 'material' }
  | { type: 'brief'; ideaId?: string; autoDraft?: boolean }
  | { type: 'help' }
  | null;

export interface Api {
  project: Project;
  update: (fn: (p: Project) => Project, history?: boolean) => void;
  open: (p: PanelState) => void;
  focus: (id: string) => void;
  connectFrom: (id: string) => void;
  editLink: (id: string, x: number, y: number) => void;
  addIdea: (s: ScriptedIdea) => void;
  addChallenge: (ideaId: string, ch: { title: string; body: string }) => void;
  fitAll: (panelOpen?: boolean) => void;
}

const byId = (p: Project) => {
  const m = new Map<string, Card | Idea>();
  p.cards.forEach((c) => m.set(c.id, c));
  p.ideas.forEach((i) => m.set(i.id, i));
  return m;
};

function Connections({ api, id }: { api: Api; id: string }) {
  const map = byId(api.project);
  const links = api.project.links.filter((l) => l.from === id || l.to === id);
  if (!links.length) return <p className="note">No connections yet. Nearby cards aren’t automatically related.</p>;
  return (
    <div className="conn-list">
      {links.map((l) => {
        const other = map.get(l.from === id ? l.to : l.from);
        const out = l.from === id;
        return (
          <div key={l.id} className="conn">
            <span className={`lbl ${l.tone}`}>{l.label} {out ? '→' : '←'}</span>
            <button className="btn btn-quiet" onClick={(e) => api.editLink(l.id, e.clientX - 360, e.clientY)}>Edit</button>
            <button className="to" onClick={() => other && api.focus(other.id)}>{other?.title ?? 'Missing card'} ↗</button>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------ Card ------------------------------ */

export function CardPanel({ api, id, onClose }: { api: Api; id: string; onClose: () => void }) {
  const card = api.project.cards.find((c) => c.id === id);
  const first = useRef(true);
  useEffect(() => { mark('card'); }, []);
  if (!card) return null;
  const set = (patch: Partial<Card>) => {
    api.update((p) => ({ ...p, cards: p.cards.map((c) => (c.id === id ? { ...c, ...patch } : c)) }), first.current);
    first.current = false;
  };
  return (
    <Panel eyebrow="A closer look" onClose={onClose} foot={<>
      <button className="btn btn-outline btn-sm" onClick={() => api.connectFrom(id)}>⤴ Connect this card</button>
      <button className="btn btn-sm" onClick={() => api.focus(id)}>Find on canvas</button>
      <span className="grow" />
      <button className="btn btn-sm btn-danger" onClick={() => {
        api.update((p) => ({ ...p, cards: p.cards.filter((c) => c.id !== id), links: p.links.filter((l) => l.from !== id && l.to !== id) }), true);
        onClose();
        toast('Card removed', { label: 'Undo', run: () => document.dispatchEvent(new CustomEvent('baansho:undo')) });
      }}>Remove</button>
    </>}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <select className="kind-select" value={card.kind} onChange={(e) => set({ kind: e.target.value as CardKind })} aria-label="Card type">
          {Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <span className="muted" style={{ fontSize: 11 }}>{card.code}</span>
      </div>
      <AutoText className="title-edit" value={card.title} onChange={(e) => set({ title: e.target.value })} aria-label="Card title" autoFocus={!card.title} placeholder="Name this thought" />
      <div className="section-label">Your note</div>
      <AutoText className="textarea" value={card.body} onChange={(e) => set({ body: e.target.value })} aria-label="Note" placeholder="Write it as messy as it is." />
      <div className="section-label">In the margin</div>
      <div className="margin-note">
        <AutoText className="textarea" style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 15 }} value={card.aside ?? ''} onChange={(e) => set({ aside: e.target.value })} aria-label="Margin note" placeholder="Doubts, caveats, what you’re not sure about…" />
      </div>
      <div className="section-label">In conversation with</div>
      <Connections api={api} id={id} />
      <p className="note" style={{ marginTop: 14 }}>Connections are your interpretation. Proximity alone doesn’t create one.</p>
    </Panel>
  );
}

/* ------------------------------ Idea ------------------------------ */

export function IdeaPanel({ api, id, onClose }: { api: Api; id: string; onClose: () => void }) {
  const idea = api.project.ideas.find((i) => i.id === id);
  const script = useMemo(() => ideasFor(api.project).find((s) => s.key === idea?.scriptKey), [api.project, idea?.scriptKey]);
  const [phase, setPhase] = useState<'idle' | 'thinking' | 'shown'>('idle');
  const [shown, setShown] = useState(0);
  const [added, setAdded] = useState<Set<number>>(new Set());
  const [liveList, setLiveList] = useState<{ title: string; body: string }[] | null>(null);
  const first = useRef(true);
  useEffect(() => { setPhase('idle'); setShown(0); setAdded(new Set()); setLiveList(null); }, [id]);
  if (!idea) return null;
  const set = (patch: Partial<Idea>) => {
    api.update((p) => ({ ...p, ideas: p.ideas.map((i) => (i.id === id ? { ...i, ...patch } : i)) }), first.current);
    first.current = false;
  };
  const scripted = (script?.challenges?.length ? script.challenges : null) ?? [
    { title: 'What would change your mind?', body: 'Name one observation that, if true, would make this idea wrong.' },
    { title: 'Who does this leave out?', body: 'Think of a reader for whom this claim doesn’t hold. Is there a card for them?' },
  ];
  const challenges = liveList ?? scripted;
  const challenge = async () => {
    setPhase('thinking');
    mark('challenge');
    let list = scripted;
    if (liveOn()) {
      try { list = await challengeLive(api.project, idea); setLiveList(list); }
      catch (e) { toast(`${(e as Error).message}. Showing scripted objections.`); }
    } else await wait(1400);
    setPhase('shown');
    for (let k = 1; k <= list.length; k++) { setShown(k); await wait(900); }
  };
  const rejected = idea.status === 'rejected';

  return (
    <Panel eyebrow={idea.mine ? '✳ My idea' : '✳ Tentative idea'} onClose={onClose} foot={<>
      <button className="btn btn-primary btn-sm" onClick={() => api.open({ type: 'brief', ideaId: id, autoDraft: true })} disabled={rejected}>Build a brief from this →</button>
      <button className="btn btn-sm" onClick={() => api.connectFrom(id)}>⤴ Connect material</button>
      <span className="grow" />
      <button className="btn btn-sm btn-danger" onClick={() => set({ status: rejected ? 'tentative' : 'rejected' })}>{rejected ? 'Restore idea' : 'Set aside'}</button>
    </>}>
      {!idea.mine && <div className="disclaimer" style={{ marginBottom: 12 }}><span className="spark">✳</span>{idea.live ? 'Written live by Claude from your material.' : 'Suggested by Baansho from your material.'} Edit it freely; it stays yours.</div>}
      <AutoText className="title-edit" value={idea.title} onChange={(e) => set({ title: e.target.value })} aria-label="Idea title" placeholder="Name the idea" autoFocus={!idea.title} />
      <div className="section-label">What I might be saying</div>
      <AutoText className="textarea" value={idea.claim} onChange={(e) => set({ claim: e.target.value })} aria-label="Claim" placeholder="Say it in one sentence." />
      <div className="section-label">What this doesn’t settle</div>
      <AutoText className="textarea" style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 15 }} value={idea.unsettled} onChange={(e) => set({ unsettled: e.target.value })} aria-label="What this doesn't settle" placeholder="The honest limits of this idea." />
      {(idea.why || script?.why) && <>
        <div className="section-label">Why this surfaced</div>
        <p style={{ fontSize: 13, color: 'var(--ink-2)' }}>{idea.why || script?.why}</p>
      </>}
      <div className="section-label">Material behind the idea</div>
      <Connections api={api} id={id} />

      <div className="section-label">
        <span>Argue with it</span>
        {phase === 'idle' && <button className="btn btn-outline btn-sm" onClick={challenge} disabled={rejected}>✳ Challenge this idea</button>}
      </div>
      {phase === 'idle' && <p className="note">Baansho looks for the strongest objections in and beyond your material.</p>}
      {phase === 'thinking' && <div className="thinking"><div className="step active"><span className="mark" />{liveOn() ? 'Claude is looking for the strongest objections…' : 'Looking for the strongest objections…'}</div></div>}
      {phase === 'shown' && challenges.slice(0, shown).map((c, k) => (
        <div key={k} className={`challenge ${added.has(k) ? 'added' : ''}`}>
          <h4><Stream text={c.title} run speed={30} /></h4>
          <Stream as="p" text={c.body} run speed={22} />
          <div className="row">
            {added.has(k)
              ? <span className="muted" style={{ fontSize: 12 }}>Added to canvas as a counterargument</span>
              : <button className="btn btn-outline btn-sm" onClick={() => { api.addChallenge(id, c); setAdded(new Set(added).add(k)); }}>+ Add as counterargument card</button>}
          </div>
        </div>
      ))}
    </Panel>
  );
}

/* ---------------------------- Find ideas ---------------------------- */

export function FindPanel({ api, onClose }: { api: Api; onClose: () => void }) {
  const { project } = api;
  const live = useMemo(() => liveOn(), []);
  const steps = useMemo(() => {
    const base = readingSteps(project);
    return live ? [...base.slice(0, -1), 'Claude is drafting tentative directions, each tied to its material'] : base;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const scriptedTodo = useMemo(() => {
    const existing = new Set(project.ideas.map((i) => i.scriptKey));
    return ideasFor(project).filter((c) => !existing.has(c.key));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const tooFew = project.cards.length < 2;
  const [todo, setTodo] = useState<ScriptedIdea[]>(live ? [] : scriptedTodo);
  const willRun = !tooFew && (live || scriptedTodo.length > 0);
  const [step, setStep] = useState(0);
  const [revealed, setRevealed] = useState(0);
  const [phase, setPhase] = useState<'reading' | 'ideas' | 'done'>(willRun ? 'reading' : 'done');
  const resolver = useRef<() => void>(undefined);
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    if (!willRun) return;
    const ctl = new AbortController();
    const request = live ? findIdeasLive(project, ctl.signal) : null;
    request?.catch(() => undefined); // handled below
    (async () => {
      for (let s = 0; s < steps.length; s++) {
        setStep(s);
        if (s === steps.length - 1 && request) break; // last step waits on Claude
        await wait(s === 0 ? 900 : 700 + (s % 2) * 300);
        if (cancelled.current) return;
      }
      let list = scriptedTodo;
      if (request) {
        try { list = await request; }
        catch (e) {
          if (cancelled.current) return;
          toast(`${(e as Error).message}. Showing scripted ideas instead.`);
        }
        if (cancelled.current) return;
        setTodo(list);
      }
      setStep(steps.length);
      if (!list.length) { setPhase('done'); return; }
      setPhase('ideas');
      mark('ideas');
      for (let k = 0; k < list.length; k++) {
        setRevealed(k + 1);
        await new Promise<void>((r) => { resolver.current = r; });
        if (cancelled.current) return;
        api.addIdea(list[k]);
        await wait(600);
      }
      setPhase('done');
      await wait(500);
      if (!cancelled.current) api.fitAll(true);
    })();
    return () => { cancelled.current = true; ctl.abort(); resolver.current?.(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const nothingNew = !willRun && !tooFew;
  return (
    <Panel eyebrow={live ? '✳ Find ideas · live' : '✳ Find ideas'} onClose={onClose} foot={phase === 'done' ? <>
      <button className="btn btn-primary btn-sm" onClick={() => api.open({ type: 'compare' })} disabled={project.ideas.filter(i => i.status !== 'rejected').length < 2}>Compare ideas →</button>
      <button className="btn btn-sm" onClick={onClose}>Back to the canvas</button>
    </> : undefined}>
      <h2>{nothingNew ? 'You’ve seen what’s here.' : 'Reading your desk.'}</h2>
      {tooFew ? <p className="lede">Add at least two cards first. Ideas come from your material, not from nowhere.</p>
        : nothingNew ? <p className="lede">Every direction Baansho found is already on your canvas. Add or connect more material and look again.</p>
          : <p className="lede">Baansho suggests directions your material could support. Each one shows its evidence, and none of them is a conclusion.</p>}
      {willRun && (
        <div className="thinking">
          {steps.map((s, k) => (
            <div key={k} className={`step ${k < step ? 'done' : k === step ? 'active' : ''}`}>
              <span className="mark">{k < step ? '✓' : ''}</span>{s}
            </div>
          ))}
        </div>
      )}
      {todo.slice(0, revealed).map((s, k) => (
        <IdeaResult key={s.key} s={s} project={project} onDone={() => k === revealed - 1 && resolver.current?.()} />
      ))}
      {phase === 'done' && todo.length > 0 && (
        <div className="disclaimer"><span className="spark">✳</span>{todo.length} tentative direction{todo.length > 1 ? 's' : ''} placed on your canvas, each linked to its material. Open one to edit, challenge or set it aside.</div>
      )}
    </Panel>
  );
}

function IdeaResult({ s, project, onDone }: { s: ScriptedIdea; project: Project; onDone: () => void }) {
  const [part, setPart] = useState(0);
  const codes = new Map(project.cards.map((c) => [c.code, c]));
  return (
    <div className="idea-result">
      <span className="eyebrow spark">✳ Tentative idea</span>
      <Stream as="h3" text={s.title} run onDone={() => setPart(1)} speed={45} />
      {part >= 1 && <Stream as="p" className="claim" text={s.claim} run onDone={() => setPart(2)} speed={26} />}
      {part >= 2 && <Stream as="p" className="why" text={'Why: ' + s.why} run onDone={() => { setPart(3); onDone(); }} speed={16} />}
      {part >= 3 && (
        <div className="chips">
          {s.material.map((m) => (
            <span key={m.code} className={`chip ${m.tone}`}><b>{m.code}</b>{codes.get(m.code)?.title.slice(0, 32) ?? ''} · {m.label}</span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ----------------------------- Compare ----------------------------- */

export function ComparePanel({ api, onClose }: { api: Api; onClose: () => void }) {
  const { project } = api;
  useEffect(() => { mark('compare'); }, []);
  const ideas = project.ideas.filter((i) => i.status !== 'rejected');
  const map = byId(project);
  const material = (id: string) => project.links.filter((l) => l.to === id || l.from === id).map((l) => ({ l, other: map.get(l.from === id ? l.to : l.from) }));
  const addMine = () => {
    const id = `i-mine-${Date.now().toString(36)}`;
    const ys = project.cards.map((c) => c.y).concat(project.ideas.map((i) => i.y));
    api.update((p) => ({
      ...p, ideaSeq: p.ideaSeq + 1,
      ideas: [...p.ideas, { id, code: `I${p.ideaSeq + 1}`, title: '', claim: '', unsettled: '', x: 200, y: Math.max(0, ...ys) + 340, status: 'tentative', mine: true, fresh: true }],
    }), true);
    api.open({ type: 'idea', id });
  };
  return (
    <Panel eyebrow="Possible directions" size="xwide" onClose={onClose} foot={<>
      <button className="btn btn-outline btn-sm" onClick={addMine}>✳ Try my own idea</button>
      {!ideas.length && <button className="btn btn-primary btn-sm" onClick={() => api.open({ type: 'find' })}>✳ Find ideas</button>}
      <span className="grow" />
      <span className="muted" style={{ fontSize: 12 }}>Balance shows how much of the linked material supports vs. pushes back</span>
    </>}>
      <h2>More than one way to see it.</h2>
      <p className="lede">Compare each direction against its material. Keep what holds up, set aside what doesn’t, or write your own.</p>
      {!ideas.length && <p className="note">No ideas on the canvas yet.</p>}
      <div className="compare">
        {ideas.map((i) => {
          const mat = material(i.id);
          const sup = mat.filter((m) => m.l.tone === 'supports' || m.l.tone === 'relates').length;
          const push = mat.length - sup;
          return (
            <div key={i.id} className="cmp-col idea">
              <span className="eyebrow spark">{i.mine ? '✳ My idea' : '✳ Tentative'} · {i.code}</span>
              <h3>{i.title || 'Untitled idea'}</h3>
              <p className="claim">{i.claim}</p>
              <p className="unsettled">{i.unsettled}</p>
              <div>
                <div className="row" style={{ justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>
                  <span>{sup} supporting</span><span>{push} pushing back</span>
                </div>
                <div className="balance">
                  {sup > 0 && <span className="s" style={{ flex: sup }} />}
                  {push > 0 && <span className="c" style={{ flex: push }} />}
                </div>
              </div>
              <div className="mat">
                {mat.map(({ l, other }) => other && (
                  <button key={l.id} onClick={() => api.focus(other.id)}><span className={`t ${l.tone}`}>{l.tone === 'relates' ? 'relates' : l.tone}</span>{other.title} ↗</button>
                ))}
              </div>
              <div className="acts">
                <button className="btn btn-outline btn-sm" onClick={() => api.open({ type: 'idea', id: i.id })}>Explore & edit</button>
                <button className="btn btn-sm btn-danger" onClick={() => api.update((p) => ({ ...p, ideas: p.ideas.map((x) => x.id === i.id ? { ...x, status: 'rejected' } : x) }), true)}>Set aside</button>
                <button className="btn btn-primary btn-sm" onClick={() => api.open({ type: 'brief', ideaId: i.id, autoDraft: true })}>Build a brief →</button>
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

/* ----------------------------- Material ----------------------------- */

export function MaterialPanel({ api, onClose }: { api: Api; onClose: () => void }) {
  const [q, setQ] = useState('');
  const { project } = api;
  const match = (s: string) => s.toLowerCase().includes(q.toLowerCase());
  const items = [
    ...project.cards.map((c) => ({ id: c.id, code: c.code, k: KIND_LABEL[c.kind], t: c.title, s: c.title + c.body })),
    ...project.ideas.map((i) => ({ id: i.id, code: i.code, k: i.status === 'rejected' ? 'Set aside' : 'Tentative idea', t: i.title, s: i.title + i.claim })),
    ...project.groups.map((g) => ({ id: g.id, code: '', k: 'Group', t: g.title, s: g.title })),
  ].filter((x) => !q || match(x.s));
  return (
    <Panel eyebrow="On your canvas" onClose={onClose}>
      <h2>Find a thread.</h2>
      <p className="lede">Jump to any card, idea or group, even when it’s out of view.</p>
      <input className="input search" placeholder="Search your material…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search material" autoFocus />
      <div className="mat-list">
        {items.map((x) => (
          <button key={x.id} className="mat-item" onClick={() => api.focus(x.id)}>
            <span className="code">{x.code}</span>
            <span className="t"><span className="k">{x.k}</span>{x.t || 'Untitled'}</span>
            <span className="muted">↗</span>
          </button>
        ))}
        {!items.length && <p className="note">Nothing matches “{q}”.</p>}
      </div>
    </Panel>
  );
}

/* ------------------------------- Brief ------------------------------- */

const FIELDS: { key: keyof Pick<Brief, 'central' | 'why' | 'counter' | 'unknown' | 'structure'>; label: string; hint: string; req?: boolean }[] = [
  { key: 'central', label: 'Central idea', hint: 'Required', req: true },
  { key: 'why', label: 'Why this matters', hint: 'Required', req: true },
  { key: 'counter', label: 'The counterargument', hint: 'The strongest case against you' },
  { key: 'unknown', label: 'What I still don’t know', hint: 'Honest gaps' },
  { key: 'structure', label: 'A possible structure', hint: 'Not an outline you must follow' },
];

// Embedded viewers (e.g. a sandboxed preview) block downloads, so hide the button there.
const canDownload = (() => { try { return window.self === window.top; } catch { return false; } })();

const emptyBrief = (): Brief => ({ central: '', why: '', material: [], counter: '', unknown: '', structure: '' });

export function toMarkdown(project: Project, b: Brief) {
  const mat = project.cards.filter((c) => b.material.includes(c.id));
  return [
    `# ${project.title}`, '', '_Articulation brief_', '',
    '## Central idea', b.central || '—', '',
    '## Why this matters', b.why || '—', '',
    '## Material I’ll return to', ...(mat.length ? mat.map((c) => `- **${c.code}** ${c.title}`) : ['—']), '',
    '## The counterargument', b.counter || '—', '',
    '## What I still don’t know', b.unknown || '—', '',
    '## A possible structure', b.structure || '—', '',
  ].join('\n');
}

export function BriefPanel({ api, ideaId, autoDraft, onClose }: { api: Api; ideaId?: string; autoDraft?: boolean; onClose: () => void }) {
  const { project } = api;
  const brief = project.brief ?? emptyBrief();
  const [view, setView] = useState<'edit' | 'preview'>('edit');
  const [drafting, setDrafting] = useState<string | null>(null);
  const cancel = useRef(false);
  const activeIdeaId = ideaId ?? brief.ideaId;
  const idea = project.ideas.find((i) => i.id === activeIdeaId);
  const script = ideasFor(project).find((s) => s.key === idea?.scriptKey);

  const setBrief = (patch: Partial<Brief>) => api.update((p) => ({ ...p, brief: { ...(p.brief ?? emptyBrief()), ...patch } }));

  const draft = async () => {
    if (!idea) return;
    mark('brief');
    cancel.current = false;
    const src = { ...(script?.brief ?? {
      central: idea.claim || idea.title, why: '', counter: '', unknown: idea.unsettled, structure: '', materialCodes: [] as string[],
    }) };
    const codes = new Map(project.cards.map((c) => [c.code, c.id]));
    const linked = project.links.filter((l) => l.to === idea.id || l.from === idea.id).map((l) => (l.to === idea.id ? l.from : l.to));
    const material = Array.from(new Set([...src.materialCodes.map((c) => codes.get(c)).filter(Boolean) as string[], ...linked.filter((x) => project.cards.some((c) => c.id === x))]));
    api.update((p) => ({ ...p, brief: { ...emptyBrief(), ideaId: idea.id, material: [] } }), true);
    setDrafting('reading');
    if (liveOn()) {
      try {
        const out = await draftBriefLive(project, idea);
        Object.assign(src, out);
        material.splice(0, material.length, ...out.materialCodes.map((c) => codes.get(c)).filter(Boolean) as string[]);
      } catch (e) { toast(`${(e as Error).message}. Using the scripted draft.`); }
      if (cancel.current) return;
    } else await wait(1100);
    setBrief({ material });
    for (const f of FIELDS) {
      if (cancel.current) break;
      const text = (src as unknown as Record<string, string>)[f.key] ?? '';
      if (!text) continue;
      setDrafting(f.key);
      const tokens = text.split(/(\s+)/);
      for (let k = 2; k <= tokens.length + 1; k += 2) {
        if (cancel.current) break;
        setBrief({ [f.key]: tokens.slice(0, k).join('') });
        await wait(24);
      }
      await wait(250);
    }
    setDrafting(null);
    if (!cancel.current) toast('Draft ready. Every line is yours to change.');
  };

  useEffect(() => {
    if (autoDraft && idea && (!project.brief || project.brief.ideaId !== idea.id || !project.brief.central)) draft();
    return () => { cancel.current = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const md = toMarkdown(project, brief);
  const copy = async () => {
    try { await navigator.clipboard.writeText(md); toast('Brief copied as Markdown'); }
    catch { toast('Copy isn’t available here. Use Download instead.'); }
  };
  const download = () => {
    const blob = new Blob([md], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${project.title.replace(/[^\w]+/g, '-').toLowerCase()}-brief.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const valid = brief.central.trim() && brief.why.trim() && brief.material.length;
  const toggle = (id: string) => setBrief({ material: brief.material.includes(id) ? brief.material.filter((m) => m !== id) : [...brief.material, id] });

  return (
    <Panel eyebrow="Articulation brief" size="xwide" onClose={onClose} foot={<>
      <div className="row" role="tablist">
        <button className={`btn btn-sm ${view === 'edit' ? 'on' : ''}`} onClick={() => setView('edit')}>Edit</button>
        <button className={`btn btn-sm ${view === 'preview' ? 'on' : ''}`} onClick={() => setView('preview')}>Read as a page</button>
      </div>
      <span className="grow" />
      <span className="muted" style={{ fontSize: 12 }}>{drafting ? 'Drafting…' : valid ? 'Saved on this browser' : 'Add a central idea, why it matters, and material'}</span>
      <button className="btn btn-outline btn-sm" onClick={copy} disabled={!!drafting}>Copy Markdown</button>
      {canDownload && <button className="btn btn-primary btn-sm" onClick={download} disabled={!!drafting}>Download .md</button>}
    </>}>
      {view === 'preview' ? (
        <article className="doc">
          <span className="eyebrow">Articulation brief</span>
          <h1>{project.title}</h1>
          <h2>Central idea</h2><p className="central">{brief.central || '—'}</p>
          <h2>Why this matters</h2><p>{brief.why || '—'}</p>
          <h2>Material I’ll return to</h2>
          <ul>{project.cards.filter((c) => brief.material.includes(c.id)).map((c) => <li key={c.id}>{c.title} <span className="muted">({c.code})</span></li>)}</ul>
          <h2>The counterargument</h2><p>{brief.counter || '—'}</p>
          <h2>What I still don’t know</h2><p>{brief.unknown || '—'}</p>
          <h2>A possible structure</h2><p>{brief.structure || '—'}</p>
        </article>
      ) : (
        <div className="brief-grid">
          <div>
            <h2>What I’m trying to say.</h2>
            <p className="lede">A working intention for the piece. It’s a separate snapshot: editing the canvas won’t rewrite it.</p>
            {drafting === 'reading' && <div className="thinking"><div className="step active"><span className="mark" />{liveOn() ? 'Claude is reading' : 'Reading'} “{idea?.title}” and the material behind it…</div></div>}
            {FIELDS.map((f) => (
              <div key={f.key} className="brief-field">
                <label htmlFor={`brief-${f.key}`}>{f.label} <small>{f.hint}</small></label>
                <AutoText id={`brief-${f.key}`} className={`textarea ${f.key === 'central' ? 'central' : ''} ${drafting === f.key ? 'streaming' : ''}`}
                  value={brief[f.key]} onChange={(e) => setBrief({ [f.key]: e.target.value })} readOnly={!!drafting} />
              </div>
            ))}
          </div>
          <div className="brief-aside">
            <div>
              <div className="section-label" style={{ marginTop: 0 }}>Start from</div>
              <select className="input" value={activeIdeaId ?? ''} onChange={(e) => setBrief({ ideaId: e.target.value || undefined })} aria-label="Idea to draft from">
                <option value="">Choose an idea…</option>
                {project.ideas.filter((i) => i.status !== 'rejected').map((i) => <option key={i.id} value={i.id}>{i.title || 'Untitled idea'}</option>)}
              </select>
              <button className="btn btn-spark btn-sm" style={{ marginTop: 8, width: '100%', justifyContent: 'center' }} onClick={draft} disabled={!idea || !!drafting}>
                {drafting ? 'Drafting…' : '✳ Draft from this idea'}
              </button>
              <p className="note" style={{ marginTop: 6 }}>Baansho drafts from your idea and its material. It replaces the current text.</p>
            </div>
            <div>
              <div className="section-label">Material I’ll return to <small style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>{brief.material.length} chosen</small></div>
              <div className="mat-pick">
                {project.cards.map((c) => (
                  <label key={c.id} className={brief.material.includes(c.id) ? 'on' : ''}>
                    <input type="checkbox" checked={brief.material.includes(c.id)} onChange={() => toggle(c.id)} />
                    <span><b style={{ fontWeight: 500, fontSize: 11, color: 'var(--muted)' }}>{c.code}</b> {c.title}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}

/* ------------------------------- Help ------------------------------- */

export function HelpPanel({ onClose }: { onClose: () => void }) {
  return (
    <Panel eyebrow="Make room for an idea" onClose={onClose}>
      <h2>A desk for fragments. A map for your thinking.</h2>
      <p className="lede">What belongs together, and what doesn’t? Your material is meant to stay unfinished for a while.</p>
      <ul className="help-list">
        <li><b>Arrange</b>Drag cards. Drag empty space to roam. Hold ⌘ or Ctrl and scroll to zoom.</li>
        <li><b>Add</b>Double-click empty canvas, or press <span className="kbd">N</span>, to add a note there.</li>
        <li><b>Connect</b>Choose Connect, then two cards. Name what links them. Click a label to edit it.</li>
        <li><b>Group</b>Groups are provisional. Drag a heading to carry the cards inside.</li>
        <li><b>Find ideas</b>Baansho reads your material and suggests tentative directions, each tied to its evidence.</li>
        <li><b>Challenge</b>Open an idea and ask Baansho to argue with it.</li>
        <li><b>Brief</b>When something feels worth pursuing, draft a brief and take it to your writing.</li>
        <li><b>Undo</b><span><span className="kbd">⌘ Z</span> / <span className="kbd">⇧ ⌘ Z</span></span></li>
      </ul>
      <div className="disclaimer" style={{ marginTop: 20 }}>Demo build: idea suggestions are scripted for a reliable walkthrough. Your notes are stored only in this browser.</div>
    </Panel>
  );
}

export type { Link };
export { scriptFor };
