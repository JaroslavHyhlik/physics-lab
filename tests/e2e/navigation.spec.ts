import { test, expect, type Page } from '@playwright/test';
import { READY } from './ready';

/**
 * Navigation and the site as a whole: every link works, every file loads, and moving between
 * simulations leaves no animation loops or Web Workers running in the background.
 */

async function instrument(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __raf: number; __workers: number };
    w.__raf = 0;
    w.__workers = 0;
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => {
      w.__raf++;
      return raf(cb);
    };
    const W = window.Worker;
    window.Worker = class extends W {
      constructor(...a: ConstructorParameters<typeof Worker>) {
        super(...a);
        w.__workers++;
      }
      override terminate() {
        w.__workers--;
        super.terminate();
      }
    } as typeof Worker;
  });
}

/** requestAnimationFrame calls per second, measured over one second */
async function rafRate(page: Page) {
  const a = await page.evaluate(() => (window as unknown as { __raf: number }).__raf);
  await page.waitForTimeout(1000);
  const b = await page.evaluate(() => (window as unknown as { __raf: number }).__raf);
  return b - a;
}

test('every link on the home page works and no file fails to load', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  test.setTimeout(300_000);
  const failed: string[] = [];
  page.on('response', (r) => {
    if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
  });
  page.on('requestfailed', (r) => {
    // a download that is cancelled when we navigate away is not a failure
    if (!/ERR_ABORTED/.test(r.failure()?.errorText ?? '')) failed.push(`failed ${r.url()} ${r.failure()?.errorText}`);
  });
  await page.goto('/');
  const hrefs = await page.locator('a[href]').evaluateAll((as) => [...new Set(as.map((a) => (a as HTMLAnchorElement).getAttribute('href')!))]);
  expect(hrefs.length).toBeGreaterThan(READY.length);
  for (const href of hrefs) {
    if (/^https?:/.test(href)) {
      const r = await page.request.get(href);
      expect(r.status(), href).toBeLessThan(400);
      continue;
    }
    await page.goto(`/${href}`);
    if (href.startsWith('#/sim/')) await expect(page.locator('.stage canvas'), href).toBeVisible();
    else await expect(page.locator('h1').first(), href).toBeVisible();
  }
  // a wrong address falls back to the home page instead of a blank page
  await page.goto('/#/sim/does-not-exist');
  await expect(page.locator('body')).not.toBeEmpty();
  await page.goto('/#/nonsense');
  await expect(page.locator('h1').first()).toBeVisible();
  // fonts loaded
  expect(await page.evaluate(async () => (await document.fonts.ready, [...document.fonts].filter((f) => f.status === 'error').length))).toBe(0);
  expect(failed).toEqual([]);
});

test('switching between simulations leaves no animation loops or workers running', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  test.setTimeout(240_000);
  await instrument(page);
  await page.goto('/');
  await page.waitForTimeout(500);
  const idle = await rafRate(page);
  // one simulation alone: its loop rate (≈ display refresh rate)
  await page.goto('/#/sim/c1-pendulum');
  await expect(page.locator('.stage canvas')).toBeVisible();
  await page.waitForTimeout(500);
  const one = await rafRate(page);
  // hop around: back and forth through the app, including worker-based simulations
  const route = ['b3-gas-container', 'c1-pendulum', 'b1-particle-model', 'a1-projectile', 'd1-n-body', 'c3-ripple-tank', 'c1-pendulum'];
  for (let k = 0; k < 2; k++)
    for (const id of route) {
      await page.goto(`/#/sim/${id}`);
      await page.waitForTimeout(400);
      await page.goBack();
      await page.waitForTimeout(200);
      await page.goForward();
      await page.waitForTimeout(200);
    }
  await page.goto('/#/sim/c1-pendulum');
  await page.waitForTimeout(800);
  const after = await rafRate(page);
  // the same simulation must not run faster (doubled loops) after all that navigation
  expect(after, `rAF calls/s: home ${idle}, one sim ${one}, after navigation ${after}`).toBeLessThan(one * 1.3 + 5);
  await page.goto('/#/');
  await page.waitForTimeout(800);
  const home = await rafRate(page);
  expect(home, `rAF calls/s on the home page after navigation: ${home} (fresh home page: ${idle})`).toBeLessThanOrEqual(idle + 5);
  const workers = await page.evaluate(() => (window as unknown as { __workers: number }).__workers);
  expect(workers, 'Web Workers still alive on the home page').toBe(0);
});

test('the simulation time runs at the right speed after navigation (no doubled loop)', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  await page.goto('/#/sim/c1-pendulum');
  for (const id of ['a1-projectile', 'c1-pendulum', 'd1-orbits', 'c1-pendulum']) {
    await page.goto(`/#/sim/${id}`);
    await page.waitForTimeout(300);
  }
  await page.getByRole('button', { name: /^Reset/ }).click();
  const t = async () => parseFloat((await page.locator('.transport .time').innerText()).replace(/[^\d.]/g, ''));
  const t0 = await t();
  const w0 = Date.now();
  await page.waitForTimeout(2000);
  const rate = ((await t()) - t0) / ((Date.now() - w0) / 1000);
  expect(rate, `simulated seconds per real second: ${rate.toFixed(2)}`).toBeGreaterThan(0.85);
  expect(rate).toBeLessThan(1.15);
});
