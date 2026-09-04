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
await page.waitForTimeout(4000);
await page.screenshot({ path: new URL("mvp-title.png", outDir).pathname });
const titleFight = await page.locator("canvas").count();

await page.goto(`${url}/roll`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
await page.getByRole("button", { name: /Pull lever/i }).click();
await page.waitForTimeout(1600);
await page.screenshot({ path: new URL("mvp-roll.png", outDir).pathname });

await page.goto(`${url}/armory`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);
await page.screenshot({ path: new URL("mvp-armory.png", outDir).pathname });

await page.goto(`${url}/battle`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => Boolean(window.__wobble), { timeout: 20000 });
await page.evaluate(() => window.__wobble.startDemo());
await page.waitForTimeout(2000);
await page.screenshot({ path: new URL("mvp-fight.png", outDir).pathname });

const deadline = Date.now() + 45000;
let over = false;
while (Date.now() < deadline) {
  const snap = await page.evaluate(() => {
    const w = window.__wobble?.world;
    return w ? { phase: w.phase, dead: w.units.filter((u) => u.state === "dead").length } : {};
  });
  if (snap.phase === "over") {
    over = true;
    await page.waitForTimeout(500);
    await page.screenshot({ path: new URL("mvp-results.png", outDir).pathname });
    break;
  }
  await page.waitForTimeout(400);
}

const results = await page.getByText(/WINS|DRAW/).count();
console.log(
  JSON.stringify({
    ok: over && results > 0 && titleFight > 0,
    titleFight,
    over,
    resultsVisible: results > 0,
    consoleErrors: errors.filter((e) => !e.includes("favicon")).slice(0, 8),
  }),
);
await browser.close();
process.exit(over && results > 0 ? 0 : 1);
