import { test, expect, type Page } from '@playwright/test';

/** Frames rendered by the browser during `ms` milliseconds. */
async function framesIn(page: Page, ms: number): Promise<number> {
  return page.evaluate(
    (ms) =>
      new Promise<number>((resolve) => {
        let n = 0;
        const t0 = performance.now();
        const f = () => {
          n++;
          if (performance.now() - t0 < ms) requestAnimationFrame(f);
          else resolve(n);
        };
        requestAnimationFrame(f);
      }),
    ms,
  );
}

const simTime = async (page: Page) =>
  parseFloat(((await page.locator('.transport .time').textContent()) ?? '').replace(/[^0-9.]/g, ''));

test('pendulum keeps running smoothly while and after a slider is dragged', async ({ page }, info) => {
  test.skip(info.project.name === 'mobile', 'mouse drag');
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/#/sim/c1-pendulum');
  await page.waitForTimeout(600);

  const slider = page.locator('input[type=range]').first(); // length l
  const box = (await slider.boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width * 0.1, y);
  await page.mouse.down();
  for (let i = 0; i <= 20; i++) await page.mouse.move(box.x + box.width * (0.1 + 0.02 * i), y);
  await page.mouse.up();

  const t1 = await simTime(page);
  const fps = (await framesIn(page, 1000)) / 1;
  const t2 = await simTime(page);
  expect(errors).toEqual([]);
  // the test guards against freezing; a busy machine may render slower than 60 fps
  expect(fps).toBeGreaterThan(10);
  expect(t2 - t1).toBeGreaterThan(0.5);
});

test('car keeps running after the mass slider is changed mid-run', async ({ page }, info) => {
  test.skip(info.project.name === 'mobile', 'mouse drag');
  await page.goto('/#/sim/a1-car-acceleration');
  await page.getByRole('button', { name: 'Play (Space)' }).click();
  await page.waitForTimeout(400);
  const slider = page.locator('input[type=range]').first(); // mass m
  const box = (await slider.boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.3, box.y + box.height / 2);
  const t1 = await simTime(page);
  await page.waitForTimeout(1000);
  expect((await simTime(page)) - t1).toBeGreaterThan(0.5);
});
