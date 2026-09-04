import type { ArenaId } from "@/game/data/arenas";
import type { AudioKey } from "@/game/data/types";

export type MusicBedId = "menu" | ArenaId;

export type SfxPos = { x: number; y: number; z: number };

export const VOICE_CAP = 24;
/** −6 dB during last-kill slow-mo. */
export const DUCK_RATIO = 0.5;

export const PANNER = {
  panningModel: "equalpower" as const,
  distanceModel: "inverse" as const,
  refDistance: 8,
  maxDistance: 60,
  rolloffFactor: 1,
};

export const MUSIC_BEDS: Record<
  MusicBedId,
  { notes: number[]; bass: number; interval: number; wave: OscillatorType }
> = {
  menu: { notes: [220, 261, 329, 392, 329, 261, 246, 220], bass: 110, interval: 380, wave: "triangle" },
  meadow: { notes: [196, 247, 294, 330, 294, 247, 220, 196], bass: 98, interval: 420, wave: "triangle" },
  canyon: { notes: [146, 174, 196, 220, 196, 174, 164, 146], bass: 73, interval: 480, wave: "sawtooth" },
  graveyard: { notes: [130, 155, 174, 196, 174, 155, 146, 130], bass: 65, interval: 640, wave: "sine" },
};

export function musicBedFor(arena: ArenaId, title = false): MusicBedId {
  return title ? "menu" : arena;
}

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let musicBus: GainNode | null = null;
let sfxBus: GainNode | null = null;
let musicGain: GainNode | null = null;
let musicTimer: number | null = null;
let musicOn = false;
let currentBed: MusicBedId | null = null;
let ducked = false;
let unlockBound = false;
let mixer = { master: 0.49, music: 0.36, sfx: 0.64 };
const voices: { osc: OscillatorNode; gain: GainNode; pan: PannerNode | null }[] = [];

function curve(v: number) {
  const x = Math.max(0, Math.min(1, v));
  return x * x;
}

function ac() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    ctx = new AudioContext();
    masterGain = ctx.createGain();
    musicBus = ctx.createGain();
    sfxBus = ctx.createGain();
    musicBus.connect(masterGain);
    sfxBus.connect(masterGain);
    masterGain.connect(ctx.destination);
    applyMixer();
    bindUnlock();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function bindUnlock() {
  if (unlockBound || typeof window === "undefined") return;
  unlockBound = true;
  const kick = () => {
    if (ctx && ctx.state === "suspended") void ctx.resume();
  };
  window.addEventListener("pointerdown", kick);
  window.addEventListener("keydown", kick);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") kick();
  });
}

function applyMixer() {
  if (!ctx || !masterGain || !musicBus || !sfxBus) return;
  const t = ctx.currentTime;
  masterGain.gain.setTargetAtTime(Math.max(0.0001, mixer.master), t, 0.02);
  musicBus.gain.setTargetAtTime(Math.max(0.0001, mixer.music * (ducked ? DUCK_RATIO : 1)), t, 0.04);
  sfxBus.gain.setTargetAtTime(Math.max(0.0001, mixer.sfx), t, 0.02);
}

export function setMixer(masterVol: number, musicVol: number, sfxVol: number) {
  mixer = { master: curve(masterVol), music: curve(musicVol), sfx: curve(sfxVol) };
  applyMixer();
}

export function setListener(x: number, y: number, z: number, fx: number, fy: number, fz: number) {
  const c = ctx;
  if (!c) return;
  const l = c.listener;
  l.positionX.value = x;
  l.positionY.value = y;
  l.positionZ.value = z;
  l.forwardX.value = fx;
  l.forwardY.value = fy;
  l.forwardZ.value = fz;
  l.upX.value = 0;
  l.upY.value = 1;
  l.upZ.value = 0;
}

function stealVoice() {
  while (voices.length >= VOICE_CAP) {
    const v = voices.shift();
    if (!v) break;
    try {
      v.osc.stop();
      v.gain.disconnect();
      v.pan?.disconnect();
    } catch {
      /* */
    }
  }
}

export function sfx(kind: AudioKey, volume = 0.4, pos?: SfxPos) {
  const c = ac();
  if (!c || !sfxBus || volume <= 0) return;
  stealVoice();
  const t = c.currentTime;
  const o = c.createOscillator();
  const g = c.createGain();
  const freq =
    kind === "hit" ? 180 : kind === "boom" ? 70 : kind === "win" ? 440 : kind === "shot" ? 520 : kind === "swing" ? 240 : 320;
  o.type = kind === "yelp" ? "square" : "triangle";
  o.frequency.setValueAtTime(freq + Math.random() * 40, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.5), t + 0.12);
  g.gain.setValueAtTime(volume * 0.2, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + (kind === "win" ? 0.4 : 0.14));
  o.connect(g);
  let pan: PannerNode | null = null;
  if (pos && kind !== "win") {
    pan = c.createPanner();
    pan.panningModel = PANNER.panningModel;
    pan.distanceModel = PANNER.distanceModel;
    pan.refDistance = PANNER.refDistance;
    pan.maxDistance = PANNER.maxDistance;
    pan.rolloffFactor = PANNER.rolloffFactor;
    pan.positionX.value = pos.x;
    pan.positionY.value = pos.y;
    pan.positionZ.value = pos.z;
    g.connect(pan);
    pan.connect(sfxBus);
  } else {
    g.connect(sfxBus);
  }
  const voice = { osc: o, gain: g, pan };
  voices.push(voice);
  o.onended = () => {
    const i = voices.indexOf(voice);
    if (i >= 0) voices.splice(i, 1);
    try {
      g.disconnect();
      pan?.disconnect();
    } catch {
      /* */
    }
  };
  o.start(t);
  o.stop(t + 0.42);
}

function blip(c: AudioContext, dest: AudioNode, freq: number, t: number, dur: number, vol: number, wave: OscillatorType) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = wave;
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g);
  g.connect(dest);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export function startMusic(bed: MusicBedId, volume = 0.35) {
  const c = ac();
  if (!c || !musicBus || volume <= 0) return;
  if (musicOn && currentBed === bed) {
    if (musicGain) musicGain.gain.setTargetAtTime(volume * 0.12, c.currentTime, 0.05);
    return;
  }
  stopMusic();
  musicOn = true;
  currentBed = bed;
  musicGain = c.createGain();
  musicGain.gain.value = volume * 0.12;
  musicGain.connect(musicBus);
  const spec = MUSIC_BEDS[bed];
  let step = 0;
  const tick = () => {
    if (!musicOn || !ctx || !musicGain) return;
    const t = ctx.currentTime;
    blip(ctx, musicGain, spec.notes[step % spec.notes.length], t, 0.28, 0.9, spec.wave);
    if (step % 4 === 0) blip(ctx, musicGain, spec.bass, t, 0.4, 0.5, spec.wave);
    step++;
    musicTimer = window.setTimeout(tick, spec.interval);
  };
  tick();
}

export function stopMusic() {
  musicOn = false;
  currentBed = null;
  if (musicTimer != null) {
    window.clearTimeout(musicTimer);
    musicTimer = null;
  }
  if (musicGain && ctx) {
    const g = musicGain;
    g.gain.setTargetAtTime(0.001, ctx.currentTime, 0.05);
    window.setTimeout(() => {
      try {
        g.disconnect();
      } catch {
        /* */
      }
    }, 400);
  }
  musicGain = null;
}

export function duckMusic(on: boolean) {
  ducked = on;
  applyMixer();
}

/** @deprecated use startMusic */
export const startMeadow = (volume = 0.35) => startMusic("meadow", volume);
/** @deprecated use stopMusic */
export const stopMeadow = stopMusic;
/** @deprecated use duckMusic */
export const duckMeadow = duckMusic;
