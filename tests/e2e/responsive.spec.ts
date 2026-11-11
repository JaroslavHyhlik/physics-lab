import { test, expect, type Page } from '@playwright/test';
import { READY } from './ready';

/**
 * Every simulation at 375 px (phone), 768 px (tablet) and 1440 px (desktop) on a 2× (Retina) screen:
 * no sideways scrolling of the page, a sharp canvas (backing store = CSS size × device pixel ratio),
 * something drawn, no errors and no NaN; then the window is resized while the simulation runs and
 * the canvas must follow.
 */
test.use({ deviceScaleFactor: 2 });
test.describe.configure({ mode: 'parallel' });

const SIZES = [
  { w: 375, h: 812 },
  { w: 768, h: 1024 },
  { w: 1440, h: 900 },
];

async function state(page: Page) {
  return page.evaluate(() => {
    const c = document.querySelector('.stage canvas') as HTMLCanvasElement;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = c.getBoundingClientRect();
    const { data } = c.getContext('2d')!.getImageData(0, 0, c.width, c.height);
    const seen = new Set<number>();
    for (let i = 0; i < data.length; i += 4 * 307) seen.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
    const txt = [...document.querySelectorAll('.ro, .transport .time')].map((e) => (e as HTMLElement).innerText).join(' ');
    return {
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      cssW: r.width,
      cssH: r.height,
      bw: c.width,
      bh: c.height,
      dpr,
      colours: seen.size,
      nan: txt.match(/\bNaN\b|Infinity|undefined|\bnull\b/)?.[0] ?? null,
    };
  });
}

function verify(s: Awaited<ReturnType<typeof state>>, what: string, problems: string[]) {
  if (s.overflow > 1) problems.push(`${what}: page scrolls sideways by ${s.overflow} px`);
  if (s.cssW < 50 || s.cssH < 50) problems.push(`${what}: canvas too small (${s.cssW}×${s.cssH})`);
  if (Math.abs(s.bw - Math.round(s.cssW * s.dpr)) > 2 || Math.abs(s.bh - Math.round(s.cssH * s.dpr)) > 2)
    problems.push(`${what}: blurry canvas: backing ${s.bw}×${s.bh} for ${s.cssW.toFixed(0)}×${s.cssH.toFixed(0)} CSS px at dpr ${s.dpr}`);
  if (s.colours < 2) problems.push(`${what}: canvas blank`);
  if (s.nan) problems.push(`${what}: shows ${s.nan}`);
}

for (const id of READY) {
  test(`responsive ${id}`, async ({ page }, info) => {
    test.skip(!process.env.AUDIT, 'long audit: run with npm run test:audit');
    test.skip(info.project.name !== 'desktop');
    const problems: string[] = [];
    page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error' || (m.type() === 'warning' && !m.text().includes('willReadFrequently'))) problems.push(`console.${m.type()}: ${m.text()}`);
    });
    for (const { w, h } of SIZES) {
      await page.setViewportSize({ width: w, height: h });
      await page.goto(`/#/sim/${id}`);
      await expect(page.locator('.stage canvas')).toBeVisible();
      await page.waitForTimeout(500);
      verify(await state(page), `${w} px`, problems);
    }
    // resize while running (and back), the canvas must follow and be redrawn
    for (const { w, h } of [SIZES[0], SIZES[1], SIZES[2], { w: 1000, h: 700 }]) {
      await page.setViewportSize({ width: w, height: h });
      await page.waitForTimeout(300);
      verify(await state(page), `resized to ${w} px`, problems);
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });
}

// the mobile lab pages: same checks (no sideways scrolling, no errors) at every width
test('responsive mobile lab pages', async ({ page }, info) => {
  test.skip(!process.env.AUDIT, 'long audit: run with npm run test:audit');
  test.skip(info.project.name !== 'desktop');
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`console.error: ${m.text()}`);
  });
  await page.goto('/#/lab');
  const links = await page.locator('a.card').evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).getAttribute('href')!));
  for (const { w, h } of SIZES)
    for (const href of ['#/lab', ...links]) {
      await page.setViewportSize({ width: w, height: h });
      await page.goto(`/${href}`);
      await page.waitForTimeout(150);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (over > 1) problems.push(`${href} at ${w} px scrolls sideways by ${over} px`);
    }
  expect(problems, problems.join('\n')).toEqual([]);
});
