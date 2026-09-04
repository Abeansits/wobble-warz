let ctx: AudioContext | null = null;
let musicGain: GainNode | null = null;
let musicTimer: number | null = null;
let musicOn = false;

function ac() {
  if (typeof window === "undefined") return null;
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

import type { AudioKey } from "@/game/data/types";

export function sfx(kind: AudioKey, volume = 0.4) {
  const c = ac();
  if (!c || volume <= 0) return;
  if (c.state === "suspended") void c.resume();
  const t = c.currentTime;
  const o = c.createOscillator();
  const g = c.createGain();
  o.connect(g);
  g.connect(c.destination);
  const freq =
    kind === "hit" ? 180 : kind === "boom" ? 70 : kind === "win" ? 440 : kind === "shot" ? 520 : kind === "swing" ? 240 : 320;
  o.type = kind === "yelp" ? "square" : "triangle";
  o.frequency.setValueAtTime(freq + Math.random() * 40, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.5), t + 0.12);
  g.gain.setValueAtTime(volume * 0.2, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + (kind === "win" ? 0.4 : 0.14));
  o.start(t);
  o.stop(t + 0.42);
}

function blip(c: AudioContext, dest: AudioNode, freq: number, t: number, dur: number, vol: number) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "triangle";
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g);
  g.connect(dest);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export function startMeadow(volume = 0.35) {
  const c = ac();
  if (!c || volume <= 0) return;
  if (c.state === "suspended") void c.resume();
  if (musicOn) {
    if (musicGain) musicGain.gain.value = volume * 0.12;
    return;
  }
  musicOn = true;
  musicGain = c.createGain();
  musicGain.gain.value = volume * 0.12;
  musicGain.connect(c.destination);
  const notes = [196, 247, 294, 330, 294, 247, 220, 196];
  let step = 0;
  const tick = () => {
    if (!musicOn || !ctx || !musicGain) return;
    const t = ctx.currentTime;
    blip(ctx, musicGain, notes[step % notes.length], t, 0.28, 0.9);
    if (step % 4 === 0) blip(ctx, musicGain, 98, t, 0.4, 0.5);
    step++;
    musicTimer = window.setTimeout(tick, 420);
  };
  tick();
}

export function stopMeadow() {
  musicOn = false;
  if (musicTimer != null) window.clearTimeout(musicTimer);
  musicTimer = null;
  if (musicGain && ctx) {
    musicGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
  }
}

export function duckMeadow(on: boolean) {
  if (!musicGain) return;
  musicGain.gain.value = on ? 0.04 : 0.12;
}
