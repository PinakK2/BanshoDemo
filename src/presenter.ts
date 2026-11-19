import { useSyncExternalStore } from 'react';

/** Milestones the presenter panel ticks off as the demo progresses. */
export const DEMO_STEPS = [
  { key: 'open', label: 'Open the sample project', hint: 'A real essay in progress: fragments, not a finished outline.' },
  { key: 'card', label: 'Open a card', hint: 'Cards hold doubts in the margin. Connections are named by the writer.' },
  { key: 'connect', label: 'Connect two cards', hint: 'Baansho suggests names. The writer decides.' },
  { key: 'ideas', label: 'Find ideas', hint: 'Directions appear with the material behind them.' },
  { key: 'challenge', label: 'Challenge an idea', hint: 'Baansho argues back instead of agreeing.' },
  { key: 'compare', label: 'Compare ideas', hint: 'Side by side, with the balance of evidence.' },
  { key: 'brief', label: 'Draft the brief', hint: 'From scattered notes to a clear intention.' },
  { key: 'new', label: 'Start from a brain dump', hint: 'New project → “Use example notes”.' },
] as const;
export type StepKey = (typeof DEMO_STEPS)[number]['key'];

let done = new Set<StepKey>();
const ls = new Set<() => void>();
export function mark(k: StepKey) {
  if (done.has(k)) return;
  done = new Set(done).add(k);
  ls.forEach((l) => l());
}
export function clearMarks() { done = new Set(); ls.forEach((l) => l()); }
export function useMarks() {
  return useSyncExternalStore((l) => { ls.add(l); return () => { ls.delete(l); }; }, () => done);
}
