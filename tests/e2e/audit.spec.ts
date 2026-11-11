import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { READY } from './ready';

/**
 * Full audit of every simulation in a real browser (see README → Testing).
 *
 * desktop project: every slider (keyboard Home/End/PageUp/PageDown, min, max, middle, random values),
 *   every typed-value field with invalid input, every button (also clicked rapidly), every choice and
 *   switch (and the sliders that appear with them), every preset, play/pause/step/reset/speed and
 *   their combinations with parameter changes, mouse drags and taps all over the canvas, measuring
 *   tools, graph chips, time window, CSV export, the Info tab and the theme switch.
 * mobile project (touch): real touch drags and taps on the canvas, the Controls/Graphs/Info tabs.
 *
 * After every action: no page errors, no console errors or warnings, no NaN/Infinity/undefined/null
 * in the page or in text drawn on the canvas, no drawing call with non-finite coordinates, the
 * canvas is not blank. Screenshots before and after go to tests/e2e/screens/ (git-ignored).
 */
test.describe.configure({ mode: 'parallel' });
// a button may correctly become disabled after the first of several quick clicks (e.g. “Clear”)
test.use({ actionTimeout: 5000 });

const SHOTS = 'tests/e2e/screens';

/** Installed before any page script: watch the stage canvas and count animation frames. */
async function instrument(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __bad: string[]; __raf: number };
    w.__bad = [];
    w.__raf = 0;
    const isStage = new WeakMap<object, boolean>();
    const stage = (ctx: CanvasRenderingContext2D) => {
      let v = isStage.get(ctx);
      if (v === undefined) {
        v = !!ctx.canvas.closest?.('.stage');
        isStage.set(ctx, v);
      }
      return v;
    };
    const P = CanvasRenderingContext2D.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;
    for (const name of ['moveTo', 'lineTo', 'arc', 'fillRect', 'strokeRect', 'rect', 'quadraticCurveTo', 'bezierCurveTo', 'ellipse', 'roundRect', 'arcTo']) {
      const orig = P[name];
      P[name] = function (this: CanvasRenderingContext2D, ...a: unknown[]) {
        if (stage(this))
          for (const v of a)
            if (typeof v === 'number' && !Number.isFinite(v)) {
              if (w.__bad.length < 10) w.__bad.push(`${name}(${a.map((x) => (typeof x === 'number' ? +x.toPrecision(4) : typeof x)).join(', ')})`);
              break;
            }
        return orig.apply(this, a);
      };
    }
    const ft = P.fillText;
    P.fillText = function (this: CanvasRenderingContext2D, ...a: unknown[]) {
      if (stage(this) && /\bNaN\b|Infinity|undefined|\bnull\b/.test(String(a[0])) && w.__bad.length < 10) w.__bad.push(`text “${String(a[0])}”`);
      return ft.apply(this, a);
    };
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => {
      w.__raf++;
      return raf(cb);
    };
  });
}

function listen(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    // the willReadFrequently hint is caused by this test reading canvas pixels, not by the app
    if ((m.type() === 'error' || m.type() === 'warning') && !m.text().includes('willReadFrequently')) errors.push(`console.${m.type()}: ${m.text()}`);
  });
  return errors;
}

/** Health check after an action; problems are collected (not thrown) so one run reports everything. */
async function check(page: Page, errors: string[], problems: string[], what: string, wait = 50) {
  await page.waitForTimeout(wait);
  const r = await page.evaluate(() => {
    const w = window as unknown as { __bad: string[] };
    const bad = w.__bad.splice(0);
    const parts = [...document.querySelectorAll('.ro, .transport .time, .side .pane:not([hidden]) .value, .side .pane:not([hidden]) table')].map((e) => (e as HTMLElement).innerText);
    const txt = parts.join(' | ');
    const m = txt.match(/\bNaN\b|Infinity|undefined|\bnull\b/);
    const c = document.querySelector('.stage canvas') as HTMLCanvasElement | null;
    let colours = 0;
    if (c && c.width > 2 && c.height > 2) {
      const { data } = c.getContext('2d')!.getImageData(0, 0, c.width, c.height);
      const seen = new Set<number>();
      for (let i = 0; i < data.length && seen.size < 3; i += 4 * 7) seen.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
      colours = seen.size;
    }
    return { bad, word: m?.[0], ctx: m ? txt.slice(Math.max(0, (m.index ?? 0) - 80), (m.index ?? 0) + 40) : '', colours };
  });
  const out: string[] = [];
  if (errors.length) out.push(...errors.splice(0));
  if (r.bad.length) out.push(`canvas: ${r.bad.join('; ')}`);
  if (r.word) out.push(`page shows “${r.word}”: …${r.ctx}…`);
  if (r.colours < 2) out.push('canvas is blank');
  for (const o of out) if (problems.length < 60) problems.push(`[${what}] ${o}`);
}

const time = async (page: Page) => {
  const t = await page.locator('.transport .time').innerText().catch(() => '');
  return parseFloat(t.replace(/[^\d.−-]/g, '').replace('−', '-'));
};

async function shot(page: Page, info: TestInfo, id: string, tag: string) {
  const dir = `${SHOTS}/${info.project.name}`;
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/${id}-${tag}.png` });
}

const visibleSliders = (page: Page) => page.locator('.side .pane:not([hidden]) input[type="range"]:visible');

async function exerciseSliders(page: Page, errors: string[], problems: string[], label: string, full: boolean) {
  const n = await visibleSliders(page).count();
  for (let i = 0; i < n; i++) {
    const s = visibleSliders(page).nth(i);
    if (!(await s.count()) || (await s.isDisabled())) continue;
    const name = (await s.evaluate((el) => el.closest('.slider')?.querySelector('label')?.textContent?.trim() ?? '')).slice(0, 40);
    await s.focus();
    for (const key of ['Home', 'End']) {
      await page.keyboard.press(key);
      await check(page, errors, problems, `${label} slider “${name}” ${key}`);
    }
    if (!full) continue;
    for (const f of [0.5, 0.137]) {
      await s.evaluate((el, f) => {
        const input = el as HTMLInputElement;
        const lo = +input.min;
        const hi = +input.max;
        const st = +input.step || 1;
        input.value = String(lo + Math.round(((hi - lo) * f) / st) * st);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }, f);
      await check(page, errors, problems, `${label} slider “${name}” at ${Math.round(f * 100)} %`);
    }
    // typed values, including invalid ones
    for (const typed of ['', 'abc', '-1e9', '1e99', '1,5']) {
      const val = page.locator('.side .pane:not([hidden]) .slider').nth(i).locator('button.val');
      if (!(await val.count())) break;
      await val.click();
      const edit = page.locator('.side .pane:not([hidden]) .slider').nth(i).locator('input.edit');
      await edit.fill(typed);
      await edit.press('Enter');
      await check(page, errors, problems, `${label} slider “${name}” typed “${typed}”`, 30);
      const shown = await val.innerText().catch(() => '');
      if (!/^[−-]?[\d.,]+(e[−-]?\d+)?$/i.test(shown.trim())) problems.push(`[${label} slider “${name}” typed “${typed}”] shows “${shown}”`);
    }
  }
}

for (const id of READY) {
  test(`audit ${id}`, async ({ page }, info) => {
    test.skip(!process.env.AUDIT, 'long audit: run with npm run test:audit');
    test.setTimeout(420_000);
    await instrument(page);
    const errors = listen(page);
    const problems: string[] = [];
    await page.goto(`/#/sim/${id}`);
    await expect(page.locator('.stage canvas')).toBeVisible();
    await page.waitForTimeout(500);
    await check(page, errors, problems, 'start');
    await shot(page, info, id, '1-start');
    const canvas = page.locator('.stage canvas');
    const box = (await canvas.boundingBox())!;
    const hasTransport = (await page.locator('.transport button').count()) > 0;

    if (info.project.name === 'mobile') {
      // real touch events through the DevTools protocol
      const cdp = await page.context().newCDPSession(page);
      const touch = async (type: 'touchStart' | 'touchMove' | 'touchEnd', x: number, y: number) =>
        cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
      for (const fx of [0.2, 0.5, 0.8])
        for (const fy of [0.25, 0.5, 0.75]) {
          const x = box.x + box.width * fx;
          const y = box.y + box.height * fy;
          await touch('touchStart', x, y);
          for (let k = 1; k <= 5; k++) await touch('touchMove', x + k * 12, y + k * 8);
          await touch('touchEnd', 0, 0);
          await check(page, errors, problems, `touch drag at ${fx},${fy}`);
          await page.touchscreen.tap(x, y);
          await check(page, errors, problems, `tap at ${fx},${fy}`);
        }
      for (const tab of ['Graphs', 'Info', 'Controls']) {
        const t = page.getByRole('tab', { name: tab });
        if (await t.count()) {
          await t.click();
          await check(page, errors, problems, `tab ${tab}`);
          const csv = page.locator('button.exp:visible');
          if (tab === 'Graphs' && (await csv.count())) {
            await csv.first().click();
            const dl = page.waitForEvent('download', { timeout: 6000 }).catch(() => null);
            await page.getByRole('menuitem').first().click({ timeout: 4000 }).catch(() => problems.push('[mobile CSV] menu item not clickable'));
            if (!(await dl)) problems.push('[mobile CSV] no download');
          }
        }
      }
      await exerciseSliders(page, errors, problems, 'mobile', false);
      await shot(page, info, id, '2-end');
      expect(problems, problems.join('\n')).toEqual([]);
      return;
    }

    // ---------- desktop: everything ----------
    await exerciseSliders(page, errors, problems, '', true);

    // switches (twice each)
    const toggles = page.locator('.side .pane:not([hidden]) label.toggle input');
    for (let i = 0; i < (await toggles.count()); i++) {
      for (let k = 0; k < 2; k++) {
        await toggles.nth(i).click({ force: true });
        await check(page, errors, problems, `switch ${i} click ${k + 1}`);
      }
    }

    // choices, and the sliders that appear with each option
    const groups = page.locator('.side .pane:not([hidden]) [role=radiogroup]');
    for (let g = 0; g < (await groups.count()); g++) {
      const opts = groups.nth(g).locator('[role=radio]');
      const nOpts = await opts.count();
      for (let o = 0; o < nOpts; o++) {
        const name = await opts.nth(o).innerText();
        await opts.nth(o).click();
        await check(page, errors, problems, `choice “${name}”`, 150);
        await exerciseSliders(page, errors, problems, `with “${name}”`, false);
      }
      await opts.first().click();
    }

    // other buttons, each clicked 5 times quickly
    const buttons = page.locator('.side .pane:not([hidden]) button:visible:not(.val):not([role=radio])');
    for (let i = 0; i < (await buttons.count()); i++) {
      const b = buttons.nth(i);
      if (!(await b.count()) || (await b.isDisabled())) continue;
      const name = (await b.innerText()).trim().slice(0, 30) || (await b.getAttribute('aria-label')) || '?';
      for (let k = 0; k < 5; k++) await b.click({ delay: 0, timeout: 1000 }).catch(() => {});
      await check(page, errors, problems, `button “${name}” ×5`, 200);
    }

    // presets
    const select = page.locator('.preset select');
    if (await select.count()) {
      const values = await select.locator('option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value).filter(Boolean));
      for (const v of values) {
        await select.selectOption(v);
        await check(page, errors, problems, `preset ${v}`, 300);
      }
    }

    // transport and combinations
    if (hasTransport) {
      const play = page.locator('.transport button').first();
      const stepB = page.getByRole('button', { name: /Step one frame/ });
      const reset = page.getByRole('button', { name: /^Reset/ });
      for (let k = 0; k < 10; k++) await play.click({ delay: 0 });
      await check(page, errors, problems, 'play/pause ×10');
      for (let k = 0; k < 10; k++) await stepB.click({ delay: 0 });
      await check(page, errors, problems, 'step ×10');
      for (let k = 0; k < 5; k++) await reset.click({ delay: 0 });
      await check(page, errors, problems, 'reset ×5');
      for (const sp of await page.locator('.transport select option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value))) {
        await page.locator('.transport select').selectOption(sp);
        await check(page, errors, problems, `speed ${sp}×`);
      }
      await page.locator('.transport select').selectOption('1');
      // running → it must advance
      await reset.click();
      if (/Play/.test((await play.getAttribute('aria-label')) ?? '')) await play.click();
      const t0 = await time(page);
      await page.waitForTimeout(700);
      const t1 = await time(page);
      const stillRunning = /Pause/.test((await play.getAttribute('aria-label')) ?? '');
      if (!(t1 > t0) && stillRunning) problems.push(`[running] time did not advance (${t0} → ${t1})`);
      // change a parameter while running, reset while running, pause → change → play
      const sl = visibleSliders(page).first();
      if (await sl.count()) {
        await sl.focus();
        await page.keyboard.press('PageUp');
        await check(page, errors, problems, 'change while running', 300);
        await reset.click();
        await check(page, errors, problems, 'reset while running', 300);
        if (/Pause/.test((await play.getAttribute('aria-label')) ?? '')) await play.click();
        await sl.focus();
        await page.keyboard.press('PageDown');
        await check(page, errors, problems, 'change while paused');
        await play.click();
        const a = await time(page);
        await page.waitForTimeout(600);
        const b = await time(page);
        const running = /Pause/.test((await play.getAttribute('aria-label')) ?? '');
        if (!(b > a) && running) problems.push(`[pause → change → play] time did not advance (${a} → ${b})`);
        await check(page, errors, problems, 'pause → change → play');
      }
    }

    // mouse drags and taps all over the canvas (also catches the ruler / probes when shown)
    for (const fx of [0.15, 0.4, 0.65, 0.9])
      for (const fy of [0.2, 0.5, 0.8]) {
        const x = box.x + box.width * fx;
        const y = box.y + box.height * fy;
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x + 70, y + 40, { steps: 6 });
        await page.mouse.move(x - 50, y - 30, { steps: 4 });
        await page.mouse.up();
        await check(page, errors, problems, `mouse drag at ${fx},${fy}`, 60);
        await page.mouse.click(x, y);
      }
    // a wild drag far outside the canvas
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x - 400, box.y - 300, { steps: 5 });
    await page.mouse.move(box.x + box.width + 400, box.y + box.height + 300, { steps: 5 });
    await page.mouse.up();
    await check(page, errors, problems, 'drag outside the canvas', 200);

    // measuring tools on and off
    const tools = page.locator('.tools button');
    for (let i = 0; i < (await tools.count()); i++) {
      await tools.nth(i).click();
      await check(page, errors, problems, `tool ${i} on`);
      await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.3, { steps: 4 });
      await page.mouse.up();
      await tools.nth(i).click();
      await check(page, errors, problems, `tool ${i} off`);
    }

    // graphs: chips, time window, CSV
    const chips = page.locator('.graphs .chip');
    for (let i = 0; i < (await chips.count()); i++) {
      await chips.nth(i).click();
      await chips.nth(i).click();
    }
    if (await chips.count()) await check(page, errors, problems, 'graph chips');
    for (const w of ['10 s', '30 s', 'All']) {
      const b = page.locator('.graphs [role=radio]', { hasText: w });
      if (await b.count()) await b.click();
    }
    const csv = page.locator('.graphs button.exp');
    if (await csv.count()) {
      await csv.click();
      const dl = page.waitForEvent('download', { timeout: 6000 }).catch(() => null);
      const item = page.getByRole('menuitem').first();
      await item.click({ timeout: 4000 }).catch(async () => {
        const rects: string[] = [];
        for (let k = 0; k < 5; k++) {
          rects.push(await item.evaluate((el) => { const r = el.getBoundingClientRect(); return `${r.x.toFixed(1)},${r.y.toFixed(1)}`; }));
          await page.waitForTimeout(50);
        }
        problems.push(`[CSV] menu item not clickable (moving?): ${rects.join(' ')}`);
        await item.click({ force: true });
      });
      if (!(await dl)) problems.push('[CSV] no download');
      await check(page, errors, problems, 'CSV export');
    }

    // info tab and theme
    await page.getByRole('tab', { name: 'Info' }).click();
    await expect(page.locator('.katex').first()).toBeVisible();
    await page.getByRole('tab', { name: 'Controls' }).click();
    const themeB = page.getByRole('button', { name: /^Theme/ });
    for (let k = 0; k < 3; k++) {
      await themeB.click();
      await check(page, errors, problems, `theme ${k + 1}`, 150);
    }

    await shot(page, info, id, '2-end');
    expect(problems, problems.join('\n')).toEqual([]);
  });
}
