/**
 * Mobile lab: access to the phone's sensors in the browser.
 *
 * - Feature detection only (never user-agent sniffing).
 * - iOS needs DeviceMotionEvent.requestPermission() / DeviceOrientationEvent.requestPermission(),
 *   called from a tap, and HTTPS.
 * - Timestamps come from event.timeStamp (or performance.now()) in seconds; the real sample rate is
 *   measured, because browsers do not guarantee one.
 * - Rotation rates arrive in degrees per second and are converted to rad s⁻¹.
 */

export interface MotionSample {
  t: number; // s
  ax: number; // m s⁻² without gravity (NaN if the device does not provide it)
  ay: number;
  az: number;
  gx: number; // m s⁻² including gravity
  gy: number;
  gz: number;
  wx: number; // rad s⁻¹ (rotation rate about x: beta, y: gamma, z: alpha)
  wy: number;
  wz: number;
}

export interface OrientationSample {
  t: number;
  alpha: number; // ° about z
  beta: number; // ° front–back tilt
  gamma: number; // ° left–right tilt
  heading: number; // ° compass heading clockwise from north (NaN if unknown)
  absolute: boolean;
}

export interface GpsSample {
  t: number; // s since the page started
  lat: number;
  lon: number;
  alt: number; // m (NaN if unknown)
  accuracy: number; // m
  speed: number; // m s⁻¹ (NaN if unknown)
}

export type Permission = 'granted' | 'denied' | 'not-needed' | 'unsupported';

type WithPermission = { requestPermission?: () => Promise<'granted' | 'denied'> };

export function support() {
  const w = typeof window !== 'undefined' ? window : (undefined as unknown as Window);
  return {
    secure: !!w?.isSecureContext,
    motion: !!w && 'DeviceMotionEvent' in w,
    orientation: !!w && 'DeviceOrientationEvent' in w,
    mic: !!w?.navigator?.mediaDevices?.getUserMedia,
    gps: !!w && 'geolocation' in w.navigator,
    wakeLock: !!w && 'wakeLock' in w.navigator,
    audio: !!w && ('AudioContext' in w || 'webkitAudioContext' in w),
    share: !!w?.navigator?.share,
    /** iOS-style permission prompt is needed before motion data flows */
    needsPermission: !!w && typeof ((w as unknown as { DeviceMotionEvent?: WithPermission }).DeviceMotionEvent)?.requestPermission === 'function',
  };
}

/** Ask for motion and orientation access (must be called from a tap on iOS). */
export async function requestMotionPermission(): Promise<Permission> {
  const s = support();
  if (!s.motion && !s.orientation) return 'unsupported';
  const DM = window.DeviceMotionEvent as unknown as WithPermission | undefined;
  const DO = window.DeviceOrientationEvent as unknown as WithPermission | undefined;
  if (typeof DM?.requestPermission !== 'function') return 'not-needed';
  try {
    const a = await DM.requestPermission();
    if (typeof DO?.requestPermission === 'function') await DO.requestPermission().catch(() => 'denied');
    return a === 'granted' ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}

const DEG = Math.PI / 180;
const num = (v: number | null | undefined) => (typeof v === 'number' && Number.isFinite(v) ? v : NaN);
const stamp = (e: Event) => (e.timeStamp > 0 ? e.timeStamp : performance.now()) / 1000;

export function listenMotion(cb: (s: MotionSample) => void): () => void {
  const h = (e: DeviceMotionEvent) => {
    const a = e.acceleration;
    const g = e.accelerationIncludingGravity;
    const r = e.rotationRate;
    cb({
      t: stamp(e),
      ax: num(a?.x),
      ay: num(a?.y),
      az: num(a?.z),
      gx: num(g?.x),
      gy: num(g?.y),
      gz: num(g?.z),
      wx: num(r?.beta) * DEG,
      wy: num(r?.gamma) * DEG,
      wz: num(r?.alpha) * DEG,
    });
  };
  window.addEventListener('devicemotion', h);
  return () => window.removeEventListener('devicemotion', h);
}

export function listenOrientation(cb: (s: OrientationSample) => void): () => void {
  const h = (e: DeviceOrientationEvent) => {
    const webkit = (e as unknown as { webkitCompassHeading?: number }).webkitCompassHeading;
    const alpha = num(e.alpha);
    const heading = Number.isFinite(webkit) ? (webkit as number) : e.absolute && Number.isFinite(alpha) ? (360 - alpha) % 360 : NaN;
    cb({ t: stamp(e), alpha, beta: num(e.beta), gamma: num(e.gamma), heading, absolute: !!e.absolute || Number.isFinite(webkit) });
  };
  window.addEventListener('deviceorientation', h);
  return () => window.removeEventListener('deviceorientation', h);
}

export interface Mic {
  ctx: AudioContext;
  source: MediaStreamAudioSourceNode;
  analyser: AnalyserNode;
  sampleRate: number;
  stop: () => void;
}

/**
 * Open the microphone with all automatic processing switched off (raw signal).
 * Must be called straight from a tap: the AudioContext is created and resumed before anything is
 * awaited, because iPhone keeps audio that is started later (after the permission prompt) silent.
 */
export async function openMic(fftSize = 4096): Promise<Mic> {
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AC();
  const resumed = ctx.resume().catch(() => {});
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
  } catch (e) {
    void ctx.close();
    throw e;
  }
  await resumed;
  if (ctx.state !== 'running') await ctx.resume().catch(() => {});
  const src = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = fftSize;
  analyser.smoothingTimeConstant = 0;
  src.connect(analyser);
  return {
    ctx,
    source: src,
    analyser,
    sampleRate: ctx.sampleRate,
    stop: () => {
      stream.getTracks().forEach((t) => t.stop());
      void ctx.close();
    },
  };
}

/** Plain-language message for a failed getUserMedia / geolocation call */
export function explainError(e: unknown, what: 'microphone' | 'location'): string {
  const name = (e as { name?: string; code?: number })?.name ?? '';
  const code = (e as { code?: number })?.code;
  if (name === 'NotAllowedError' || name === 'SecurityError' || code === 1)
    return `Access to the ${what} was refused. Allow it in the browser’s site settings (on iPhone: Settings → Safari → ${what === 'microphone' ? 'Microphone' : 'Location'}), then try again.`;
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return `This device has no ${what}.`;
  if (code === 2) return 'The position is not available right now. Go outside, away from tall buildings.';
  if (code === 3) return 'The position did not arrive in time. Try again outside.';
  if (!window.isSecureContext) return `The ${what} only works on a secure (https://) page.`;
  return `The ${what} could not be started (${name || String(e)}).`;
}

const T0 = typeof performance !== 'undefined' ? performance.now() : 0;

export function watchGps(cb: (s: GpsSample) => void, onError: (msg: string) => void): () => void {
  const id = navigator.geolocation.watchPosition(
    (p) =>
      cb({
        t: (performance.now() - T0) / 1000,
        lat: p.coords.latitude,
        lon: p.coords.longitude,
        alt: num(p.coords.altitude),
        accuracy: p.coords.accuracy,
        speed: num(p.coords.speed),
      }),
    (e) => onError(explainError(e, 'location')),
    { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
  );
  return () => navigator.geolocation.clearWatch(id);
}

/** Events per second over the last second */
export class RateMeter {
  private times: number[] = [];
  tick(now = performance.now()) {
    this.times.push(now);
    while (this.times.length && now - this.times[0] > 1000) this.times.shift();
  }
  get hz(): number {
    if (this.times.length < 2) return 0;
    const span = (this.times[this.times.length - 1] - this.times[0]) / 1000;
    return span > 0 ? (this.times.length - 1) / span : 0;
  }
  reset() {
    this.times = [];
  }
}

/**
 * Keep the screen on while measuring, without waiting for the browser's answer (it can take a
 * while or never come). Returns a release function that also works if the lock arrives later.
 */
export function holdScreenOn(): () => void {
  let release: (() => void) | null = null;
  let done = false;
  void keepScreenOn().then((r) => {
    if (done) r();
    else release = r;
  });
  return () => {
    done = true;
    release?.();
  };
}

/** Keep the screen on while measuring; returns a release function (no-op where unsupported). */
export async function keepScreenOn(): Promise<() => void> {
  try {
    const nav = navigator as unknown as { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
    if (!nav.wakeLock) return () => {};
    const lock = await nav.wakeLock.request('screen');
    return () => void lock.release().catch(() => {});
  } catch {
    return () => {};
  }
}
