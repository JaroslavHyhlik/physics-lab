import { test, expect, type Page } from '@playwright/test';

const READY = ['a1-car-acceleration', 'a1-projectile', 'a1-motion-graphs', 'a2-inclined-plane', 'a2-collisions-1d', 'a2-collisions-2d', 'a2-banked-curve', 'a2-drag-buoyancy', 'a2-newton-lift', 'a2-rocket', 'a2-car-drift', 'a3-spring-launcher', 'a3-work-power', 'a3-roller-coaster', 'a4-torque-equilibrium', 'a4-rolling-race', 'a4-angular-momentum', 'a4-rotational-dynamics', 'a5-galilean', 'a5-spacetime-diagram', 'a5-time-dilation', 'a5-length-contraction', 'a5-lorentz', 'b1-particle-model', 'b1-heating-curve', 'b1-black-body', 'b1-calorimetry', 'b1-conduction', 'b2-energy-balance', 'b2-greenhouse-photons', 'b3-gas-container', 'b3-maxwell-boltzmann', 'b3-gas-laws', 'b4-pv-processes', 'b4-heat-engines', 'b4-entropy', 'b5-internal-resistance', 'b5-resistivity', 'b5-iv-characteristics', 'b5-circuit-kit', 'c1-pendulum', 'c1-mass-spring', 'c1-phase', 'c2-wave-types', 'c2-wave-string', 'c3-refraction', 'c3-ripple-tank', 'c3-double-slit', 'c3-diffraction', 'c4-string-standing', 'c4-pipes', 'c4-resonance', 'c5-doppler', 'c5-shock-waves', 'c5-redshift', 'd1-orbits', 'd1-escape-velocity', 'd1-grav-potential', 'd1-n-body', 'd2-charges-and-fields', 'd2-millikan', 'd2-magnetic-fields'];

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

/** Number of distinct colours in a sample of canvas pixels (blank canvas → 1). */
async function canvasColours(page: Page): Promise<number> {
  return page.evaluate(() => {
    const c = document.querySelector('.stage canvas') as HTMLCanvasElement | null;
    if (!c) return 0;
    const ctx = c.getContext('2d')!;
    const { data } = ctx.getImageData(0, 0, c.width, c.height);
    const seen = new Set<number>();
    for (let i = 0; i < data.length; i += 4 * 97) seen.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
    return seen.size;
  });
}

test('home page lists all topics and filters by search', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('play with');
  for (const t of ['Space, time and motion', 'Wave behaviour', 'Fields', 'Nuclear and quantum physics']) {
    await expect(page.locator('h2', { hasText: t })).toBeVisible();
  }
  await expect(page.locator('a.card')).toHaveCount(READY.length);
  await page.getByLabel('Search simulations').fill('snell');
  await expect(page.locator('.card')).toHaveCount(1);
  await page.getByLabel('Search simulations').fill('C.1');
  await expect(page.locator('.card').first()).toContainText('Pendulum');
  expect(errors).toEqual([]);
});

for (const id of READY) {
  test(`${id}: renders, runs and shows its info`, async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(`/#/sim/${id}`);
    await expect(page.locator('.stage canvas')).toBeVisible();
    await page.waitForTimeout(800);
    expect(await canvasColours(page)).toBeGreaterThan(4);

    const step = page.getByRole('button', { name: /Step one frame/ });
    if (await step.count()) {
      const time = page.locator('.transport .time');
      for (let i = 0; i < 10; i++) await step.click();
      await expect(time).not.toHaveText(/t = 0\.00 s/);
    }

    await page.getByRole('tab', { name: 'Info' }).click();
    await expect(page.getByText('Model assumptions')).toBeVisible();
    await expect(page.locator('.katex').first()).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test('charges: dragging a charge changes the probe reading', async ({ page }, info) => {
  test.skip(info.project.name === 'mobile', 'mouse drag');
  await page.goto('/#/sim/d2-charges-and-fields?probeE=1');
  await page.waitForTimeout(500);
  const reading = page.locator('.ro dd').first();
  const before = await reading.textContent();
  const canvas = page.locator('.stage canvas');
  const box = (await canvas.boundingBox())!;
  // positive charge of the default dipole is at x = −0.8 m: find it by scanning the reading change
  await page.mouse.move(box.x + box.width * 0.333, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.3, { steps: 8 });
  await page.mouse.up();
  await expect(reading).not.toHaveText(before ?? '');
});
