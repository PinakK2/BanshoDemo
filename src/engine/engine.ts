import type { Card, CardKind, Project } from '../types';
import { EXAMPLE_DUMP, SCRIPTS, type ScriptSet, type ScriptedIdea } from '../data/samples';

/* Demo pacing. Presenter can switch to "brisk" from the presenter panel. */
let pace = 1;
export const setPace = (p: number) => { pace = p; };
export const getPace = () => pace;
export const wait = (ms: number) => new Promise((r) => setTimeout(r, ms * pace));

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

export function classify(text: string): CardKind {
  const t = text.trim();
  const first = t.split(/(?<=[.!?])\s/)[0] ?? t;
  if (/^(but|however|then again|counterpoint|on the other hand|although)\b/i.test(t)) return 'counter';
  if (/^(try|experiment|what if i|test:|next week|this week)\b/i.test(t)) return 'experiment';
  if (first.includes('?')) return 'question';
  if (/^(i (have|saw|noticed|found|realised|realized)|last (week|month|night)|yesterday|today|this morning|on \w+day)\b/i.test(t)) return 'observation';
  if (t.length < 70) return 'fragment';
  return 'messy';
}

function titleAndBody(text: string): { title: string; body: string } {
  const t = norm(text);
  const sentences = t.split(/(?<=[.!?])\s+/);
  let title = sentences[0];
  let rest = sentences.slice(1).join(' ');
  if (title.length > 64) {
    const comma = title.search(/[,;:—]\s/);
    if (comma >= 18 && comma <= 64) {
      rest = title.slice(comma + 1).trim() + (rest ? ' ' + rest : '');
      title = title.slice(0, comma);
    } else {
      const cut = title.slice(0, 52).replace(/\s+\S*$/, '');
      rest = '…' + title.slice(cut.length).trim() + (rest ? ' ' + rest : '');
      title = cut + '…';
    }
  }
  title = title.replace(/[.]$/, '');
  return { title, body: rest };
}

/** Deterministically turn a brain dump into cards laid out in a loose grid. */
export function splitDump(text: string, startSeq = 0): Card[] {
  let parts = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) parts = text.split(/\n/).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) parts = text.split(/(?<=[.!?])\s+/).map((p) => p.trim()).filter(Boolean);
  const cols = 4;
  return parts.slice(0, 24).map((p, i) => {
    const { title, body } = titleAndBody(p);
    const n = startSeq + i + 1;
    const col = i % cols;
    const row = Math.floor(i / cols);
    return {
      id: `c${n}-${Math.random().toString(36).slice(2, 7)}`,
      code: `C${n}`,
      kind: classify(p),
      title,
      body,
      x: col * 300 + (row % 2 ? 40 : 0),
      y: row * 300 + (col % 2 ? 30 : 0),
      fresh: true,
    };
  });
}

export function scriptFor(project: Project): ScriptSet | undefined {
  return project.sampleKey ? SCRIPTS[project.sampleKey] : undefined;
}

export function isExampleDump(text: string) {
  return norm(text) === norm(EXAMPLE_DUMP);
}

const STOP = new Set('the a an and or but if of to in on for with is are was were be it this that i my me we our you your not no do does did so as at by from just what how why who can could would should have has had about into than then them they there their its'.split(' '));
const words = (s: string) => new Set(s.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter((w) => w.length > 3 && !STOP.has(w)));

/** Fallback for unscripted projects: honest, pattern-based directions. */
export function fallbackIdeas(project: Project): ScriptedIdea[] {
  const cards = project.cards;
  if (cards.length < 2) return [];
  const qs = cards.filter((c) => c.kind === 'question');
  const counters = cards.filter((c) => c.kind === 'counter');
  const anchors = [...qs, ...counters, ...cards.filter((c) => c.kind !== 'question' && c.kind !== 'counter')].slice(0, 2);
  const maxY = Math.max(...cards.map((c) => c.y)) + 360;
  return anchors.map((a, i) => {
    const aw = words(a.title + ' ' + a.body);
    const related = cards
      .filter((c) => c.id !== a.id)
      .map((c) => ({ c, score: [...words(c.title + ' ' + c.body)].filter((w) => aw.has(w)).length }))
      .sort((x, y) => y.score - x.score)
      .slice(0, 2)
      .map((r) => r.c);
    const isQ = a.kind === 'question';
    const isCounter = a.kind === 'counter';
    return {
      key: `fallback-${a.id}`,
      title: isQ ? `Circling: ${a.title.replace(/\?$/, '')}` : isCounter ? `The tension in “${a.title}”` : `A thread from ${a.code}`,
      claim: isQ
        ? `Your material keeps returning to one question. The cards around ${a.code} may already hold a partial answer.`
        : isCounter
          ? `${a.code} pushes against the rest of your material. That tension may be the most interesting thing here.`
          : `${a.code} seems to anchor a cluster of related material worth developing.`,
      unsettled: 'This is a pattern in your notes, not a conclusion. Check whether the connected cards actually agree.',
      why: `${a.code} shares language and concerns with ${related.map((r) => r.code).join(' and ') || 'other cards'}. Proximity isn’t proof — open each card to decide if the connection holds.`,
      material: [
        { code: a.code, tone: 'supports' as const, label: 'anchors' },
        ...related.map((r) => ({ code: r.code, tone: (r.kind === 'counter' ? 'complicates' : 'supports') as 'supports' | 'complicates', label: r.kind === 'counter' ? 'complicates' : 'relates' })),
      ],
      pos: { x: 120 + i * 560, y: maxY },
      challenges: [
        { title: 'Is this a pattern or a coincidence?', body: 'Shared words don’t guarantee shared meaning. Re-read the material side by side.' },
        { title: 'What would change your mind?', body: 'Name one observation that, if true, would make this direction wrong.' },
      ],
      brief: {
        central: isQ ? a.title : `What ${a.title.toLowerCase()} reveals`,
        why: '',
        counter: counters[0] ? `${counters[0].title} (${counters[0].code})` : '',
        unknown: 'What evidence would make this more than a hunch?',
        structure: [a, ...related].map((c, k) => `${k + 1}. ${c.title} (${c.code})`).join('\n'),
        materialCodes: [a.code, ...related.map((r) => r.code)],
      },
    };
  });
}

export function ideasFor(project: Project): ScriptedIdea[] {
  return scriptFor(project)?.ideas ?? fallbackIdeas(project);
}

export function readingSteps(project: Project): string[] {
  const n = { cards: project.cards.length, links: project.links.length, groups: project.groups.length };
  return scriptFor(project)?.readingSteps(n) ?? [
    `Reading ${n.cards} cards`,
    n.links ? `Following ${n.links} connections you named` : 'Noticing which cards echo each other',
    'Looking for questions your material keeps circling',
    'Drafting tentative directions, each tied to its material',
  ];
}

/** Suggested names for a new connection, based on card kinds. */
export function suggestLabels(a?: { kind?: string }, b?: { kind?: string }): string[] {
  const ka = a?.kind, kb = b?.kind;
  if (ka === 'counter' || kb === 'counter') return ['challenges', 'complicates', 'limits who this applies to'];
  if (kb === 'question') return ['raises this question', 'offers a starting point', 'answers in part'];
  if (ka === 'experiment' || kb === 'experiment') return ['a way to test it', 'offers a personal starting point', 'supports'];
  if (ka === 'observation') return ['an example of', 'supports', 'complicates'];
  if (!ka || ka === 'idea' || kb === 'idea') return ['supports', 'complicates', 'challenges'];
  return ['echoes', 'supports', 'complicates'];
}

export function toneOf(label: string): 'supports' | 'complicates' | 'challenges' | 'relates' {
  const l = label.toLowerCase();
  if (l.includes('challenge') || l.includes('limit')) return 'challenges';
  if (l.includes('complicat')) return 'complicates';
  if (l.includes('support') || l.includes('example') || l.includes('answer')) return 'supports';
  return 'relates';
}
