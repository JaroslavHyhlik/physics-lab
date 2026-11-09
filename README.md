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
