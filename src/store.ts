import { useSyncExternalStore } from 'react';
import type { Card, Project } from './types';
import { makeSampleProject } from './data/samples';

interface State {
  projects: Record<string, Project>;
  order: string[];
}

const KEY = 'baansho-demo-v1';

function initial(): State {
  const s = makeSampleProject();
  return { projects: { [s.id]: s }, order: [s.id] };
}

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as State;
      if (parsed?.projects && parsed.order) return parsed;
    }
  } catch { /* storage unavailable */ }
  return initial();
}

let state: State = load();
const listeners = new Set<() => void>();
const past: Record<string, Project[]> = {};
const future: Record<string, Project[]> = {};

let saveTimer: number | undefined;
function emit() {
  listeners.forEach((l) => l());
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
  }, 250);
}

export const store = {
  get: () => state,
  subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },

  /** Snapshot the project so the next change can be undone. */
  checkpoint(id: string) {
    const p = state.projects[id];
    if (!p) return;
    (past[id] ||= []).push(p);
    if (past[id].length > 80) past[id].shift();
    future[id] = [];
  },

  update(id: string, fn: (p: Project) => Project, opts: { history?: boolean } = {}) {
    const p = state.projects[id];
    if (!p) return;
    if (opts.history) store.checkpoint(id);
    const next = { ...fn(p), updatedAt: Date.now() };
    state = { ...state, projects: { ...state.projects, [id]: next } };
    emit();
  },

  undo(id: string) {
    const prev = past[id]?.pop();
    if (!prev) return;
    (future[id] ||= []).push(state.projects[id]);
    state = { ...state, projects: { ...state.projects, [id]: prev } };
    emit();
  },
  redo(id: string) {
    const nxt = future[id]?.pop();
    if (!nxt) return;
    (past[id] ||= []).push(state.projects[id]);
    state = { ...state, projects: { ...state.projects, [id]: nxt } };
    emit();
  },
  canUndo: (id: string) => (past[id]?.length ?? 0) > 0,
  canRedo: (id: string) => (future[id]?.length ?? 0) > 0,

  create(title: string, cards: Card[], sampleKey?: string): string {
    const id = `p-${Date.now().toString(36)}`;
    const p: Project = {
      id, title: title || 'Untitled project', subtitle: 'Your project', sampleKey,
      cards, ideas: [], groups: [], links: [], updatedAt: Date.now(),
      cardSeq: cards.length, ideaSeq: 0,
    };
    state = { projects: { ...state.projects, [id]: p }, order: [id, ...state.order] };
    emit();
    return id;
  },

  remove(id: string) {
    const { [id]: _gone, ...rest } = state.projects;
    void _gone;
    state = { projects: rest, order: state.order.filter((o) => o !== id) };
    emit();
  },

  resetSample() {
    const s = makeSampleProject();
    past[s.id] = []; future[s.id] = [];
    state = {
      projects: { ...state.projects, [s.id]: s },
      order: state.order.includes(s.id) ? state.order : [...state.order, s.id],
    };
    emit();
  },

  resetAll() {
    Object.keys(past).forEach((k) => { past[k] = []; future[k] = []; });
    state = initial();
    emit();
  },
};

export function useStore<T>(sel: (s: State) => T): T {
  return useSyncExternalStore(store.subscribe, () => sel(state));
}

export const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 9)}`;
