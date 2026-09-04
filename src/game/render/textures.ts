import * as THREE from "three";

function canvas(size: number) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;
  return { c, ctx };
}

function noise(ctx: CanvasRenderingContext2D, size: number, alpha: number) {
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 255 * alpha;
    img.data[i] = Math.max(0, Math.min(255, img.data[i] + n));
    img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n));
    img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);
}

export function woodTexture() {
  const { c, ctx } = canvas(256);
  ctx.fillStyle = "#6b4a28";
  ctx.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 7) {
    ctx.strokeStyle = `rgba(40,24,10,${0.15 + Math.random() * 0.2})`;
    ctx.lineWidth = 2 + Math.random() * 2;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.bezierCurveTo(x + 8, 80, x - 6, 160, x + 4, 256);
    ctx.stroke();
  }
  noise(ctx, 256, 0.12);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function clothTexture() {
  const { c, ctx } = canvas(128);
  ctx.fillStyle = "#d9c9a4";
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = "rgba(0,0,0,0.08)";
  for (let y = 0; y < 128; y += 4) ctx.fillRect(0, y, 128, 1);
  noise(ctx, 128, 0.1);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function metalTexture() {
  const { c, ctx } = canvas(128);
  const g = ctx.createLinearGradient(0, 0, 128, 128);
  g.addColorStop(0, "#c9d0d6");
  g.addColorStop(0.5, "#8a939c");
  g.addColorStop(1, "#d8dee4");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  noise(ctx, 128, 0.08);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export type FaceMood = "idle" | "angry" | "hurt" | "dead";

export function faceTexture(mood: FaceMood) {
  const { c, ctx } = canvas(128);
  ctx.clearRect(0, 0, 128, 128);
  ctx.fillStyle = "#1c1710";
  if (mood === "dead") {
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(28, 40);
    ctx.lineTo(52, 62);
    ctx.moveTo(52, 40);
    ctx.lineTo(28, 62);
    ctx.moveTo(76, 40);
    ctx.lineTo(100, 62);
    ctx.moveTo(100, 40);
    ctx.lineTo(76, 62);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(64, 96, 10, 0, Math.PI);
    ctx.stroke();
  } else if (mood === "angry") {
    ctx.fillRect(30, 44, 22, 10);
    ctx.fillRect(76, 44, 22, 10);
    ctx.fillRect(36, 36, 16, 6);
    ctx.fillRect(76, 36, 16, 6);
    ctx.fillRect(48, 88, 32, 10);
  } else if (mood === "hurt") {
    ctx.beginPath();
    ctx.arc(42, 52, 8, 0, Math.PI * 2);
    ctx.arc(86, 52, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(64, 92, 14, Math.PI, 0);
    ctx.lineWidth = 6;
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(42, 52, 7, 0, Math.PI * 2);
    ctx.arc(86, 52, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(50, 88, 28, 8);
    ctx.fillRect(50, 84, 8, 8);
    ctx.fillRect(70, 84, 8, 8);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

export function toonRamp() {
  const data = new Uint8Array([80, 70, 60, 255, 160, 140, 120, 255, 255, 240, 220, 255]);
  const t = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
}

let wood: THREE.Texture | null = null;
let cloth: THREE.Texture | null = null;
let metal: THREE.Texture | null = null;
let ramp: THREE.Texture | null = null;
const faces = new Map<FaceMood, THREE.Texture>();

export function getWood() {
  return (wood ??= woodTexture());
}
export function getCloth() {
  return (cloth ??= clothTexture());
}
export function getMetalTex() {
  return (metal ??= metalTexture());
}
export function getRamp() {
  return (ramp ??= toonRamp());
}
export function getFace(mood: FaceMood) {
  let t = faces.get(mood);
  if (!t) {
    t = faceTexture(mood);
    faces.set(mood, t);
  }
  return t;
}
