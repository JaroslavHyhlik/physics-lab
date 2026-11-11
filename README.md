# Physics Lab

Interactive physics simulations for **IB Physics HL** (first assessment 2025, themes A–E) and a
phyphox-style mobile sensor lab. Accurate models with automatic tests against analytic results,
live graphs, measuring tools and CSV export.

Not affiliated with or endorsed by the International Baccalaureate Organization.

## Run it on your Mac

You need Node.js 24 (already installed in `~/.local/node`). In Terminal:

```bash
cd ~/Projects/physics-lab
npm install        # first time only: downloads the libraries
npm run dev        # starts the site at http://localhost:5173
```

Stop the server with `Ctrl + C`.

## Check that everything works

```bash
npm test           # physics tests (Vitest)
npm run check      # type check
npm run test:e2e   # browser tests (Playwright, uses Google Chrome)
npm run build      # production build into dist/
```

### Full audit (takes about 30–60 minutes)

```bash
npm run test:audit      # every control of every simulation, phone/tablet/desktop sizes, navigation
npm run test:inventory  # regenerates docs/inventory.md: the list of all simulations and their controls
npm run test:all        # everything above, one after another
```

`test:audit` opens every simulation in Google Chrome and tries every slider (ends, middle, random
values, typed values including invalid ones like `abc` or `1e99`), every button (also clicked
quickly many times), every switch, choice and preset, play/pause/step/reset/speed and their
combinations, mouse and touch drags on the canvas, the measuring tools, graphs, CSV export, the Info
tab and the theme. After every action it checks for errors and warnings in the console, for NaN,
Infinity, undefined or null on the page or drawn on the canvas, and that the canvas is still drawn and
the simulation still runs. Screenshots before and after are saved in `tests/e2e/screens/`. It also
checks 375/768/1440 px widths on a Retina (2×) screen, resizing while running, every link and file,
and that switching simulations leaves no animation loops or workers running.

To run one simulation only: `AUDIT=1 npx playwright test tests/e2e/audit.spec.ts -g "audit c1-pendulum$"`.
A failed test prints every problem it found; `npx playwright show-report` shows the details.

## How it is organised

- `src/core/` – numerics: fixed time step, integrators (RK4, RK45, Verlet, Yoshida, Boris), constants
  from the IB data booklet, random numbers, data recording, CSV
- `src/physics/` – one physics model per simulation, independent of drawing
- `src/sims/<id>/` – each simulation's screen, drawing and texts
- `src/ui/`, `src/sim/`, `src/tools/` – design system, simulation layout, graphs, ruler, stopwatch
- `tests/physics/` – each model compared with analytic or known results
- `PLAN.md` – the plan with a checkbox for every simulation; `CLAUDE.md` – project rules

## Publishing

Every push to `main` runs the tests on GitHub. Once the repository is public, the site is deployed
automatically to GitHub Pages (HTTPS, needed for phone sensors).
