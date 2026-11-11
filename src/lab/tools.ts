/** Mobile lab: the list of experiments. Each one has its own page at #/lab/<id>. */
import type { Component } from 'svelte';

export type SensorKind = 'motion' | 'orientation' | 'mic' | 'gps' | 'speaker';

export interface LabMeta {
  id: string;
  title: string;
  blurb: string;
  group: 'Sensors' | 'Experiments' | 'Sound';
  sensors: SensorKind[];
  /** what it shows, how to do the experiment, and what limits the accuracy */
  about: string[];
  howTo: string[];
  limits: string[];
  load: () => Promise<{ default: Component<{ meta: LabMeta }> }>;
}

const motion = () => import('./MotionTool.svelte');
const audio = () => import('./AudioTool.svelte');

const RATE = 'Browsers do not promise a sample rate for motion sensors (often about 60 Hz on iPhone); the measured rate is shown.';

export const LAB: LabMeta[] = [
  {
    id: 'check',
    title: 'Sensor check',
    blurb: 'What this phone can measure in the browser, with permissions and sample rates.',
    group: 'Sensors',
    sensors: ['motion', 'orientation', 'mic', 'gps'],
    about: ['Checks which sensors this browser can reach, asks for permission, and measures how many readings per second each one really gives.'],
    howTo: ['Tap “Allow motion sensors” (iPhone asks once), then move the phone.', 'Tap the microphone and location tests if you want to use them.'],
    limits: [
      'In a web browser an iPhone gives the accelerometer, gyroscope, orientation and compass heading, the microphone and GPS. It does not give the magnetic field in µT, light, proximity or air pressure.',
      'Sensors only work while the page is open on screen, and only on a secure https:// page.',
    ],
    load: () => import('./CheckTool.svelte'),
  },
  {
    id: 'accelerometer',
    title: 'Accelerometer',
    blurb: 'Acceleration along x, y, z and its magnitude, with or without gravity.',
    group: 'Sensors',
    sensors: ['motion'],
    about: [
      'The accelerometer measures the acceleration of the phone along its three axes: x across the screen, y along the screen towards the top, z out of the screen.',
      '“With g” is what the sensor really feels: lying still on a table it reads about 9.8 m s⁻² along z, because the table pushes it up. “Without g” has gravity removed by the phone (it uses the gyroscope to know which way is down).',
    ],
    howTo: ['Tap Start, then move the phone. Try lying it flat, standing it up, dropping it onto a cushion (free fall: |a| with g drops to about 0).'],
    limits: [RATE, 'Some iPhone versions report acceleration with the opposite sign; the magnitude |a| is not affected.'],
    load: motion,
  },
  {
    id: 'gyroscope',
    title: 'Gyroscope',
    blurb: 'Angular velocity about x, y, z in rad s⁻¹, and the angle turned.',
    group: 'Sensors',
    sensors: ['motion'],
    about: ['The gyroscope measures how fast the phone rotates about each of its axes (angular velocity ω in rad s⁻¹). Adding up ω·Δt over time gives the angle turned about the z axis.'],
    howTo: ['Lay the phone flat and turn it on the table by one full turn: the angle should reach 2π rad (360°).'],
    limits: [RATE, 'The integrated angle slowly drifts because small errors add up.'],
    load: motion,
  },
  {
    id: 'orientation',
    title: 'Tilt and compass',
    blurb: 'Inclinometer (spirit level) and compass heading.',
    group: 'Sensors',
    sensors: ['orientation'],
    about: ['Tilt front–back (β) and left–right (γ) like a spirit level, and the compass heading (0° = north, 90° = east).'],
    howTo: ['Place the phone on a slope to measure its angle; hold it flat to read the heading.'],
    limits: ['The compass needs calibrating (move the phone in a figure of eight) and is disturbed by nearby iron and magnets.', 'iPhone gives only the heading, not the magnetic field strength.'],
    load: () => import('./OrientationTool.svelte'),
  },
  {
    id: 'gps',
    title: 'GPS: position and speed',
    blurb: 'Position, speed, altitude, accuracy, distance travelled and your route.',
    group: 'Sensors',
    sensors: ['gps'],
    about: ['Satellite positioning gives latitude, longitude, altitude and speed about once a second. The distance travelled is the sum of the distances between successive positions (along the curved Earth).'],
    howTo: ['Go outside, tap Start and walk, cycle or ride. Compare the average speed with distance ÷ time.'],
    limits: ['Accuracy is typically 5–20 m outdoors and much worse indoors; positions less accurate than 30 m are not added to the distance.', 'There is no map background (no external map service is used).'],
    load: () => import('./GpsTool.svelte'),
  },
  {
    id: 'g',
    title: 'Measure g',
    blurb: 'The gravitational field strength from a phone lying still, with uncertainty.',
    group: 'Experiments',
    sensors: ['motion'],
    about: ['A phone at rest measures the push of the table, equal and opposite to its weight, so the magnitude of the acceleration “with g” is g. Averaging many readings gives g and its uncertainty (standard error of the mean).'],
    howTo: ['Put the phone on a firm table, tap Start, do not touch it for 10 s, tap Stop.'],
    limits: [RATE, 'Phone accelerometers are factory-calibrated to about ±1 %; compare with the data booklet value g = 9.8 m s⁻².'],
    load: motion,
  },
  {
    id: 'pendulum',
    title: 'Pendulum period → g',
    blurb: 'Swing the phone as a pendulum bob, measure T and calculate g = 4π²L/T².',
    group: 'Experiments',
    sensors: ['motion'],
    about: ['The gyroscope measures the swinging motion. The period T is found from the times at which the angular velocity crosses zero going up. For small swings T = 2π√(L/g), so g = 4π²L/T².'],
    howTo: ['Hang the phone on a string (or put it in a sock) and measure the length L from the pivot to the middle of the phone. Swing it gently (less than about 10°), tap Start, wait 10 swings, tap Stop.'],
    limits: [RATE, 'Large swings make T longer than the formula. The phone is not a point mass, so use the distance to its centre.'],
    load: motion,
  },
  {
    id: 'centripetal',
    title: 'Centripetal acceleration',
    blurb: 'Phone in a salad spinner: a against ω², the gradient is the radius.',
    group: 'Experiments',
    sensors: ['motion'],
    about: ['In circular motion a = ω²r. The gyroscope gives ω, the accelerometer gives a. Plotting a against ω² gives a straight line through the origin with gradient r, the distance of the sensor from the axis.'],
    howTo: ['Put the phone flat in a salad spinner (or on a turntable), tap Start, spin it at different speeds, tap Stop. Compare the fitted r with a ruler measurement.'],
    limits: [RATE, 'The sensor is somewhere inside the phone, not at its centre; tilting adds a component of gravity.'],
    load: motion,
  },
  {
    id: 'spring',
    title: 'Spring and lift',
    blurb: 'Phone on a spring: period → spring constant. In a lift: apparent weight.',
    group: 'Experiments',
    sensors: ['motion'],
    about: [
      'A mass m on a spring oscillates with T = 2π√(m/k), so k = 4π²m/T². The period is taken from the magnitude of the acceleration.',
      'In a lift the phone measures the apparent weight: it reads more than g while the lift speeds up going up (or slows down going down) and less than g in the opposite cases.',
    ],
    howTo: ['Spring: hang the phone (in a bag) on a spring, enter its mass, pull it down a little, let go, tap Start.', 'Lift: hold the phone flat and still, tap Start, ride the lift.'],
    limits: [RATE, 'The mass of the spring and the bag add to m.'],
    load: motion,
  },
  {
    id: 'oscilloscope',
    title: 'Oscilloscope and sound level',
    blurb: 'The microphone signal as a wave, and its loudness in dB.',
    group: 'Sound',
    sensors: ['mic'],
    about: ['Shows the pressure variation picked up by the microphone, like an oscilloscope, triggered so a steady note stands still. The sound level is shown in dB relative to the loudest signal the microphone can record (dBFS), not in calibrated dB(A).'],
    howTo: ['Whistle, sing or play a note next to the phone. Compare the shapes of a whistle (almost a sine wave) and of a voice.'],
    limits: ['Automatic gain, echo cancellation and noise suppression are switched off, but the phone’s microphone still filters very low and very high frequencies.'],
    load: audio,
  },
  {
    id: 'spectrum',
    title: 'Sound spectrum (FFT)',
    blurb: 'Which frequencies a sound contains, the exact peak frequency and a spectrogram.',
    group: 'Sound',
    sensors: ['mic'],
    about: ['A Fourier transform (FFT) splits the sound into its frequencies. The strongest peak is located to a fraction of the bin width by fitting a parabola. The spectrogram shows how the spectrum changes with time (brighter = louder).'],
    howTo: ['Play a tone from the tone generator on another device, a tuning fork or an instrument. Read the peak frequency; look for harmonics at 2f, 3f …'],
    limits: ['The frequency resolution is the sample rate divided by 4096 (about 12 Hz at 48 kHz); the peak itself is found much more precisely.'],
    load: audio,
  },
  {
    id: 'acoustic-stopwatch',
    title: 'Acoustic stopwatch',
    blurb: 'Timing between two loud sounds (e.g. for the speed of sound).',
    group: 'Sound',
    sensors: ['mic'],
    about: ['The stopwatch starts at the first sound louder than the threshold and stops at the next one. To measure the speed of sound, stand a distance s from a large wall and clap once: the stopwatch starts at the clap and stops at its echo, which has travelled d = 2s, so v = d/Δt.'],
    howTo: ['Set the threshold above the background noise (watch the level), tap Arm, then make two sharp sounds (claps, clicks).'],
    limits: ['The timing comes from the audio samples (resolution about 0.02 ms); the uncertainty is mostly how sharp the sounds are.'],
    load: audio,
  },
  {
    id: 'tone',
    title: 'Tone generator',
    blurb: 'Sine, square, triangle or sawtooth; two tones make beats.',
    group: 'Sound',
    sensors: ['speaker'],
    about: ['Plays a tone of a chosen frequency and waveform. Two tones of nearly equal frequency produce beats: the loudness rises and falls at the beat frequency |f₁ − f₂|.'],
    howTo: ['Set the frequency, tap Play. For beats switch on the second tone and set it 1–5 Hz away from the first.', 'Use it with the spectrum or standing-wave experiments, or on a second phone.'],
    limits: ['Phone speakers cannot play low frequencies (below about 200 Hz) loudly. Keep the volume moderate to protect your hearing.'],
    load: () => import('./ToneTool.svelte'),
  },
];

export const labTool = (id: string | null) => LAB.find((t) => t.id === id);
