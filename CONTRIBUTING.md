# Contributing to Palmverse

Thanks for your interest. Bug reports, fixes, and reviews of the content are all welcome.

## Set up
```bash
npm ci
npm run dev          # HTTPS dev server and the IWSDK emulator
```
Node 20.19+, 22.12+ or 24+ (see `.nvmrc`).

## Before you open a pull request
```bash
npm run typecheck
npm test             # unit tests, including the safety fuzz over the rule engine
npm run build
```
If you change the flow of the reading, also run the emulator end-to-end test (`npm run test:xr`, see the README) and, if you can, try it on a Quest.

## Content rules
Palmverse presents a living cultural tradition. Any new reading must:
- point at exactly one rule in `src/data/palmistry-rules.json`, with its source;
- pass the banned-claims filter in `src/core/rules.ts` (no death, lifespan, illness, fertility, divorce, money loss, or "you will" predictions);
- be phrased as what the tradition says, not as a forecast.

Reviews from scholars, practising readers and native Hindi speakers are especially welcome: open an issue with the line and your suggested wording.

## Assets
Do not commit API keys. Voice and music clips are pre-rendered and committed; if you re-render them, keep the AI-generation disclosure in `CREDITS.md` up to date. New third-party assets need a compatible licence and an entry in `CREDITS.md`.

## Style
TypeScript, two-space indent, small pure functions in `src/core/` with tests in `tests/`. Keep commit messages short and descriptive.
