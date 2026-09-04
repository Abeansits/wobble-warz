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
  await page.screenshot({ path: png("title.png"), fullPage: false, animations: "disabled", timeout: 8000 });

  await page.goto(`${url}/battle`, { waitUntil: "commit", timeout: 30000 });
  await page.waitForFunction(() => Boolean(window.__wobble), { timeout: 20000 });
  await page.evaluate(() => window.__wobble.startDemo());
  await page.waitForTimeout(2500);
  await page.screenshot({ path: png("fight-start.png"), animations: "disabled", timeout: 8000 });

  const deadline = Date.now() + 45000;
  let deaths = 0;
  let finished = false;
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
      await page.screenshot({ path: png("fight-over.png"), animations: "disabled", timeout: 8000 });
      const results = await page.getByText(/WINS|DRAW/).count();
      console.log(JSON.stringify({ ok: true, resultsVisible: results > 0, ...snap, consoleErrors: errors.slice(0, 8) }));
      process.exitCode = results > 0 ? 0 : 1;
      finished = true;
      break;
    }
    if (snap.dead > 0 && !globalThis.__sawKill) {
      globalThis.__sawKill = true;
      await page.screenshot({ path: png("fight-kill.png"), animations: "disabled", timeout: 8000 });
    }
    await page.waitForTimeout(400);
  }

  if (!finished) {
    await page.screenshot({ path: png("fight-timeout.png"), animations: "disabled", timeout: 8000 });
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
    console.log(JSON.stringify({ ok: false, reason: "no deaths in 25s", deaths, ...snap, consoleErrors: errors.slice(0, 8) }));
    process.exitCode = 1;
  }
} catch (err) {
  console.error(JSON.stringify({ ok: false, error: String(err?.message || err), consoleErrors: errors.slice(0, 8) }));
  process.exitCode = 1;
} finally {
  await browser.close();
}
