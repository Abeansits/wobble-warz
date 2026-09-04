let ctx: AudioContext | null = null;

function ac() {
  if (typeof window === "undefined") return null;
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

export function sfx(kind: "hit" | "boom" | "yelp" | "win", volume = 0.4) {
  const c = ac();
  if (!c || volume <= 0) return;
  if (c.state === "suspended") void c.resume();
  const t = c.currentTime;
  const o = c.createOscillator();
  const g = c.createGain();
  o.connect(g);
  g.connect(c.destination);
  const freq = kind === "hit" ? 180 : kind === "boom" ? 70 : kind === "win" ? 440 : 320;
  o.type = kind === "yelp" ? "square" : "triangle";
  o.frequency.setValueAtTime(freq + Math.random() * 40, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.5), t + 0.12);
  g.gain.setValueAtTime(volume * 0.2, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + (kind === "win" ? 0.4 : 0.14));
  o.start(t);
  o.stop(t + 0.42);
}
