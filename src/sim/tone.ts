/** Plays a short sine tone (call only from a user tap: browsers require a gesture to start audio). */
let ac: AudioContext | null = null;

export function playTone(freq: number, seconds = 1.5, volume = 0.2): void {
  try {
    const nav = navigator as Navigator & { audioSession?: { type: string } };
    if (nav.audioSession) nav.audioSession.type = 'playback';
    ac ??= new AudioContext();
    void ac.resume();
    const t0 = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.frequency.value = Math.max(20, Math.min(20000, freq));
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(volume, t0 + 0.03);
    gain.gain.setValueAtTime(volume, t0 + seconds - 0.1);
    gain.gain.linearRampToValueAtTime(0, t0 + seconds);
    osc.connect(gain).connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + seconds + 0.05);
  } catch {
    // audio not available: ignore
  }
}
