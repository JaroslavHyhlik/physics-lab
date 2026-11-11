import { test, expect, type Page } from '@playwright/test';
import { READY } from './ready';

/**
 * For every ready simulation: move every visible slider to its minimum, maximum and middle,
 * and apply every preset (then push the sliders of that preset to their ends). After each
 * change the page must have no errors, the readouts must not show NaN/Infinity and the
 * canvas must still be drawn.
 */
test.describe.configure({ mode: 'parallel' });

async function sliders(page: Page) {
  return page.locator('input[type="range"]:visible');
}

async function setRange(page: Page, index: number, which: 'min' | 'max' | 'mid') {
  await (await sliders(page)).nth(index).evaluate((el, w) => {
    const input = el as HTMLInputElement;
    const lo = +input.min;
    const hi = +input.max;
    const st = +input.step || 1;
    const v = w === 'min' ? lo : w === 'max' ? hi : lo + Math.round((hi - lo) / 2 / st) * st;
    input.value = String(v);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, which);
}

async function healthy(page: Page, errors: string[], what: string) {
  await page.waitForTimeout(180);
  expect(errors, `${what}: page errors`).toEqual([]);
  const ro = await page.locator('.ro').allInnerTexts();
  const bad = ro.join(' ').match(/NaN|Infinity|undefined|null/);
  expect(bad, `${what}: readouts show “${bad?.[0]}” in: ${ro.join(' | ').slice(0, 300)}`).toBeNull();
  const colours = await page.evaluate(() => {
    const c = document.querySelector('.stage canvas') as HTMLCanvasElement | null;
    if (!c) return 0;
    const { data } = c.getContext('2d')!.getImageData(0, 0, c.width, c.height);
    const seen = new Set<number>();
    for (let i = 0; i < data.length; i += 4 * 101) seen.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
    return seen.size;
  });
  expect(colours, `${what}: canvas is blank`).toBeGreaterThan(1);
}

for (const id of READY) {
  test(`${id}: all sliders and presets keep the simulation working`, async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop');
    test.setTimeout(180_000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await page.goto(`/#/sim/${id}`);
    await expect(page.locator('.stage canvas')).toBeVisible();
    await page.waitForTimeout(400);
    await healthy(page, errors, 'start');

    const n = await (await sliders(page)).count();
    for (let i = 0; i < n; i++) {
      for (const w of ['min', 'max', 'mid'] as const) {
        if (i >= (await (await sliders(page)).count())) break;
        await setRange(page, i, w);
        await healthy(page, errors, `slider ${i} → ${w}`);
      }
    }

    const select = page.locator('.preset select');
    if (await select.count()) {
      const values = await select.locator('option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value).filter(Boolean));
      for (const v of values) {
        await select.selectOption(v);
        await healthy(page, errors, `preset ${v}`);
        const m = await (await sliders(page)).count();
        for (let i = 0; i < m; i++) {
          for (const w of ['min', 'max'] as const) {
            if (i >= (await (await sliders(page)).count())) break;
            await setRange(page, i, w);
            await healthy(page, errors, `preset ${v}, slider ${i} → ${w}`);
          }
        }
      }
    }
  });
}
