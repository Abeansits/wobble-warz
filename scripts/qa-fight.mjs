import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const url = process.env.QA_URL ?? "http://127.0.0.1:8080";
const outDir = new URL("../screenshots/", import.meta.url);
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("pageerror", (err) => errors.push(String(err)));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});

await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForTimeout(1200);
await page.screenshot({ path: new URL("title.png", outDir).pathname, fullPage: true });

await page.goto(`${url}/battle`, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForFunction(() => Boolean(window.__wobble), { timeout: 20000 });
await page.evaluate(() => window.__wobble.startDemo());
await page.waitForTimeout(2500);
await page.screenshot({ path: new URL("fight-start.png", outDir).pathname });

const deadline = Date.now() + 45000;
let deaths = 0;
while (Date.now() < deadline) {
  const snap = await page.evaluate(() => {
    const w = window.__wobble.world;
    return {
      phase: w.phase,
      winner: w.winner,
      dead: w.units.filter((u) => u.state === "dead" || u.gone).length,
      alive: w.units.filter((u) => u.state !== "dead" && !u.gone).length,
      time: Math.round(w.time * 10) / 10,
    };
  });
  deaths = snap.dead;
  if (snap.phase === "over") {
    await page.waitForTimeout(400);
    await page.screenshot({ path: new URL("fight-over.png", outDir).pathname });
    const results = await page.getByText(/WINS|DRAW/).count();
    console.log(JSON.stringify({ ok: true, resultsVisible: results > 0, ...snap, consoleErrors: errors.slice(0, 8) }));
    await browser.close();
    process.exit(results > 0 ? 0 : 1);
  }
  if (snap.dead > 0 && !globalThis.__sawKill) {
    globalThis.__sawKill = true;
    await page.screenshot({ path: new URL("fight-kill.png", outDir).pathname });
  }
  await page.waitForTimeout(400);
}

await page.screenshot({ path: new URL("fight-timeout.png", outDir).pathname });
const snap = await page.evaluate(() => {
  const w = window.__wobble.world;
  return {
    phase: w.phase,
    winner: w.winner,
    dead: w.units.filter((u) => u.state === "dead" || u.gone).length,
    alive: w.units.filter((u) => u.state !== "dead" && !u.gone).length,
    time: Math.round(w.time * 10) / 10,
  };
});
console.log(JSON.stringify({ ok: false, reason: "no deaths in 25s", ...snap, consoleErrors: errors.slice(0, 8) }));
await browser.close();
process.exit(1);
