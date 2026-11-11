# Audit report (11. 11. 2026)

Full automatic audit of every simulation in Google Chrome (`npm run test:audit`), plus physics,
type and build checks. Final run after all fixes: **358/358 physics tests, 0 type errors,
349/349 regular browser tests, 255/255 audit tests** (84 simulations × desktop and touch phone,
84 × three screen widths, 3 navigation tests). Nothing needed a retry.

## Bugs found and fixed

| # | Where | Bug | Fix |
|---|---|---|---|
| 1 | all simulations with graphs (desktop) | The CSV export menu opened upwards out of the graph panel and was clipped, hidden behind the canvas: the first item could not be clicked | menu opens downwards inside the panel (`src/sim/GraphPanel.svelte`) |
| 2 | d3-charged-particle | Velocity selector with E = 0: the selected speed E/B = 0 was used as a divisor → particles got NaN positions and disappeared | reference speed when E = 0; speeds labelled in m s⁻¹; readout explains that nothing passes |
| 3 | e5-hr-diagram | 7 very faint stars within 20 pc had luminosity rounded to 0 in the data → log(0) = −∞, drawn off the canvas | data kept to 4 significant figures (`scripts/extract-data.py`); plot skips non-positive L |

Problems in the test itself (not the site), found and corrected while writing it: a 5× quick click
on “Clear” waited for the (correctly) disabled button; the blank-canvas check sampled too sparsely
and missed a single small dot; the canvas pixel read-back caused a browser performance hint.

## Physics checks (tests/physics, 358 tests)

Every model is compared with analytic results; `tests/physics/long-run.test.ts` adds long runs with
the simulations' own time steps: projectile range/height vs formula (10⁻⁶), charged particle in B over
20 000 turns (speed exact, radius stable), string wave and heat conduction at the stability limit for
5 minutes of simulated time (no blow-up, steady state P_in = P_out), three-body figure-eight over 50
periods (energy 10⁻⁶, momentum 10⁻⁹), ripple tank 6000 steps. Existing tests already cover the
pendulum (energy 10⁻⁸ over 1000 periods at 90°), orbits (1000 orbits), gas and collisions (energy,
momentum). No model uses explicit Euler for oscillations: conservative systems use velocity Verlet
or Yoshida-4, the rest RK4, Boris, leapfrog with the CFL limit, or exact solutions.

## Per simulation

| Simulation | Tested controls | Bugs found | Fixed | Status |
|---|---|---|---|---|
| a1-car-acceleration | 10 sliders (+ typed values), 4 switches, 5 presets, play/pause/step/reset/speed, canvas drag / tap, 2 tools, graphs + CSV | CSV menu hidden (shared) | yes | ✅ |
| a1-projectile | 8 sliders (+ typed values), 4 switches, 1 buttons, 8 presets, play/pause/step/reset/speed, canvas drag / tap, 2 tools, graphs + CSV | CSV menu hidden (shared) | yes | ✅ |
| a1-motion-graphs | 1 choices, 1 switches, 5 presets, play/pause/step/reset/speed, canvas drag / tap, graphs + CSV | CSV menu hidden (shared) | yes | ✅ |
| a2-inclined-plane | 8 sliders (+ typed values), 3 switches, 7 presets, play/pause/step/reset/speed, canvas drag / tap, 2 tools, graphs + CSV | CSV menu hidden (shared) | yes | ✅ |
| a2-collisions-1d | 6 sliders (+ typed values), 3 switches, 6 presets, play/pause/step/reset/speed, canvas drag / tap, 2 tools, graphs + CSV | CSV menu hidden (shared) | yes | ✅ |
| a2-collisions-2d | 7 sliders (+ typed values), 4 switches, 6 presets, play/pause/step/reset/speed, canvas drag / tap, 2 tools, graphs + CSV | CSV menu hidden (shared) | yes | ✅ |
| a2-banked-curve | 6 sliders (+ typed values), 2 switches, 6 presets, play/pause/step/reset/speed, 1 tools, graphs + CSV | CSV menu hidden (shared) | yes | ✅ |
| a2-drag-buoyancy | 7 sliders (+ typed values), 1 switches, 6 presets, play/pause/step/reset/speed, canvas drag / tap, 2 tools, graphs + CSV | CSV menu hidden (shared) | yes | ✅ |
| a2-newton-lift | 5 sliders (+ typed values), 2 choices, 2 switches, 7 presets, play/pause/step/reset/speed, 1 tools, graphs + CSV | CSV menu hidden (shared) | yes | ✅ |
| a2-rocket | 6 sliders (+ typed values), 4 switches, 5 presets, play/pause/step/reset/speed, 1 tools, graphs + CSV | CSV menu hidden (shared) | yes | ✅ |
| a2-car-drift | 6 sliders (+ typed values), 2 switches, 5 presets, play/pause/step/reset/speed, graphs + CSV | CSV menu hidden (shared) | yes | ✅ |
| a3-spring-launcher | 4 sliders (+ typed values), 1 switches, 4 presets, play/pause/step/reset/speed, canvas drag / tap, 2 tools, graphs + CSV | CSV menu hidden (shared) | yes | ✅ |
| a3-work-power | 8 sliders (+ typed values), 1 switches, 5 presets, play/pause/step/reset/speed, 1 tools, graphs + CSV | CSV menu hidden (shared) | yes | ✅ |
| a3-roller-coaster | 4 sliders (+ typed values), 2 switches, 6 presets, play/pause/step/reset/speed, canvas drag / tap, 2 tools, graphs + CSV | CSV menu hidden (shared) | yes | ✅ |
| a4-torque-equilibrium | 6 sliders (+ typed values), 1 choices, 6 presets, play/pause/step/reset/speed, canvas drag / tap, 2 tools, graphs + CSV | CSV menu hidden (shared) | yes | ✅ |
| a4-rolling-race | 7 sliders (+ typed values), 1 switches, 4 presets, play/pause/step/reset/speed, 1 tools, graphs + CSV | CSV menu hidden (shared) | yes | ✅ |
| a4-angular-momentum | 4 sliders (+ typed values), 1 choices, 5 presets, play/pause/step/reset/speed, 1 tools, graphs + CSV | CSV menu hidden (shared) | yes | ✅ |
| a4-rotational-dynamics | 6 sliders (+ typed values), 4 presets, play/pause/step/reset/speed, canvas drag / tap, 2 tools, graphs + CSV | CSV menu hidden (shared) | yes | ✅ |
| a5-galilean | 3 sliders (+ typed values), play/pause/step/reset/speed, 1 tools, graphs + CSV | CSV menu hidden (shared) | yes | ✅ |
| a5-spacetime-diagram | 1 sliders (+ typed values), 3 switches, 4 presets, canvas drag / tap | — | — | ✅ |
| a5-time-dilation | 1 sliders (+ typed values), 1 choices, 3 presets, play/pause/step/reset/speed, 1 tools, graphs + CSV | CSV menu hidden (shared) | yes | ✅ |
| a5-length-contraction | 3 sliders (+ typed values), 3 presets, play/pause/step/reset/speed, 1 tools, graphs + CSV | CSV menu hidden (shared) | yes | ✅ |
| a5-lorentz | 3 sliders (+ typed values), 1 choices, 4 presets | — | — | ✅ |
| b1-particle-model | 1 sliders (+ typed values), 2 choices, 5 presets, play/pause/step/reset/speed, graphs + CSV | CSV menu hidden (shared) | yes | ✅ |
| b1-heating-curve | 3 sliders (+ typed values), 3 presets, play/pause/step/reset/speed, graphs + CSV | CSV menu hidden (shared) | yes | ✅ |
| b1-black-body | 2 sliders (+ typed values), 1 switches, 5 presets | — | — | ✅ |
| b1-calorimetry | 4 sliders (+ typed values), 2 switches, 4 presets, play/pause/step/reset/speed, 1 tools, graphs + CSV | CSV menu hidden (shared) | yes | ✅ |
| b1-conduction | 4 sliders (+ typed values), 5 presets, play/pause/step/reset/speed, graphs + CSV | CSV menu hidden (shared) | yes | ✅ |
| b2-energy-balance | 4 sliders (+ typed values), 5 presets, play/pause/step/reset/speed, graphs + CSV | CSV menu hidden (shared) | yes | ✅ |
| b2-greenhouse-photons | 2 sliders (+ typed values), 4 presets, play/pause/step/reset/speed, graphs + CSV | CSV menu hidden (shared) | yes | ✅ |
| b3-gas-container | 2 sliders (+ typed values), 1 choices, 2 switches, 5 presets, play/pause/step/reset/speed, canvas drag / tap, graphs + CSV | CSV menu hidden (shared) | yes | ✅ |
| b3-maxwell-boltzmann | 1 sliders (+ typed values), 2 choices, 4 presets, play/pause/step/reset/speed, graphs + CSV | CSV menu hidden (shared) | yes | ✅ |
| b3-gas-laws | 3 sliders (+ typed values), 2 choices, 2 buttons, 4 presets | — | — | ✅ |
| b4-pv-processes | 4 sliders (+ typed values), 1 choices, 5 presets, play/pause/step/reset/speed, graphs + CSV | CSV menu hidden (shared) | yes | ✅ |
| b4-heat-engines | 3 sliders (+ typed values), 1 choices, 3 presets, play/pause/step/reset/speed, graphs + CSV | CSV menu hidden (shared) | yes | ✅ |
| b4-entropy | 1 sliders (+ typed values), 1 choices, 3 presets, play/pause/step/reset/speed, graphs + CSV | CSV menu hidden (shared) | yes | ✅ |
| b5-internal-resistance | 3 sliders (+ typed values), 1 choices, 2 buttons, 4 presets | — | — | ✅ |
| b5-resistivity | 2 sliders (+ typed values), 2 buttons, 3 presets, canvas drag / tap | — | — | ✅ |
| b5-iv-characteristics | 1 sliders (+ typed values), 1 choices, 2 buttons, 3 presets | — | — | ✅ |
| b5-circuit-kit | 1 choices, 1 switches, 12 buttons, 5 presets, canvas tap to select, 11 tools | — | — | ✅ |
| c1-pendulum | 5 sliders (+ typed values), 3 switches, 7 presets, play/pause/step/reset/speed, canvas drag / tap, 2 tools, graphs + CSV | CSV menu hidden (shared) | yes | ✅ |
| c1-mass-spring | 4 sliders (+ typed values), 1 choices, 5 presets, play/pause/step/reset/speed, canvas drag / tap, 1 tools, graphs + CSV | CSV menu hidden (shared) | yes | ✅ |
| c1-phase | 5 sliders (+ typed values), 1 switches, 4 presets, play/pause/step/reset/speed, 1 tools, graphs + CSV | CSV menu hidden (shared) | yes | ✅ |
| c2-wave-types | 4 sliders (+ typed values), 1 choices, 3 presets, play/pause/step/reset/speed, 1 tools, graphs + CSV | CSV menu hidden (shared) | yes | ✅ |
| c2-wave-string | 3 sliders (+ typed values), 2 choices, 1 switches, 1 buttons, 5 presets, play/pause/step/reset/speed, 1 tools, graphs + CSV | CSV menu hidden (shared) | yes | ✅ |
| c3-refraction | 3 sliders (+ typed values), 1 choices, 5 presets, canvas drag / tap | — | — | ✅ |
| c3-ripple-tank | 2 sliders (+ typed values), 2 choices, 6 presets, play/pause/step/reset/speed, canvas drag / tap | — | — | ✅ |
| c3-double-slit | 4 sliders (+ typed values), 1 switches, 4 presets | — | — | ✅ |
| c3-diffraction | 4 sliders (+ typed values), 1 switches, 4 presets | — | — | ✅ |
| c4-string-standing | 4 sliders (+ typed values), 1 switches, 1 buttons, 3 presets, play/pause/step/reset/speed | — | — | ✅ |
| c4-pipes | 3 sliders (+ typed values), 2 choices, 1 buttons, 4 presets, play/pause/step/reset/speed | — | — | ✅ |
| c4-resonance | 2 sliders (+ typed values), 1 choices, 4 presets, play/pause/step/reset/speed, 1 tools, graphs + CSV | CSV menu hidden (shared) | yes | ✅ |
| c5-doppler | 4 sliders (+ typed values), 2 buttons, 4 presets, play/pause/step/reset/speed | — | — | ✅ |
| c5-shock-waves | 1 sliders (+ typed values), 4 presets, play/pause/step/reset/speed | — | — | ✅ |
| c5-redshift | 1 sliders (+ typed values), 3 presets | — | — | ✅ |
| d1-orbits | 3 sliders (+ typed values), 1 switches, 2 buttons, 4 presets, play/pause/step/reset/speed, 1 tools, graphs + CSV | CSV menu hidden (shared) | yes | ✅ |
| d1-escape-velocity | 2 sliders (+ typed values), 5 presets, play/pause/step/reset/speed, 1 tools, graphs + CSV | CSV menu hidden (shared) | yes | ✅ |
| d1-grav-potential | 1 sliders (+ typed values), 2 switches, 3 presets, canvas drag / tap | — | — | ✅ |
| d1-n-body | 1 sliders (+ typed values), 1 switches, 4 presets, play/pause/step/reset/speed, canvas drag / tap, graphs + CSV | CSV menu hidden (shared) | yes | ✅ |
| d2-charges-and-fields | 2 sliders (+ typed values), 8 switches, 5 buttons, 7 presets, canvas drag / tap, 3 tools | — | — | ✅ |
| d2-millikan | 2 sliders (+ typed values), 2 buttons, 2 presets, play/pause/step/reset/speed, canvas tap to select | — | — | ✅ |
| d2-magnetic-fields | 1 sliders (+ typed values), 1 choices, 4 presets, canvas drag / tap | — | — | ✅ |
| d3-charged-particle | 2 sliders (+ typed values), 2 choices, 5 presets, play/pause/step/reset/speed | Selector mode with E = 0: division by zero, particles got NaN positions and vanished | yes | ✅ |
| d3-wire-forces | 4 sliders (+ typed values), 1 choices, 4 presets | — | — | ✅ |
| d4-magnet-coil | 2 sliders (+ typed values), 1 choices, 1 switches, 4 presets, play/pause/step/reset/speed, canvas drag / tap, 1 tools, graphs + CSV | CSV menu hidden (shared) | yes | ✅ |
| d4-generator | 4 sliders (+ typed values), 3 presets, play/pause/step/reset/speed, 1 tools, graphs + CSV | CSV menu hidden (shared) | yes | ✅ |
| d4-rod-rails | 5 sliders (+ typed values), 3 presets, play/pause/step/reset/speed, 1 tools, graphs + CSV | CSV menu hidden (shared) | yes | ✅ |
| e1-rutherford | 2 sliders (+ typed values), 1 choices, 3 presets, play/pause/step/reset/speed | — | — | ✅ |
| e1-spectra | 2 choices, 4 presets, canvas tap to select | — | — | ✅ |
| e1-bohr | 1 choices, 2 presets | — | — | ✅ |
| e2-photoelectric | 3 sliders (+ typed values), 2 choices, 5 presets, play/pause/step/reset/speed | — | — | ✅ |
| e2-de-broglie | 1 sliders (+ typed values), 1 choices, 2 buttons, 5 presets, play/pause/step/reset/speed | — | — | ✅ |
| e2-compton | 2 sliders (+ typed values), 2 buttons, 4 presets, play/pause/step/reset/speed | — | — | ✅ |
| e3-decay | 1 sliders (+ typed values), 1 choices, 1 buttons, 5 presets, play/pause/step/reset/speed | — | — | ✅ |
| e3-penetration | 2 sliders (+ typed values), 3 choices, 1 switches, 2 buttons, 5 presets, play/pause/step/reset/speed | — | — | ✅ |
| e3-binding-energy | 2 sliders (+ typed values), 1 choices, 1 switches, 6 presets, canvas tap to select | — | — | ✅ |
| e3-nuclide-chart | 2 sliders (+ typed values), 1 choices, 1 switches, 6 presets, canvas tap to select | — | — | ✅ |
| e4-chain-reaction | 3 sliders (+ typed values), 1 choices, 6 presets, play/pause/step/reset/speed, graphs + CSV | CSV menu hidden (shared) | yes | ✅ |
| e4-reactor | 2 sliders (+ typed values), 2 switches, 1 buttons, 6 presets, play/pause/step/reset/speed, graphs + CSV | CSV menu hidden (shared) | yes | ✅ |
| e5-hr-diagram | 1 sliders (+ typed values), 2 choices, 2 switches, 4 presets, canvas tap to select | 7 very faint stars had L rounded to 0 → log(0) = −∞, drawn off the canvas | yes (data precision + guard) | ✅ |
| e5-parallax | 2 sliders (+ typed values), 2 buttons, 5 presets, play/pause/step/reset/speed | — | — | ✅ |
| e5-luminosity | 3 sliders (+ typed values), 7 presets | — | — | ✅ |
| e5-fusion | 1 sliders (+ typed values), 1 choices, 4 presets | — | — | ✅ |
| e5-stellar-equilibrium | 2 sliders (+ typed values), 5 presets, play/pause/step/reset/speed, graphs + CSV | CSV menu hidden (shared) | yes | ✅ |
Every simulation was additionally: started and checked for console errors/warnings, NaN/Infinity/
undefined/null on the page and in text drawn on the canvas, drawing calls with non-finite coordinates,
blank canvas, running time; dragged and tapped with the mouse over a 4 × 3 grid and with real touch
events over a 3 × 3 grid; switched through the Info tab and the theme; checked at 375, 768 and 1440 px
on a 2× screen (sharp canvas, no sideways scrolling) and while resizing.

## Mobile sensor lab (built after the audit, phase 4)

`tests/e2e/lab.spec.ts` (runs with every `npm run test:e2e`) fires simulated sensor events and checks
the results against known values: g from a phone at rest (9.81), pendulum period 1.419 s → g ≈ 9.8,
gyroscope angle, centripetal a–ω² fit → r = 10 cm, spring k = 31.6 N m⁻¹, tilt and compass, a 440 Hz tone
found by the FFT, two clicks 0.25 s apart on the acoustic stopwatch, GPS distance while moving, the
measured sample rate, refused permissions (motion, microphone, location), a laptop without sensors and
a sensor that never sends data. The lab pages are also in the width check (375/768/1440 px).

Bugs found while testing the lab and fixed: a single empty (null) sensor event could turn the
gyroscope angle into NaN and stop the recording, and made a device without sensors look as if it
had one; readouts could freeze while the browser decided about keeping the screen on; switching
quickly between lab pages could briefly show the previous tool with the new tool’s data; the CSV
button stayed disabled after recording.

## Not covered automatically (check by hand, ideally on the iPhone)

- **Mobile lab on the real iPhone**: the permission prompt, real sensor values and sign conventions,
  the sample rate, the microphone (with the iPhone’s own filtering), GPS outdoors, the share sheet
  (AirDrop), the tone generator with the silent switch on, the screen staying on while measuring.
- How it feels on a real iPhone: touch precision on small targets (ruler ends, circuit-kit grid),
  scrolling in the Controls tab, the readouts box covering part of the picture on a narrow screen.
- Real performance: 60 fps on the iPhone and an older laptop (heavy ones: particle model, gas,
  ripple tank, N-body).
- Sound (Doppler, standing waves, resonance): that it plays and is not too loud.
- Downloaded CSV files open correctly in Excel/Numbers (the download itself is tested).
- Whether a drawing looks right (labels overlapping, colours in dark mode): screenshots of every
  simulation before/after are in `tests/e2e/screens/` after running the audit.
- Physics plausibility that has no formula to compare with (qualitative parts: HR life tracks,
  greenhouse photons picture).
