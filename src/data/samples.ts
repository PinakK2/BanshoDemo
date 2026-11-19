import type { Brief, Card, Group, Link, LinkTone, Project } from '../types';

/* ------------------------------------------------------------------ */
/*  Scripted "AI" content. Everything here is deterministic so that a  */
/*  live demo never goes off-script.                                   */
/* ------------------------------------------------------------------ */

export interface ScriptedIdea {
  key: string;
  title: string;
  claim: string;
  unsettled: string;
  why: string; // streamed "why this surfaced" rationale
  material: { code: string; tone: LinkTone; label: string }[];
  pos: { x: number; y: number };
  challenges: { title: string; body: string }[];
  brief: Omit<Brief, 'ideaId' | 'material' | 'savedAt'> & { materialCodes: string[] };
}

export interface ScriptSet {
  readingSteps: (n: { cards: number; links: number; groups: number }) => string[];
  ideas: ScriptedIdea[];
}

/* -------------------------- Sample 1 ------------------------------ */

const convenienceCards: Card[] = [
  {
    id: 'c1', code: 'C1', kind: 'messy', x: 40, y: 70,
    title: 'I know the way. I open Maps anyway.',
    body: 'Tuesday. Going to the same café. Opened Maps before I even thought about it. Arrived quickly, couldn’t tell you which streets I took.',
    aside: 'Is this a memory thing? Or just not paying attention??',
  },
  {
    id: 'c2', code: 'C2', kind: 'observation', x: 940, y: 70,
    title: 'Getting lost left a memory',
    body: 'The time I missed a turn, I found the tiny bookshop with the blue door. Still remember that route.',
    aside: 'Not every wrong turn is a gift, though. Romanticizing inconvenience?',
  },
  {
    id: 'c3', code: 'C3', kind: 'question', x: 60, y: 370,
    title: 'What do we stop practicing?',
    body: 'If a tool does the remembering / choosing / navigating, what happens to that ability?',
    aside: 'Need actual evidence about navigation and spatial memory. Don’t turn an anecdote into a scientific claim.',
  },
  {
    id: 'c4', code: 'C4', kind: 'counter', x: 760, y: 700,
    title: 'Friction isn’t equally affordable',
    body: 'A parent juggling work and care may need the fastest route, not a chance to discover a bookshop. Accessible tools can make participation possible.',
    aside: 'Convenience can buy back attention. Who gets to choose inconvenience?',
  },
  {
    id: 'c5', code: 'C5', kind: 'fragment', x: 400, y: 70,
    title: 'The next thing is already chosen',
    body: 'Autoplay. Recommended reads. The default route. Different tools, same feeling: a decision has happened before I notice there was a decision.',
    aside: 'Maybe this isn’t really about Maps.',
  },
  {
    id: 'c6', code: 'C6', kind: 'messy', x: 1220, y: 300,
    title: 'Some friction teaches',
    body: 'convenience = less friction\nBUT friction sometimes = learning?',
    aside: 'Drafting a sentence badly helps me know what I mean. Waiting on hold does not. Need a distinction better than easy/bad, difficult/good.',
  },
  {
    id: 'c7', code: 'C7', kind: 'question', x: 590, y: 320,
    title: 'A choice, or a default?',
    body: 'Can I tell the difference between deliberately delegating a task and following a default?',
    aside: 'Maybe the cost is losing sight of the choice, rather than losing the skill itself.',
  },
  {
    id: 'c8', code: 'C8', kind: 'experiment', x: 40, y: 720,
    title: 'One walk without directions',
    body: 'Try a familiar trip without turn-by-turn guidance. Write down what I notice. Then try a genuinely unfamiliar trip with it.',
    aside: 'Small personal experiment, not evidence about everyone.',
  },
];

const convenienceGroups: Group[] = [
  { id: 'g1', title: 'The things we do on autopilot', x: 0, y: 0, w: 860, h: 640 },
  { id: 'g2', title: 'Friction that might be worth keeping', x: 900, y: 0, w: 600, h: 620 },
];

const convenienceLinks: Link[] = [
  { id: 'l1', from: 'c1', to: 'c3', label: 'raises a question about practice', tone: 'relates' },
  { id: 'l2', from: 'c2', to: 'c6', label: 'an example of useful friction?', tone: 'supports' },
  { id: 'l3', from: 'c1', to: 'c5', label: 'shares an unnoticed default', tone: 'relates' },
  { id: 'l4', from: 'c5', to: 'c7', label: 'shifts the question toward choice', tone: 'relates' },
  { id: 'l5', from: 'c8', to: 'c3', label: 'offers a personal starting point', tone: 'relates' },
  { id: 'l6', from: 'c4', to: 'c6', label: 'challenges who can afford it', tone: 'challenges' },
];

const convenienceScript: ScriptSet = {
  readingSteps: (n) => [
    `Reading ${n.cards} cards and the notes in their margins`,
    `Following ${n.links} connections you named`,
    `Respecting ${n.groups} provisional groups — without treating them as conclusions`,
    'Looking for tensions, not just agreement',
    'Drafting tentative directions, each tied to its material',
  ],
  ideas: [
    {
      key: 'unnoticed',
      title: 'The unnoticed choice',
      claim: 'The hidden cost of convenience may be losing sight of the choices we delegate.',
      unsettled: 'Delegating can be a deliberate, valuable choice. The distinction needs to stay visible.',
      why: 'C5 and C7 describe the same moment from two sides: a decision that happened before it was noticed. C1 is the lived example. C4 keeps this honest — for some people, not having to choose is the point.',
      material: [
        { code: 'C5', tone: 'supports', label: 'supports' },
        { code: 'C7', tone: 'supports', label: 'supports' },
        { code: 'C1', tone: 'supports', label: 'a lived example' },
        { code: 'C4', tone: 'complicates', label: 'complicates' },
      ],
      pos: { x: 420, y: 730 },
      challenges: [
        { title: 'Noticing has a cost too', body: 'If every default must be noticed, convenience stops being convenient. Maybe some invisibility is the feature, not the bug.' },
        { title: 'Is this about skill after all?', body: 'C3 suggests abilities fade with disuse. “Losing sight of the choice” might be a gentler way of avoiding that harder claim.' },
        { title: 'Who set the default?', body: 'Autoplay and the default route are designed by someone. Framing it as personal attention may let the designers off the hook.' },
      ],
      brief: {
        central: 'The real cost of convenience isn’t lost skill — it’s that we stop noticing which choices we’ve handed over.',
        why: 'Most debate about convenience argues about whether tools make us lazier. That misses the quieter shift: decisions now happen before we notice there was a decision. Naming that lets people delegate on purpose instead of by default.',
        counter: 'For a parent juggling work and care (C4), not having to choose is a gift. The piece must defend deliberate delegation, not romanticize friction.',
        unknown: 'Whether “noticing” is something people can sustain, or just one more burden. Whether the designers of defaults belong in this story.',
        structure: '1. Open with the café and Maps (C1).\n2. Widen: autoplay, recommendations, the default route (C5).\n3. The turn: choice vs. default (C7).\n4. Steelman the counterargument (C4).\n5. Close on a small, deliberate experiment (C8).',
        materialCodes: ['C1', 'C5', 'C7', 'C4', 'C8'],
      },
    },
    {
      key: 'friction',
      title: 'Friction worth keeping',
      claim: 'We need to distinguish friction that helps us grow from friction that only gets in the way.',
      unsettled: 'Who decides what counts as useful friction? Time, access, and care responsibilities change the answer.',
      why: 'C6 already draws the line in rough form: drafting badly teaches, waiting on hold doesn’t. C2 is a concrete case of friction that left something behind. C4 pushes back on who can afford that kind of friction at all.',
      material: [
        { code: 'C6', tone: 'supports', label: 'supports' },
        { code: 'C2', tone: 'supports', label: 'supports' },
        { code: 'C4', tone: 'challenges', label: 'challenges' },
      ],
      pos: { x: 1180, y: 720 },
      challenges: [
        { title: 'Useful in hindsight only', body: 'The bookshop (C2) looks like a gift because it worked out. Most wrong turns are just late arrivals. Is this survivorship bias?' },
        { title: 'Friction you choose vs. friction imposed', body: 'Maybe the distinction isn’t helpful vs. useless, but chosen vs. imposed. That reframes C4 entirely.' },
        { title: 'Growth for whom?', body: '“Friction that helps us grow” assumes there is spare capacity to grow. C4 says many people don’t have it.' },
      ],
      brief: {
        central: 'Not all friction is waste: some of it is how we learn, and the work is telling the two apart.',
        why: 'Products race to remove every bit of friction. If some friction is how we learn and remember, that race has a hidden cost — and people need a way to tell which friction to keep.',
        counter: 'Friction isn’t equally affordable (C4). Anyone arguing for keeping friction must account for time, access, and care.',
        unknown: 'A test that tells useful friction from useless friction in the moment, not just in hindsight (C2 may be survivorship).',
        structure: '1. The bookshop with the blue door (C2).\n2. Drafting badly vs. waiting on hold (C6).\n3. Who can afford friction? (C4)\n4. A working distinction: chosen vs. imposed.\n5. Try it: one walk without directions (C8).',
        materialCodes: ['C2', 'C6', 'C4', 'C8'],
      },
    },
    {
      key: 'attention',
      title: 'Convenience moves attention',
      claim: 'Convenience may not erase effort so much as relocate attention — the open question is where it goes.',
      unsettled: 'It is hard to see where freed attention actually goes. That needs small experiments, not assumptions.',
      why: 'C4 frames convenience as buying back attention. C1 suggests the attention didn’t go anywhere useful — the route just vanished. C8 is a way to actually look, rather than argue.',
      material: [
        { code: 'C4', tone: 'supports', label: 'buys back attention' },
        { code: 'C8', tone: 'supports', label: 'a way to test it' },
        { code: 'C1', tone: 'complicates', label: 'complicates' },
      ],
      pos: { x: 760, y: 1010 },
      challenges: [
        { title: 'Attention isn’t a fixed budget', body: 'Treating attention as something “moved” assumes a fixed quantity. It may simply dissipate.' },
        { title: 'One walk proves little', body: 'C8 is explicitly personal. It can open the piece, but it can’t carry a general claim.' },
      ],
      brief: {
        central: 'Convenience doesn’t delete effort; it relocates attention — and we rarely check where it lands.',
        why: 'It reframes the convenience debate from “good vs. bad” to an auditable question anyone can ask of their own tools.',
        counter: 'Attention may not be a fixed budget that gets moved; sometimes it simply dissipates.',
        unknown: 'How to observe where freed attention goes without fooling ourselves.',
        structure: '1. The vanished route (C1).\n2. Buying back attention (C4).\n3. The experiment (C8).\n4. What the experiment can and can’t show.',
        materialCodes: ['C1', 'C4', 'C8'],
      },
    },
  ],
};

/* -------------------------- Sample 2 ------------------------------ */
/* Used when the presenter pastes the example brain-dump into a new    */
/* project. The splitter turns it into C1…C7 deterministically.        */

export const EXAMPLE_DUMP_TITLE = 'Why we keep notes we never reread';

export const EXAMPLE_DUMP = `I have 2,400 notes in my app. I reread maybe twenty of them a year. The rest just sit there, quietly.

Saving something feels like doing something. Highlight, clip, file. A small hit of progress without the work.

What am I actually saving these for? Future me never seems to show up and read them.

But I remember the notes I wrote by hand. Even the ones I never reopened.

Last week I found the same thought three times. Two years apart. I'd had the idea, forgotten it, and had it again.

Writing it down is the thinking.

Try one week of no saving. Only one sentence, in my own words, about anything I want to keep.`;

const notesScript: ScriptSet = {
  readingSteps: (n) => [
    `Reading ${n.cards} fragments from your brain dump`,
    'Noticing which ones argue with each other',
    'Separating what you observed from what you suspect',
    'Drafting tentative directions, each tied to its material',
  ],
  ideas: [
    {
      key: 'progress',
      title: 'Saving feels like thinking',
      claim: 'Capturing a note can give the feeling of progress without the work of understanding.',
      unsettled: 'Some saving is genuinely useful reference. The claim is about the feeling, not about all notes.',
      why: 'C2 names the feeling directly. C1 is the evidence: thousands saved, almost none revisited. C6 is the quiet counter-thesis — the value was in the writing all along.',
      material: [
        { code: 'C2', tone: 'supports', label: 'names the feeling' },
        { code: 'C1', tone: 'supports', label: 'the evidence' },
        { code: 'C6', tone: 'supports', label: 'points to the alternative' },
      ],
      pos: { x: 80, y: 760 },
      challenges: [
        { title: 'Reference isn’t meant to be reread', body: 'A recipe or a password isn’t “unread” — it’s waiting. The 2,400 may be a library, not a graveyard.' },
        { title: 'The feeling might be the point', body: 'If saving relieves the anxiety of forgetting, that may be worth something on its own.' },
      ],
      brief: {
        central: 'Saving a note can feel like thinking, which is exactly why it so often replaces it.',
        why: 'Note apps promise a second brain. If capture replaces understanding, we are building archives instead of ideas — and the fix is cheap.',
        counter: 'Much of what we save is reference, meant to wait rather than be reread.',
        unknown: 'Whether the handwritten notebook effect (C4) is about the hand, the slowness, or the scarcity.',
        structure: '1. 2,400 notes, twenty rereads (C1).\n2. The small hit of progress (C2).\n3. The notebook I remember (C4).\n4. Writing is the thinking (C6).\n5. One week, one sentence (C7).',
        materialCodes: ['C1', 'C2', 'C4', 'C6', 'C7'],
      },
    },
    {
      key: 'letters',
      title: 'Notes to a future self who never comes',
      claim: 'We write notes for a future reader who rarely shows up — so maybe the note should serve the present writer.',
      unsettled: 'C5 suggests future me does show up, just without knowing the note exists.',
      why: 'C3 asks who the notes are for. C5 is striking: the same thought, had three times, never connected. The notes existed; the reader didn’t find them.',
      material: [
        { code: 'C3', tone: 'supports', label: 'asks who it’s for' },
        { code: 'C5', tone: 'complicates', label: 'complicates' },
      ],
      pos: { x: 640, y: 760 },
      challenges: [
        { title: 'Maybe it’s a search problem', body: 'C5 might be fixed by better retrieval, not by writing differently. That’s a much less interesting essay — is it the true one?' },
      ],
      brief: {
        central: 'Our notes are letters to a future self who rarely reads them; better to write for the self who is writing.',
        why: 'It changes what a good note looks like: not complete, but clarifying for the person writing it now.',
        counter: 'This might simply be a search and retrieval problem (C5).',
        unknown: 'Whether people who reread notes regularly experience any of this.',
        structure: '1. Who are these for? (C3)\n2. The same thought, three times (C5).\n3. Writing for now.\n4. The experiment (C7).',
        materialCodes: ['C3', 'C5', 'C7'],
      },
    },
    {
      key: 'hand',
      title: 'Slowness is the memory',
      claim: 'Handwritten notes stick not because we reread them, but because writing slowly forced a decision about what mattered.',
      unsettled: 'This is a personal observation (C4). It needs care before becoming a general claim about memory.',
      why: 'C4 is the anomaly in your dump: notes remembered without rereading. C6 offers an explanation, and C7 is a way to test it in your own life.',
      material: [
        { code: 'C4', tone: 'supports', label: 'the anomaly' },
        { code: 'C6', tone: 'supports', label: 'explains it?' },
        { code: 'C7', tone: 'supports', label: 'a way to test it' },
      ],
      pos: { x: 1200, y: 760 },
      challenges: [
        { title: 'Selection effect', body: 'You may only remember the handwritten notes that mattered most. The forgettable ones are, by definition, forgotten.' },
      ],
      brief: {
        central: 'Handwritten notes stick because slowness forces us to decide what matters.',
        why: 'It suggests a design principle for any note tool: add a moment of decision, not more capture.',
        counter: 'Selection effect: we remember the handwritten notes that mattered, and forget the rest.',
        unknown: 'Whether typing one sentence in your own words (C7) recreates the effect.',
        structure: '1. The notebook I remember (C4).\n2. Writing is the thinking (C6).\n3. The one-sentence week (C7).',
        materialCodes: ['C4', 'C6', 'C7'],
      },
    },
  ],
};

export const SCRIPTS: Record<string, ScriptSet> = {
  convenience: convenienceScript,
  notes: notesScript,
};

export function makeSampleProject(): Project {
  return {
    id: 'sample-convenience',
    title: 'What convenience costs us',
    subtitle: 'Sample project · an essay in progress',
    sampleKey: 'convenience',
    cards: convenienceCards.map((c) => ({ ...c })),
    ideas: [],
    groups: convenienceGroups.map((g) => ({ ...g })),
    links: convenienceLinks.map((l) => ({ ...l })),
    updatedAt: Date.now(),
    cardSeq: 8,
    ideaSeq: 0,
  };
}
