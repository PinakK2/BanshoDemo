import { useEffect, useState } from 'react';
import { detectBackend, setAi, useAi, type Backend } from '../engine/live';
import { DEMO_STEPS, clearMarks, useMarks } from '../presenter';
import { getPace, setPace } from '../engine/engine';
import { store } from '../store';
import { toast } from './ui';

export function Presenter({ onClose, onHome }: { onClose: () => void; onHome: () => void }) {
  const done = useMarks();
  const [pace, setP] = useState(getPace());
  const choose = (p: number) => { setPace(p); setP(p); };
  const ai = useAi();
  const [backend, setBackend] = useState<Backend | 'checking'>('checking');
  const [key, setKey] = useState(ai.apiKey);
  useEffect(() => { let on = true; setBackend('checking'); detectBackend().then((b) => on && setBackend(b)); return () => { on = false; }; }, [ai.apiKey]);
  const status = {
    checking: 'Checking for a connection to Claude…',
    account: 'Connected through your Claude account. Claude asks once before the first live call.',
    api: 'Connected with your API key (Claude Opus 5.5).',
    none: 'Not connected. Paste a Claude API key below, or open the published page in Claude.',
  }[backend];
  return (
    <div className="presenter" role="dialog" aria-label="Presenter panel">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h4>Presenter · demo script</h4>
        <button onClick={onClose} aria-label="Close presenter panel">×</button>
      </div>
      <ol>
        {DEMO_STEPS.map((s) => (
          <li key={s.key} className={done.has(s.key) ? 'done' : ''}>{s.label}<small>{s.hint}</small></li>
        ))}
      </ol>
      <div>AI</div>
      <div className="prow">
        <button className={ai.mode === 'scripted' ? 'on' : ''} onClick={() => setAi({ mode: 'scripted' })}>Scripted</button>
        <button className={ai.mode === 'live' ? 'on' : ''} onClick={() => { setAi({ mode: 'live' }); toast(backend === 'none' ? 'Live AI is on, but not connected yet' : 'Live AI is on'); }}>Live (Claude)</button>
      </div>
      {ai.mode === 'live' && <>
        <p className="status">{status}</p>
        {backend !== 'account' && (
          <form onSubmit={(e) => { e.preventDefault(); setAi({ apiKey: key.trim() }); toast(key.trim() ? 'API key saved in this browser' : 'API key removed'); }}>
            <input id="presenter-key" type="password" placeholder="sk-ant-… API key" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" aria-label="Claude API key" />
            <div className="prow"><button type="submit">Save key</button>{ai.apiKey && <button type="button" onClick={() => { setKey(''); setAi({ apiKey: '' }); }}>Remove</button>}</div>
            <p className="status">Stored only in this browser. Fine for a demo laptop; don’t use on a shared machine.</p>
          </form>
        )}
        <p className="status">If a live call fails, the demo falls back to the scripted content.</p>
      </>}
      <div style={{ marginTop: 12 }}>AI pacing</div>
      <div className="prow">
        <button className={pace === 1 ? 'on' : ''} onClick={() => choose(1)}>Natural</button>
        <button className={pace === 0.45 ? 'on' : ''} onClick={() => choose(0.45)}>Brisk</button>
        <button className={pace === 1.6 ? 'on' : ''} onClick={() => choose(1.6)}>Slow, for narration</button>
      </div>
      <div style={{ marginTop: 12 }}>Reset</div>
      <div className="prow">
        <button onClick={() => { store.resetSample(); clearMarks(); toast('Sample project reset'); }}>Reset sample</button>
        <button onClick={() => { store.resetAll(); clearMarks(); onHome(); toast('Demo reset to a clean desk'); }}>Reset everything</button>
      </div>
      <p className="hint">Toggle with Shift + P. Only you see this panel. Scripted mode plays the same way every run. Live mode asks Claude about whatever is on the canvas.</p>
    </div>
  );
}
