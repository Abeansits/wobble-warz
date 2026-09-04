import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { checkedOutputPath, checkedUrl } from "./browser-guard.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SCREENSHOTS = join(ROOT, "screenshots");
const url = checkedUrl(process.env.QA_URL ?? "http://127.0.0.1:8080").replace(/\/+$/, "");
mkdirSync(SCREENSHOTS, { recursive: true });

const png = (name) => checkedOutputPath(join(SCREENSHOTS, name), [SCREENSHOTS]);

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("pageerror", (err) => errors.push(String(err)));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});
await page.route(/fonts\.googleapis\.com/, (route) =>
  route.fulfill({ status: 200, contentType: "text/css", body: "/* local fallback */" }),
);

try {
  await page.goto(`${url}/`, { waitUntil: "commit", timeout: 30000 });
  await page.getByRole("heading", { name: "Wobble Wars" }).waitFor({ timeout: 20000 });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: png("mvp-title.png"), animations: "disabled", timeout: 8000 });
  const titleFight = await page.locator("canvas").count();

  await page.goto(`${url}/roll`, { waitUntil: "commit" });
  await page.getByRole("button", { name: /Pull lever/i }).waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: /Pull lever/i }).click();
  await page.waitForTimeout(1600);
  await page.screenshot({ path: png("mvp-roll.png"), animations: "disabled", timeout: 8000 });

  await page.goto(`${url}/armory`, { waitUntil: "commit" });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: png("mvp-armory.png"), animations: "disabled", timeout: 8000 });

  await page.goto(`${url}/battle`, { waitUntil: "commit" });
  await page.waitForFunction(() => Boolean(window.__wobble), { timeout: 20000 });
  await page.evaluate(() => window.__wobble.startDemo());
  await page.waitForTimeout(2000);
  await page.screenshot({ path: png("mvp-fight.png"), animations: "disabled", timeout: 8000 });

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
      await page.screenshot({ path: png("mvp-results.png"), animations: "disabled", timeout: 8000 });
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
  process.exitCode = over && results > 0 ? 0 : 1;
} catch (err) {
  console.error(JSON.stringify({ ok: false, error: String(err?.message || err), consoleErrors: errors.slice(0, 8) }));
  process.exitCode = 1;
} finally {
  await browser.close();
}
