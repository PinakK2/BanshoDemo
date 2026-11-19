export type CardKind =
  | 'messy'
  | 'observation'
  | 'question'
  | 'counter'
  | 'fragment'
  | 'experiment';

export const KIND_LABEL: Record<CardKind, string> = {
  messy: 'Messy note',
  observation: 'Observation',
  question: 'Question',
  counter: 'Counterargument',
  fragment: 'Fragment',
  experiment: 'Experiment',
};

export type LinkTone = 'supports' | 'complicates' | 'challenges' | 'relates';

export interface Card {
  id: string;
  code: string;
  kind: CardKind;
  title: string;
  body: string;
  aside?: string;
  x: number;
  y: number;
  fresh?: boolean;
}

export interface Idea {
  id: string;
  code: string;
  title: string;
  claim: string;
  unsettled: string;
  x: number;
  y: number;
  status: 'tentative' | 'rejected';
  scriptKey?: string;
  why?: string;
  live?: boolean;
  mine?: boolean;
  fresh?: boolean;
}

export interface Group {
  id: string;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Link {
  id: string;
  from: string;
  to: string;
  label: string;
  tone: LinkTone;
}

export interface Brief {
  ideaId?: string;
  central: string;
  why: string;
  material: string[];
  counter: string;
  unknown: string;
  structure: string;
  savedAt?: number;
}

export interface Project {
  id: string;
  title: string;
  subtitle: string;
  sampleKey?: string;
  cards: Card[];
  ideas: Idea[];
  groups: Group[];
  links: Link[];
  brief?: Brief;
  updatedAt: number;
  cardSeq: number;
  ideaSeq: number;
}
