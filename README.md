# Baansho: desktop demo

A clickable demo of Baansho, a thinking canvas that turns scattered notes into connected ideas and an articulation brief. It's built for controlled walkthroughs with users and investors.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in dist/ (deploy to Vercel, Netlify, S3…)
```

## Demo flow

1. **Home**: projects, plus "Start from a brain dump".
2. **Sample project** ("What convenience costs us"): 8 cards, 2 groups, 6 named connections, no ideas yet.
3. **Open a card**: edit the note and its margin doubt, and see its connections.
4. **Connect**: choose two cards, then pick a suggested label or write your own.
5. **✳ Find ideas**: Baansho shows reading steps, then streams in 3 tentative ideas, each with its reasoning and the cards behind it. They land on the canvas with their links.
6. **Challenge an idea**: streamed objections. Any of them can become a counterargument card.
7. **Compare ideas**: the ideas side by side, with the balance of supporting and challenging material.
8. **Build a brief**: Baansho drafts every field and picks the material. Export with Copy Markdown or Download .md.
9. **New project → "Use example notes"**: a brain dump becomes 7 typed cards, and it has its own scripted ideas.

**Presenter panel: `Shift + P`.** It holds the demo script checklist, AI pacing (Natural / Brisk / Slow) and reset buttons.

## How the AI works: Scripted or Live

Use the presenter panel (**Shift + P**) to switch between the two modes.

- **Scripted** (the default) plays pre-written content from `src/data/samples.ts`, so every run plays the same way.
- **Live (Claude)** sends whatever is on the canvas to Claude. Four features use it: Find ideas, Challenge this idea, Draft the brief and suggested connection names. The code is in `src/engine/live.ts`.
  - **Inside the published Claude page**, it runs on the viewer's own Claude account. No key is needed; Claude asks the viewer for permission once.
  - **When you run or host it yourself**, paste a Claude API key into the presenter panel. The app calls Claude Opus 5.5 directly from the browser with low effort, structured JSON output and server-side refusal fallbacks. The key is stored only in that browser's localStorage, so this setup is for a demo laptop. Before a public launch, move the calls behind a small server so the key isn't in the browser.
  - If any live call fails (bad key, no connection, rate limit), the app shows a short message and uses the scripted content instead.

## Code map

| Path | What it holds |
| --- | --- |
| `src/types.ts` | Data model: cards, ideas, groups, links, brief |
| `src/store.ts` | App state, undo/redo, localStorage persistence |
| `src/components/Workspace.tsx` | Canvas (React Flow), toolbar, connect mode, link popover |
| `src/components/panels.tsx` | Card, idea, find-ideas, compare, material, brief and help panels |
| `src/components/nodes.tsx` | Card, idea and group nodes, and the floating labelled edges |
