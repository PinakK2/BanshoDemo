import { useEffect, useRef, useState, type ReactNode } from 'react';
import { getPace } from '../engine/engine';

/** Reveal text word-by-word, like a model streaming tokens. */
export function useStream(text: string, run: boolean, onDone?: () => void, speed = 28) {
  const [n, setN] = useState(run ? 0 : Infinity);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    if (!run) { setN(Infinity); return; }
    const tokens = text.split(/(\s+)/);
    let i = 0;
    setN(0);
    const id = window.setInterval(() => {
      i += 2;
      setN(i);
      if (i >= tokens.length) { window.clearInterval(id); doneRef.current?.(); }
    }, speed * getPace());
    return () => window.clearInterval(id);
  }, [text, run, speed]);
  if (n === Infinity) return { out: text, streaming: false };
  const tokens = text.split(/(\s+)/);
  return { out: tokens.slice(0, n).join(''), streaming: n < tokens.length };
}

export function Stream({ text, run, onDone, speed, as: Tag = 'span', className }: {
  text: string; run: boolean; onDone?: () => void; speed?: number; as?: 'span' | 'p' | 'h3' | 'div'; className?: string;
}) {
  const { out, streaming } = useStream(text, run, onDone, speed);
  return <Tag className={`${className ?? ''} ${streaming ? 'caret' : ''}`}>{out}</Tag>;
}

export function Panel({ eyebrow, onClose, children, foot, size }: {
  eyebrow: ReactNode; onClose: () => void; children: ReactNode; foot?: ReactNode; size?: 'wide' | 'xwide';
}) {
  return (
    <aside className={`panel ${size ?? ''}`} role="dialog" aria-label={typeof eyebrow === 'string' ? eyebrow : undefined}>
      <div className="panel-head">
        <span className="eyebrow">{eyebrow}</span>
        <button className="panel-close" onClick={onClose} aria-label="Close">×</button>
      </div>
      <div className="panel-body">{children}</div>
      {foot && <div className="panel-foot">{foot}</div>}
    </aside>
  );
}

/** Textarea that grows with its content. */
export function AutoText(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 2 + 'px';
  }, [props.value]);
  return <textarea ref={ref} rows={1} {...props} />;
}

/* -------- toasts -------- */
type Toast = { id: number; text: string; action?: { label: string; run: () => void } };
let toasts: Toast[] = [];
const tl = new Set<(t: Toast[]) => void>();
export function toast(text: string, action?: Toast['action']) {
  const t = { id: Date.now() + Math.random(), text, action };
  toasts = [...toasts, t];
  tl.forEach((l) => l(toasts));
  setTimeout(() => { toasts = toasts.filter((x) => x.id !== t.id); tl.forEach((l) => l(toasts)); }, 4200);
}
export function Toasts() {
  const [list, setList] = useState<Toast[]>(toasts);
  useEffect(() => { tl.add(setList); return () => { tl.delete(setList); }; }, []);
  return (
    <div className="toasts" aria-live="polite">
      {list.map((t) => (
        <div className="toast" key={t.id}>
          {t.text}
          {t.action && <button onClick={t.action.run}>{t.action.label}</button>}
        </div>
      ))}
    </div>
  );
}
