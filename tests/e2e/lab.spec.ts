import { test, expect, type Page } from '@playwright/test';

/**
 * Mobile lab with simulated sensors: DeviceMotionEvent / DeviceOrientationEvent are fired at 60 Hz
 * with known signals, the microphone is replaced by a generated tone, and GPS positions are moved.
 * Also: refused permissions and devices without sensors must give a clear message, never a crash.
 */

type Mock = {
  motion?: 'still' | 'pendulum' | 'spin' | 'spring' | 'turn';
  orientation?: boolean;
  permission?: 'granted' | 'denied';
  noMotion?: boolean;
  silentMotion?: boolean;
  mic?: 'tone' | 'clicks' | 'denied';
};

async function mock(page: Page, m: Mock) {
  await page.addInitScript((m: Mock) => {
    const w = window as unknown as Record<string, unknown>;
    if (m.noMotion) {
      delete w.DeviceMotionEvent;
      delete w.DeviceOrientationEvent;
    } else if (m.permission) {
      (window.DeviceMotionEvent as unknown as { requestPermission: () => Promise<string> }).requestPermission = async () => m.permission!;
      (window.DeviceOrientationEvent as unknown as { requestPermission: () => Promise<string> }).requestPermission = async () => m.permission!;
    }
    const start = performance.now();
    const fire = () => {
      const t = (performance.now() - start) / 1000;
      if (m.motion && !m.silentMotion) {
        let g = { x: 0, y: 0, z: 9.81 };
        let r = { alpha: 0, beta: 0, gamma: 0 };
        const deg = 180 / Math.PI;
        if (m.motion === 'still') g = { x: 0.02 * Math.sin(t * 50), y: 0, z: 9.81 + 0.03 * Math.sin(t * 37) };
        if (m.motion === 'pendulum') r = { alpha: 0, beta: 0.6 * Math.sin((2 * Math.PI * t) / 1.419) * deg, gamma: 0 };
        if (m.motion === 'turn') r = { alpha: (Math.PI / 5) * deg, beta: 0, gamma: 0 };
        if (m.motion === 'spin') {
          // ω rises slowly from 2 to 20 rad/s; a = ω²r with r = 0.10 m
          const om = 2 + ((t * 3) % 18);
          r = { alpha: om * deg, beta: 0, gamma: 0 };
          g = { x: om * om * 0.1, y: 0, z: 9.81 };
        }
        if (m.motion === 'spring') g = { x: 0, y: 0, z: 9.81 + 2 * Math.sin((2 * Math.PI * t) / 0.5) };
        const e = new Event('devicemotion');
        Object.defineProperties(e, {
          acceleration: { value: { x: g.x, y: g.y, z: g.z - 9.81 } },
          accelerationIncludingGravity: { value: g },
          rotationRate: { value: r },
          interval: { value: 1000 / 60 },
        });
        window.dispatchEvent(e);
      }
      if (m.orientation) {
        const e = new Event('deviceorientation');
        Object.defineProperties(e, {
          alpha: { value: 30 },
          beta: { value: 20 },
          gamma: { value: -5 },
          absolute: { value: false },
          webkitCompassHeading: { value: 330 },
        });
        window.dispatchEvent(e);
      }
    };
    if (m.motion || m.orientation) setInterval(fire, 1000 / 60);
    if (m.mic) {
      navigator.mediaDevices.getUserMedia = async () => {
        if (m.mic === 'denied') throw new DOMException('Permission denied', 'NotAllowedError');
        const ctx = new AudioContext();
        const dest = ctx.createMediaStreamDestination();
        if (m.mic === 'tone') {
          const o = ctx.createOscillator();
          o.frequency.value = 440;
          const gn = ctx.createGain();
          gn.gain.value = 0.5;
          o.connect(gn).connect(dest);
          o.start();
        } else {
          // two sharp clicks 0.25 s apart, repeating every second
          const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
          const d = buf.getChannelData(0);
          for (const at of [0.1, 0.35]) for (let i = 0; i < 400; i++) d[Math.round(at * ctx.sampleRate) + i] = 0.9 * Math.exp(-i / 60) * (i % 2 ? 1 : -1);
          const s = ctx.createBufferSource();
          s.buffer = buf;
          s.loop = true;
          s.connect(dest);
          s.start();
        }
        return dest.stream;
      };
    }
  }, m);
}

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  return errors;
}

const ro = (page: Page) => page.locator('.ro').innerText();
const value = async (page: Page, label: RegExp) => {
  const row = page.locator('.ro .row', { hasText: label }).first();
  const t = (await row.locator('dd').innerText()).replace('−', '-');
  return parseFloat(t.replace(/[^\d.eE+-]/g, ' ').trim().split(/\s+/)[0]);
};

test('lab home lists every experiment and each page opens without errors', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/#/lab');
  await expect(page.locator('h1')).toHaveText('Mobile Lab');
  const links = await page.locator('a.card').evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).getAttribute('href')!));
  expect(links.length).toBe(13);
  for (const href of links) {
    await page.goto(`/${href}`);
    await expect(page.locator('.lab h1')).toBeVisible();
    await expect(page.locator('button.go')).toBeVisible();
  }
  await page.goto('/#/lab/nonsense');
  await expect(page.getByRole('alert')).toContainText('does not exist');
  expect(errors).toEqual([]);
});

test('measure g: a phone lying still gives 9.81 ± a small uncertainty at the measured 60 Hz', async ({ page }) => {
  const errors = watchErrors(page);
  await mock(page, { motion: 'still', permission: 'granted' });
  await page.goto('/#/lab/g');
  await page.locator('button.go').click();
  await page.waitForTimeout(2500);
  await page.locator('button.go').click();
  expect(await value(page, /g = mean/)).toBeCloseTo(9.81, 2);
  const rate = await value(page, /sample rate/);
  expect(rate).toBeGreaterThan(50);
  expect(rate).toBeLessThan(70);
  expect(await ro(page)).not.toMatch(/NaN|Infinity|undefined/);
  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: /Download the data/ }).click();
  expect((await dl).suggestedFilename()).toMatch(/^lab-g_.*\.csv$/);
  expect(errors).toEqual([]);
});

test('pendulum: the period of a 1.419 s swing is found and g = 4π²L/T² ≈ 9.8 for L = 0.5 m', async ({ page }) => {
  await mock(page, { motion: 'pendulum', permission: 'granted' });
  await page.goto('/#/lab/pendulum');
  await page.locator('button.go').click();
  await page.waitForTimeout(7000);
  const T = await value(page, /period T/);
  expect(Math.abs(T - 1.419)).toBeLessThan(0.02);
  expect(await value(page, /g = 4π/)).toBeCloseTo(9.8, 0);
  await expect(page.getByRole('link', { name: /pendulum simulation/ })).toHaveAttribute('href', /l=0\.5/);
});

test('gyroscope: turning at π/5 rad s⁻¹ for a few seconds gives the integrated angle', async ({ page }) => {
  await mock(page, { motion: 'turn', permission: 'granted' });
  await page.goto('/#/lab/gyroscope');
  await page.locator('button.go').click();
  await page.waitForTimeout(3000);
  await page.locator('button.go').click();
  const th = await value(page, /angle turned/);
  expect(th).toBeGreaterThan(1.2); // ≈ 0.63 rad s⁻¹ × ~2.5 s
  expect(await value(page, /ωz/)).toBeCloseTo(Math.PI / 5, 3);
});

test('centripetal: a against ω² gives the radius 10 cm', async ({ page }) => {
  await mock(page, { motion: 'spin', permission: 'granted' });
  await page.goto('/#/lab/centripetal');
  await page.locator('button.go').click();
  await page.waitForTimeout(4000);
  expect(await value(page, /radius r/)).toBeCloseTo(10, 0);
});

test('spring: period 0.5 s with m = 0.2 kg gives k ≈ 31.6 N m⁻¹', async ({ page }) => {
  await mock(page, { motion: 'spring', permission: 'granted' });
  await page.goto('/#/lab/spring');
  await page.locator('button.go').click();
  await page.waitForTimeout(4000);
  expect(Math.abs((await value(page, /k = 4π/)) - 31.6)).toBeLessThan(1);
  await expect(page.getByRole('link', { name: /mass–spring simulation/ })).toBeVisible();
});

test('accelerometer and tilt/compass show live values', async ({ page }) => {
  const errors = watchErrors(page);
  await mock(page, { motion: 'still', orientation: true, permission: 'granted' });
  await page.goto('/#/lab/accelerometer');
  await page.locator('button.go').click();
  await page.waitForTimeout(800);
  expect(await value(page, /\|a\|/)).toBeCloseTo(9.81, 1);
  await page.getByText('Include gravity').click();
  await page.waitForTimeout(400);
  expect(await ro(page)).not.toMatch(/NaN|undefined/);
  await page.goto('/#/lab/orientation');
  await page.locator('button.go').click();
  await page.waitForTimeout(600);
  expect(await value(page, /front–back/)).toBe(20);
  expect(await value(page, /compass heading/)).toBe(330);
  expect(errors).toEqual([]);
});

test('refused permission and devices without sensors give a clear message, not a crash', async ({ page }) => {
  const errors = watchErrors(page);
  await mock(page, { motion: 'still', permission: 'denied' });
  await page.goto('/#/lab/accelerometer');
  await page.locator('button.go').click();
  await expect(page.getByRole('alert')).toContainText('refused');
  expect(errors).toEqual([]);
});

test('no motion sensor at all (laptop) and a sensor that never sends data', async ({ browser }) => {
  for (const m of [{ noMotion: true }, { motion: 'still' as const, silentMotion: true }]) {
    const page = await browser.newPage();
    const errors = watchErrors(page);
    await mock(page, m);
    await page.goto('http://localhost:4173/#/lab/g');
    await page.locator('button.go').click();
    await expect(page.getByRole('alert')).toContainText(/no motion sensor|No data arrives|has none/, { timeout: 5000 });
    expect(errors).toEqual([]);
    await page.close();
  }
});

test('microphone: a 440 Hz tone is found in the spectrum; oscilloscope and level work', async ({ page }) => {
  const errors = watchErrors(page);
  await mock(page, { mic: 'tone' });
  await page.goto('/#/lab/spectrum');
  await page.locator('button.go').click();
  await page.waitForTimeout(1500);
  expect(Math.abs((await value(page, /strongest frequency/)) - 440)).toBeLessThan(2);
  await page.goto('/#/lab/oscilloscope');
  await page.locator('button.go').click();
  await page.waitForTimeout(800);
  const lvl = await value(page, /level/);
  expect(lvl).toBeGreaterThan(-15);
  expect(lvl).toBeLessThan(0);
  expect(errors).toEqual([]);
});

test('acoustic stopwatch: two clicks 0.25 s apart', async ({ page }) => {
  await mock(page, { mic: 'clicks' });
  await page.goto('/#/lab/acoustic-stopwatch');
  await page.locator('button.go').click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /Arm/ }).click();
  await page.waitForTimeout(1600);
  const dt = await value(page, /time between/);
  // the first click heard after arming may be either one of the pair (0.25 s or 0.75 s gap)
  expect(Math.min(Math.abs(dt - 0.25), Math.abs(dt - 0.75))).toBeLessThan(0.003);
});

test('microphone refused gives an explanation', async ({ page }) => {
  await mock(page, { mic: 'denied' });
  await page.goto('/#/lab/spectrum');
  await page.locator('button.go').click();
  await expect(page.getByRole('alert')).toContainText('refused');
});

test('tone generator plays and shows the beat frequency', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/#/lab/tone');
  await page.locator('button.go').click();
  await page.locator('label.toggle', { hasText: 'Second tone' }).click();
  await expect(page.locator('.ro')).toContainText('beat frequency');
  expect(await value(page, /beat frequency/)).toBeCloseTo(2, 5);
  await page.locator('button.go').click();
  expect(errors).toEqual([]);
});

test('GPS: moving 2 m s⁻¹ northwards; refused location gives a message', async ({ browser }) => {
  const ctx = await browser.newContext({ geolocation: { latitude: 50, longitude: 14, accuracy: 5 }, permissions: ['geolocation'] });
  const page = await ctx.newPage();
  const errors = watchErrors(page);
  await page.goto('http://localhost:4173/#/lab/gps');
  await page.locator('button.go').click();
  for (let k = 1; k <= 6; k++) {
    await page.waitForTimeout(1000);
    await ctx.setGeolocation({ latitude: 50 + (k * 2) / 111195, longitude: 14, accuracy: 5 });
  }
  await page.waitForTimeout(1000);
  const d = await value(page, /distance travelled/);
  expect(Math.abs(d - 12)).toBeLessThan(1);
  expect(errors).toEqual([]);
  await ctx.close();
  const ctx2 = await browser.newContext();
  const p2 = await ctx2.newPage();
  await p2.goto('http://localhost:4173/#/lab/gps');
  await p2.locator('button.go').click();
  await expect(p2.getByRole('alert')).toContainText(/refused|not available|did not arrive/, { timeout: 25000 });
  await ctx2.close();
});

test('sensor check measures the motion rate', async ({ page }) => {
  await mock(page, { motion: 'still', orientation: true, permission: 'granted' });
  await page.goto('/#/lab/check');
  await page.locator('button.go').click();
  await page.waitForTimeout(1500);
  const hz = await value(page, /motion readings per second/);
  expect(hz).toBeGreaterThan(50);
  expect(hz).toBeLessThan(70);
});
