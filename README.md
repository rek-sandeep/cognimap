# CogniMap — Mind Mapping for Project Management

CogniMap is a mind-mapping tool for project management built on the cognitive
science of how we think. Your project sits at the center; phases, workstreams
and tasks radiate outward — the same way associations radiate in memory.

## Why it works (the academic layer)

| Principle | How CogniMap applies it |
| --- | --- |
| **Radiant thinking** (Buzan, 1974) | The map grows radially from the project core, mirroring associative thought. |
| **Chunking, 7±2** (Miller, 1956; Cowan, 2001) | Branches with more than 7 items get an amber badge and a suggestion to group items into an intermediate phase. |
| **Cognitive load theory** (Sweller, 2020; Kirschner, 2002; Van Merriënboer & Sweller, 2010) | Collapse branches, or Focus mode (`F`) isolates one workstream so everything irrelevant disappears. |
| **Dual coding** (Paivio, 1971) | Kind = shape (starburst / hexagon / square / circle / diamond), status = color + icon, priority = ring weight, progress = arc. |
| **Concept mapping** (Novak & Cañas, 2008) | Cross-branch dependency links with cycle detection — a loop has no valid start point. |
| **Working-memory WIP limit** (Cowan, 2001) | A nudge appears when more than ~4 tasks are in progress at once. |
| **Mind-mapping efficacy** (Farrand et al., 2002; Shi et al., 2023) | Mind maps measurably improve recall and learning outcomes — the same mechanism keeps a whole project holdable in mind. |

## Features

- Radial auto-layout canvas with pan / zoom / fit, dot-grid, curved edges
- Node CRUD: add child (`Tab`), sibling (`Enter`), rename (`F2` or double-click),
  delete (`Del`), collapse/expand (`Space`), focus branch (`F`)
- Task metadata: status, priority, due date, assignee, notes, milestones
- Progress roll-ups on every branch; done cascades to descendants
- Dependency links between any two tasks, drawn as amber arcs, with cycle detection
- Cognitive-health panel: live chunking-limit and WIP checks with research citations
- Export: JSON, Markdown work-breakdown structure, copy outline; import JSON
- Auto-save to the browser (localStorage); PWA — installable, works offline

## Tech

React 19 · TypeScript · Vite · Tailwind CSS · hand-rolled SVG radial layout
(balloon algorithm: angular wedges proportional to visible leaf counts) ·
vite-plugin-pwa (service worker, network-first for HTML).

## Develop

```bash
npm install
npm run dev      # dev server on :3000
npm run build    # production build → dist/
```

## Data model

```jsonc
{
  "version": 1,
  "name": "Website Relaunch",
  "root": { "id": "…", "title": "…", "status": "doing", "priority": "high",
            "due": "2026-11-14", "assignee": "Amara", "milestone": false,
            "collapsed": false, "children": [] },
  "dependencies": [{ "from": "<id>", "to": "<id>" }]  // from must finish before to
}
```

Maps round-trip losslessly through **Data → Export JSON → Import JSON**.
