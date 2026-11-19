import { store, useStore } from '../store';
import { toast } from './ui';

function ago(t: number) {
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}

export function Home({ onOpen, onNew, onPresenter }: { onOpen: (id: string) => void; onNew: () => void; onPresenter: () => void }) {
  const { projects, order } = useStore((s) => s);
  const list = order.map((id) => projects[id]).filter(Boolean);

  return (
    <div className="home">
      <div className="home-inner">
        <div className="home-top">
          <span className="brand">baansho <span className="star">✳</span></span>
          <button className="btn btn-quiet" onClick={onPresenter}>Presenter <span className="kbd">⇧ P</span></button>
        </div>

        <section className="home-hero">
          <h1>A desk for fragments.<br /><em>A map for your thinking.</em></h1>
          <p>
            Baansho helps writers and thinkers turn scattered notes into something they can say clearly.
            Lay out your material, name how it connects, and let Baansho suggest tentative directions,
            each one tied to the evidence behind it.
          </p>
        </section>

        <div className="steps" aria-label="How it works">
          {[
            ['Collect', 'Dump notes, doubts and half-sentences.'],
            ['Connect', 'Arrange cards and name what links them.'],
            ['Find ideas', 'See tentative directions with their sources.'],
            ['Articulate', 'Draft a brief you can write from.'],
          ].map(([t, d], i) => (
            <div key={t}><span className="eyebrow">Step {i + 1}</span><b>{t}</b><span>{d}</span></div>
          ))}
        </div>

        <div className="projects-head">
          <h2>Your projects</h2>
          <span className="muted" style={{ fontSize: 12 }}>{list.length} on this desk</span>
        </div>
        <div className="project-grid">
          <button className="project-card project-new" onClick={onNew}>
            <span className="eyebrow spark">✳ New</span>
            <h3>Start from a brain dump</h3>
            <span className="muted" style={{ fontSize: 13 }}>Paste messy notes. Baansho sorts them into cards.</span>
          </button>
          {list.map((p) => (
            <div key={p.id} className="project-card" role="button" tabIndex={0}
              onClick={() => onOpen(p.id)} onKeyDown={(e) => e.key === 'Enter' && onOpen(p.id)}>
              <span className="eyebrow">{p.sampleKey === 'convenience' ? 'Sample project' : 'Project'}</span>
              <h3>{p.title}</h3>
              <div className="mini" aria-hidden>
                {p.cards.slice(0, 12).map((c) => <i key={c.id} className={c.kind === 'counter' ? 'counter' : ''} />)}
                {p.ideas.filter((i) => i.status !== 'rejected').map((i) => <i key={i.id} className="idea" />)}
              </div>
              <div className="meta">
                <span>{p.cards.length} cards</span>
                <span>{p.ideas.filter((i) => i.status !== 'rejected').length} ideas</span>
                <span>{p.links.length} connections</span>
                <span style={{ marginLeft: 'auto' }}>{ago(p.updatedAt)}</span>
              </div>
              {p.sampleKey !== 'convenience' && (
                <button className="btn btn-quiet del" onClick={(e) => {
                  e.stopPropagation();
                  const snapshot = { ...p };
                  store.remove(p.id);
                  toast(`Removed “${snapshot.title}”`);
                }}>Remove</button>
              )}
            </div>
          ))}
        </div>

        <div className="home-foot">
          <span>Desktop demo · your work is saved in this browser only</span>
          <span>Idea generation in this demo build is scripted for a reliable walkthrough</span>
        </div>
      </div>
    </div>
  );
}
