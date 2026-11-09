# Physics Lab — project rules

Interactive physics simulations for **IB Physics HL** (first assessment 2025, themes A–E) plus a
phyphox-style **mobile sensor lab**. Own code and design (PhET is only inspiration).

- **PLAN.md** is the source of truth: phases, a checkbox per simulation, the per-simulation
  definition of done, and the "▶ Kde pokračovat" (resume here) table.
- **docs/ib-reference.md**: booklet constants, symbols, SL vs. HL equations. Read it before writing
  any formula, label or HL badge.

## The user

- IB Physics HL student, **not a programmer**. Talk to them in **Czech**, simply, without jargon.
  Address them with gender-neutral Czech (present/future tense; avoid past participles like "napsal jsi").
- Website UI is in **English** with IB terminology.
- Phone: **iPhone (Safari)** — iOS is the primary target for the mobile lab.
- **Limited usage plan.** Be economical: no subagents unless clearly needed; read only the parts of
  files you need; prefer text/DOM checks over screenshots; keep messages short.

## Resume protocol (sessions can end abruptly when the usage limit runs out)

1. Session start: read "▶ Kde pokračovat" in PLAN.md, run `git status` and `git log --oneline -5`,
   then continue with "Další krok". Don't re-plan finished work.
2. Work in small units: one simulation or one foundation item at a time.
3. After each finished unit: tests green → tick its checkbox → update "▶ Kde pokračovat" →
   commit → push. Same commit for code and PLAN.md.
4. Stopping mid-unit: describe the state in "Rozpracováno / poznámky", commit with a `wip:` prefix, push.
5. Never end a turn with valuable work only in the working tree.

## Environment & commands

- Node.js 24 LTS is in `~/.local/node/bin` (added to PATH in `~/.zshrc`). If a shell can't find
  `node`: `export PATH="$HOME/.local/node/bin:$PATH"`.
- GitHub CLI (`gh`) goes to `~/.local/bin` (Phase 1).
- Scripts (keep in sync with package.json): `npm run dev` · `npm test` (Vitest, physics + unit) ·
  `npm run test:e2e` (Playwright; builds the site, uses the installed Google Chrome locally) ·
  `npm run build` · `npm run check` (svelte-check, types).
- Dev server for the browser pane: run `npm run dev` in a terminal tab, then open http://localhost:5173.
- A new simulation follows the pattern of `src/sims/c1-pendulum/` (meta.ts = params, presets, channels,
  graphs, info; render.ts = canvas drawing; Sim.svelte = wiring with SimShell + SimController).
  Register it with `load` in `src/app/registry.ts` and add its id to `READY` in `tests/e2e/smoke.spec.ts`.

## Architecture

```
src/core/      pure TS, no DOM: fixed-step loop, integrators, vectors, constants, units, seeded RNG, CSV
src/physics/   one model per simulation: state + step(dt) + derived quantities; pure, deterministic
src/sims/<id>/ meta.ts (id, syllabus code, title, HL flags, keywords, formulas, assumptions, presets,
               data channels) + Svelte screen + renderer
src/ui/        design system components and tokens
src/tools/     ruler, stopwatch, probe, protractor
src/lab/       mobile sensor lab
src/workers/   Web Worker entry points
tests/         Vitest physics tests (tests/physics), Playwright e2e (tests/e2e)
```

- Physics code never imports Svelte, DOM or canvas. Renderers never change physics state.
- Sim ids: `<syllabus>-<name>`, e.g. `a1-car-acceleration`, `c1-pendulum`. Hash routes: `#/sim/<id>?param=value`.
- Each sim is lazy-loaded (dynamic import).

## Physics accuracy rules (top priority)

1. SI units internally everywhere; convert only for display (IB style units: m s⁻², J K⁻¹ mol⁻¹).
2. Constants only from `src/core/constants.ts` = booklet values (g = 9.8). Use CODATA only when a
   sim says so explicitly.
3. Fixed timestep with an accumulator and a max-substeps cap. Time scale, pause and single-step only
   change how many steps run — results never depend on frame rate.
4. Integrators: conservative systems → symplectic (velocity Verlet / Yoshida 4); smooth dissipative
   ODEs → RK4 (adaptive RK45 where useful); charged particles in B → Boris; PDEs → finite differences
   with an enforced CFL limit, or Crank–Nicolson. Note the choice and reason at the top of each model.
5. Every model has Vitest tests against analytic/known results and conservation laws, with explicit,
   justified tolerances. Stochastic models: seeded RNG, assertions within statistical bounds (≈4σ).
6. No visual fakes. Anything not to scale (vector lengths, sizes, slowed time) is labelled. Every
   simplification goes into `meta.assumptions` and is shown in the "Model assumptions" box.
7. Formulas and symbols follow docs/ib-reference.md. HL content gets the HL badge; extras beyond the
   syllabus are labelled "Beyond syllabus".
8. Never tune constants to make things "look right". If unsure, derive and verify first.

## Performance rules

- Target 60 fps on iPhone and a weak laptop. No allocations in hot loops; typed arrays; reuse objects.
- Physics costing more than ~2 ms per frame → Web Worker with transferable buffers. No
  SharedArrayBuffer (GitHub Pages can't send COOP/COEP headers).
- Per-pixel fields and big particle counts → WebGL2 (with a Canvas 2D fallback where practical).
- Cap devicePixelRatio at 2; stop the loop when the tab is hidden or the sim is off-screen.
- Charts: uPlot, ring buffers, redraw at most ~30 Hz.

## Design rules

- Colours, spacing, radii and motion only via design tokens (CSS variables in `src/ui/`); both light
  and dark themes; never hard-code colours.
- Use `src/ui` components. Pointer events (mouse + touch), touch targets ≥ 44 px, keyboard access,
  WCAG AA contrast, respect `prefers-reduced-motion`.
- Layout (SimShell): desktop = canvas + right panel (Controls / Info) + graphs below the canvas;
  mobile = canvas on top + tabs (Controls / Graphs / Info). Measuring tools are a floating toolbar
  on the canvas; the transport bar floats at the bottom of the canvas (hidden for static sims).
- Numbers: tabular figures, sensible significant figures, units always visible.

## Mobile lab (iOS Safari specifics)

- `DeviceMotionEvent.requestPermission()` / `DeviceOrientationEvent.requestPermission()` only from a
  user tap; HTTPS only. iOS has no Generic Sensor API (no magnetometer µT, no light sensor).
- Feature-detect, never sniff user agents. Explain unavailable sensors in the UI.
- Microphone: `getUserMedia` with echoCancellation, noiseSuppression and autoGainControl off;
  resume AudioContext on tap. Tone output: set `navigator.audioSession.type = 'playback'` when available.
- Screen Wake Lock while recording. Measure and show the real sample rate; timestamps from
  `event.timeStamp` / `performance.now()`.

## Content & legal

- Never copy PhET (or other) code, art or text.
- `reference/` is git-ignored (IBO copyright). Never commit or quote the booklet/guide.
- Footer disclaimer: "Not affiliated with or endorsed by the International Baccalaureate Organization."
  Don't put "IB" in the product name.
- External data (NIST, AME2020, star catalogues): cite source and licence in the sim's info panel and
  in `docs/data-sources.md`.

## Git & publishing

- Solo project on `main`. Commit messages: `<area>: <what>`, e.g. `sim(c1-pendulum): add damping`.
- Never commit failing tests or a broken build (except `wip:` commits per the resume protocol).
- End of each phase: `npm test`, `npm run build`, `npm run test:e2e`, check new sims in the browser
  pane (desktop + 375 px mobile, light + dark), commit, push, tick PLAN.md.
- The repository is **public** and the site is live at https://jaroslavhyhlik.github.io/physics-lab/
  (approved by the user on 2026-11-09). Every push to `main` runs CI and deploys automatically.
- Unattended / scheduled runs work on branch `night` (push only to `origin night`); the user reviews
  it and only then it is merged into `main`. Never change repository visibility or Pages settings.
