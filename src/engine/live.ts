/**
 * Live AI layer. Two ways to reach Claude:
 *  - "account": inside a Claude artifact viewer, through the page's `sample`
 *    capability (runs on the viewer's own Claude account, no key needed).
 *  - "api": anywhere else, the Claude API called from the browser with a key
 *    the presenter pastes in. Demo-only: a browser key is visible to anyone
 *    using that machine. Put a small server in front of it before going public.
 *
 * Every function here throws on failure; callers fall back to the script.
 */
import Anthropic from '@anthropic-ai/sdk';
import { useSyncExternalStore } from 'react';
import { KIND_LABEL, type Card, type Idea, type LinkTone, type Project } from '../types';
import type { ScriptedIdea } from '../data/samples';

const MODEL = 'claude-opus-5-5';

/* ---------------- settings (mode + key), persisted per browser ---------------- */

type AiMode = 'scripted' | 'live';
interface Settings { mode: AiMode; apiKey: string }
const KEY = 'baansho-ai-settings';
function loadSettings(): Settings {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return { mode: s.mode === 'live' ? 'live' : 'scripted', apiKey: typeof s.apiKey === 'string' ? s.apiKey : '' };
  } catch { return { mode: 'scripted', apiKey: '' }; }
}
let settings = loadSettings();
const listeners = new Set<() => void>();
export function setAi(patch: Partial<Settings>) {
  settings = { ...settings, ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* ignore */ }
  client = null;
  listeners.forEach((l) => l());
}
export const getAi = () => settings;
export function useAi() {
  return useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => settings);
}

/* ---------------- backends ---------------- */

type SampleFn = {
  json: <T>(input: string, opts?: Record<string, unknown>) => Promise<T>;
};
let samplePromise: Promise<SampleFn | null> | null = null;
function accountSampler(): Promise<SampleFn | null> {
  if (!samplePromise) {
    const c = (window as unknown as { claude?: { use: (n: string) => Promise<unknown> } }).claude;
    samplePromise = c?.use ? c.use('sample').then((s) => (s as SampleFn) ?? null).catch(() => null) : Promise.resolve(null);
  }
  return samplePromise;
}

let client: Anthropic | null = null;
function apiClient() {
  if (!settings.apiKey) return null;
  client ??= new Anthropic({ apiKey: settings.apiKey, dangerouslyAllowBrowser: true });
  return client;
}

export type Backend = 'account' | 'api' | 'none';
let backendCache: Backend | null = null;
export async function detectBackend(): Promise<Backend> {
  if (await accountSampler()) return (backendCache = 'account');
  return (backendCache = settings.apiKey ? 'api' : 'none');
}
export const lastBackend = () => backendCache;

/** True when the presenter switched live mode on (a backend may still be missing). */
export const liveOn = () => settings.mode === 'live';

export class LiveError extends Error {}

async function askJSON<T>(prompt: string, schema: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  const sampler = await accountSampler();
  if (sampler) {
    const shape = `\n\nReply with only a JSON value matching this JSON Schema, no other text:\n${JSON.stringify(schema)}`;
    try {
      return await sampler.json<T>(prompt + shape, { effort: 'low', cache: false, signal });
    } catch (e) {
      const code = (e as { code?: string })?.code ?? 'upstream_error';
      throw new LiveError(code === 'not_granted' ? 'Claude wasn’t allowed for this page' : `Claude couldn’t answer (${code})`);
    }
  }
  const c = apiClient();
  if (!c) throw new LiveError('No live AI connected. Add an API key in the presenter panel (Shift + P).');
  try {
    const res = await c.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema', schema } },
      messages: [{ role: 'user', content: prompt }],
    }, { signal });
    if (res.stop_reason === 'refusal') throw new LiveError('Claude declined this request');
    const text = res.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
    return JSON.parse(text) as T;
  } catch (e) {
    if (e instanceof LiveError) throw e;
    if (e instanceof Anthropic.AuthenticationError) throw new LiveError('The API key was rejected');
    if (e instanceof Anthropic.RateLimitError) throw new LiveError('Rate limited by the Claude API');
    if (e instanceof Anthropic.APIError) throw new LiveError(`Claude API error ${e.status ?? ''}`.trim());
    if (e instanceof SyntaxError) throw new LiveError('Claude’s answer wasn’t valid JSON');
    throw new LiveError('Couldn’t reach Claude');
  }
}

/* ---------------- describing the desk ---------------- */

function groupOf(p: Project, c: { x: number; y: number }) {
  return p.groups.find((g) => c.x + 125 >= g.x && c.x + 125 <= g.x + g.w && c.y + 60 >= g.y && c.y + 60 <= g.y + g.h);
}

function describe(p: Project) {
  const codeOf = new Map<string, string>([...p.cards.map((c) => [c.id, c.code] as const), ...p.ideas.map((i) => [i.id, i.code] as const)]);
  const lines = [`Project: "${p.title}"`, '', 'Cards:'];
  for (const c of p.cards) {
    const g = groupOf(p, c);
    lines.push(`${c.code} [${KIND_LABEL[c.kind]}${g ? `, in group "${g.title}"` : ''}] ${c.title}${c.body ? ` — ${c.body.replace(/\s+/g, ' ')}` : ''}${c.aside ? ` (Margin note: ${c.aside.replace(/\s+/g, ' ')})` : ''}`);
  }
  if (p.links.length) {
    lines.push('', 'Connections the writer named:');
    for (const l of p.links) lines.push(`${codeOf.get(l.from)} → ${codeOf.get(l.to)}: "${l.label}"`);
  }
  const ideas = p.ideas.filter((i) => i.status !== 'rejected');
  if (ideas.length) {
    lines.push('', 'Ideas already on the canvas (do not repeat these):');
    for (const i of ideas) lines.push(`${i.code} "${i.title}": ${i.claim}`);
  }
  const rejected = p.ideas.filter((i) => i.status === 'rejected');
  if (rejected.length) {
    lines.push('', 'Ideas the writer set aside (avoid these directions):');
    for (const i of rejected) lines.push(`"${i.title}": ${i.claim}`);
  }
  return lines.join('\n');
}

const VOICE = `You are Baansho, a thinking partner for writers. You help someone see what their scattered notes might add up to, without deciding for them.
Voice: plain, warm, careful. Never overclaim. Treat anecdotes as anecdotes, not evidence. Everything you suggest is tentative and stays the writer's to change.
Always refer to cards by their codes (C1, C2…).`;

const str = { type: 'string' } as const;
const obj = (properties: Record<string, unknown>) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });

/* ---------------- 1. Find ideas ---------------- */

export async function findIdeasLive(p: Project, signal?: AbortSignal): Promise<ScriptedIdea[]> {
  const schema = obj({
    ideas: {
      type: 'array',
      items: obj({
        title: str, claim: str, unsettled: str, why: str,
        material: { type: 'array', items: obj({ code: str, tone: { type: 'string', enum: ['supports', 'complicates', 'challenges'] }, label: str }) },
      }),
    },
  });
  const prompt = `${VOICE}

${describe(p)}

Suggest 3 tentative directions this material could support. They should differ from each other, and at least one should take the tension or counterargument in the material seriously.
For each:
- title: 2 to 6 words, a name for the direction.
- claim: one sentence, at most 25 words, phrased as a possibility ("may", "might").
- unsettled: one or two sentences on what this idea does not settle or could get wrong.
- why: two or three sentences on why it surfaced, citing card codes.
- material: 2 to 4 cards that bear on it. tone is "supports", "complicates" or "challenges". label is a short lowercase phrase (2 to 5 words) naming how that card relates, like "a lived example" or "challenges who can afford it".
Only use card codes that appear above.`;
  const out = await askJSON<{ ideas: Omit<ScriptedIdea, 'key' | 'pos' | 'challenges' | 'brief'>[] }>(prompt, schema, signal);
  const codes = new Set(p.cards.map((c) => c.code));
  const all = [...p.cards.map((c) => ({ x: c.x, y: c.y })), ...p.ideas.map((i) => ({ x: i.x, y: i.y }))];
  const baseY = (all.length ? Math.max(...all.map((n) => n.y)) : 0) + 340;
  const baseX = all.length ? Math.min(...all.map((n) => n.x)) : 0;
  const stamp = Date.now().toString(36);
  const ideas = (out?.ideas ?? []).filter((i) => i && i.title && i.claim).slice(0, 4).map((i, k) => ({
    key: `live-${stamp}-${k}`,
    title: String(i.title), claim: String(i.claim), unsettled: String(i.unsettled ?? ''), why: String(i.why ?? ''),
    material: (i.material ?? []).filter((m) => codes.has(m.code)).map((m) => ({ code: m.code, tone: (['supports', 'complicates', 'challenges'].includes(m.tone) ? m.tone : 'supports') as LinkTone, label: String(m.label || m.tone) })),
    pos: { x: baseX + k * 340, y: baseY + (k % 2) * 40 },
    challenges: [],
    brief: { central: '', why: '', counter: '', unknown: '', structure: '', materialCodes: [] },
  }));
  if (!ideas.length) throw new LiveError('Claude didn’t suggest any ideas');
  return ideas;
}

/* ---------------- 2. Challenge an idea ---------------- */

export async function challengeLive(p: Project, idea: Idea, signal?: AbortSignal) {
  const schema = obj({ challenges: { type: 'array', items: obj({ title: str, body: str }) } });
  const prompt = `${VOICE}

${describe(p)}

The writer wants you to argue with this idea:
${idea.code} "${idea.title}": ${idea.claim}
What it doesn't settle, in their words: ${idea.unsettled || '(nothing written yet)'}

Give the 3 strongest objections to it. Draw on the material where you can, and say so with card codes; one objection may come from outside the material. Be fair, not contrarian.
For each: title is a short heading (at most 7 words); body is two sentences.`;
  const out = await askJSON<{ challenges: { title: string; body: string }[] }>(prompt, schema, signal);
  const list = (out?.challenges ?? []).filter((c) => c?.title && c?.body).slice(0, 4).map((c) => ({ title: String(c.title), body: String(c.body) }));
  if (!list.length) throw new LiveError('Claude didn’t return any objections');
  return list;
}

/* ---------------- 3. Draft the brief ---------------- */

export async function draftBriefLive(p: Project, idea: Idea, signal?: AbortSignal) {
  const schema = obj({ central: str, why: str, counter: str, unknown: str, structure: str, materialCodes: { type: 'array', items: str } });
  const prompt = `${VOICE}

${describe(p)}

Draft an articulation brief: a working intention for a piece of writing, built from this idea:
${idea.code} "${idea.title}": ${idea.claim}
What it doesn't settle: ${idea.unsettled || '(not written)'}

Fields:
- central: the central idea, one sentence the writer could stand behind.
- why: why this matters, two or three sentences.
- counter: the strongest counterargument, citing card codes.
- unknown: what the writer still doesn't know, one or two sentences.
- structure: a possible structure as 4 or 5 numbered lines ("1. …"), each naming the card it leans on in brackets, like (C2). Separate lines with newlines.
- materialCodes: the 3 to 6 card codes most worth returning to.`;
  const out = await askJSON<{ central: string; why: string; counter: string; unknown: string; structure: string; materialCodes: string[] }>(prompt, schema, signal);
  if (!out?.central) throw new LiveError('Claude returned an empty brief');
  const codes = new Set(p.cards.map((c) => c.code));
  return {
    central: String(out.central), why: String(out.why ?? ''), counter: String(out.counter ?? ''),
    unknown: String(out.unknown ?? ''), structure: String(out.structure ?? ''),
    materialCodes: (out.materialCodes ?? []).filter((c) => codes.has(c)),
  };
}

/* ---------------- 4. Name a connection ---------------- */

export async function suggestLabelsLive(a: Card | Idea, b: Card | Idea, signal?: AbortSignal) {
  const desc = (x: Card | Idea) => ('kind' in x ? `${x.code} [${KIND_LABEL[x.kind]}] ${x.title} — ${x.body}` : `${x.code} [Idea] ${x.title} — ${x.claim}`);
  const schema = obj({ labels: { type: 'array', items: str } });
  const prompt = `${VOICE}

The writer is drawing a connection from one note to another:
From: ${desc(a)}
To: ${desc(b)}

Suggest 3 short, different ways to name how the first relates to the second. Each is a lowercase phrase of 1 to 5 words, like "supports", "a lived example of" or "challenges who can afford it".`;
  const out = await askJSON<{ labels: string[] }>(prompt, schema, signal);
  const labels = (out?.labels ?? []).map(String).filter(Boolean).slice(0, 3);
  if (!labels.length) throw new LiveError('No suggestions');
  return labels;
}
