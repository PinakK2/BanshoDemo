import { useState } from 'react';
import { EXAMPLE_DUMP, EXAMPLE_DUMP_TITLE } from '../data/samples';
import { isExampleDump, splitDump, wait } from '../engine/engine';
import { store } from '../store';
import { mark } from '../presenter';

export function NewProject({ onCancel, onCreated }: { onCancel: () => void; onCreated: (id: string) => void }) {
  const [title, setTitle] = useState('');
  const [dump, setDump] = useState('');
  const [busy, setBusy] = useState(false);
  const count = dump.trim() ? splitDump(dump).length : 0;

  const create = async (blank = false) => {
    setBusy(true);
    const cards = blank ? [] : splitDump(dump);
    if (!blank) await wait(900);
    const id = store.create(title.trim() || (cards[0]?.title ?? 'Untitled project'), cards, isExampleDump(dump) ? 'notes' : undefined);
    mark('new');
    onCreated(id);
  };

  return (
    <div className="np">
      <div className="np-inner">
        <div className="home-top">
          <button className="brand" onClick={onCancel}>baansho <span className="star">✳</span></button>
          <button className="btn" onClick={onCancel}>← All projects</button>
        </div>
        <h1>What are you trying to figure out?</h1>
        <p className="lede">
          Paste everything: notes from your phone, a messy draft, quotes, doubts. Separate thoughts with a blank line.
          Baansho turns each one into a card you can arrange and connect.
        </p>
        <div className="field">
          <label htmlFor="np-title">Working title <small>You can change it later</small></label>
          <input id="np-title" className="input input-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Why we keep notes we never reread" />
        </div>
        <div className="field">
          <label htmlFor="np-dump">Brain dump <small>{count ? `${count} card${count === 1 ? '' : 's'} so far` : 'Nothing is too messy'}</small></label>
          <textarea id="np-dump" className="textarea dump" value={dump} onChange={(e) => setDump(e.target.value)}
            placeholder={'I have 2,400 notes and I reread maybe twenty…\n\nWhat am I actually saving these for?'} />
        </div>
        <div className="np-actions">
          <button className="btn btn-outline" onClick={() => { setDump(EXAMPLE_DUMP); if (!title) setTitle(EXAMPLE_DUMP_TITLE); }}>
            Use example notes
          </button>
          <span className="grow" />
          <button className="btn" onClick={() => create(true)} disabled={busy}>Start with a blank canvas</button>
          <button className="btn btn-primary" onClick={() => create()} disabled={!count || busy}>
            {busy ? 'Sorting your notes…' : `✳ Sort into ${count || ''} cards`}
          </button>
        </div>
      </div>
    </div>
  );
}
