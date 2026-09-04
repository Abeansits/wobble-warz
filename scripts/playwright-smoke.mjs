#!/usr/bin/env node
/**
 * Playwright smoke (spec §10.6 / TODO Wave D):
 * title loads → Play → To the meadow → /battle canvas has WebGL → no console errors.
 *
 * Needs the app on 0.0.0.0:8080 (`npm run dev`). Screenshots land in screenshots/.
 */
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { checkedOutputPath, checkedUrl } from "./browser-guard.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SCREENSHOTS = join(ROOT, "screenshots");
const DEFAULT_URL = "http://127.0.0.1:8080/";
const GOTO_TIMEOUT_MS = 20_000;
const BATTLE_TIMEOUT_MS = 25_000;

const LAUNCH_ARGS = ["--no-sandbox", "--disable-dev-shm-usage"];

/** Favicon 404s and the fonts we abort so DCL/screenshots don't hang. */
export function isBenignConsoleError(text) {
  const t = String(text);
  if (/favicon/i.test(t)) return true;
  if (/fonts\.googleapis\.com|fonts\.gstatic\.com/i.test(t)) return true;
  return false;
}

export function realErrors(errors) {
  return errors.filter((e) => !isBenignConsoleError(e));
}

function invokedAsScript() {
  try {
    return resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

async function launchChromium() {
  try {
    return await chromium.launch({ headless: true, args: LAUNCH_ARGS });
  } catch {
    return await chromium.launch({ channel: "chrome", headless: true, args: LAUNCH_ARGS });
  }
}

async function assertServer(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  } catch (err) {
    throw new Error(
      `dev server not reachable at ${url} (${err instanceof Error ? err.message : err}). Start it with npm run dev.`,
    );
  }
}

async function canvasWebGL(page) {
  return page.evaluate(() => {
    const c = document.querySelector("canvas");
    if (!c) return { ok: false, reason: "no canvas" };
    const gl = c.getContext("webgl2") || c.getContext("webgl");
    if (!gl) return { ok: false, reason: "no webgl context", w: c.width, h: c.height };
    return {
      ok: c.width > 1 && c.height > 1,
      w: c.width,
      h: c.height,
      version: gl.getParameter(gl.VERSION),
    };
  });
}

async function snap(page, absPath) {
  await page.screenshot({
    path: absPath,
    fullPage: false,
    animations: "disabled",
    timeout: 8000,
  });
}

export async function runSmoke({
  url = process.env.QA_URL ?? DEFAULT_URL,
  screenshotsDir = SCREENSHOTS,
} = {}) {
  const origin = checkedUrl(url).replace(/\/+$/, "");
  const titlePng = checkedOutputPath(join(screenshotsDir, "e2e-title.png"), [screenshotsDir]);
  const battlePng = checkedOutputPath(join(screenshotsDir, "e2e-battle.png"), [screenshotsDir]);
  mkdirSync(dirname(titlePng), { recursive: true });

  const errors = [];
  let browser = null;
  try {
    await assertServer(`${origin}/`);
    browser = await launchChromium();
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.on("pageerror", (err) => errors.push(String(err)));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    // Empty CSS so the blocking <link> finishes without waiting on Google.
    await page.route(/fonts\.googleapis\.com/, (route) =>
      route.fulfill({ status: 200, contentType: "text/css", body: "/* local fallback */" }),
    );

    // `commit`, not `domcontentloaded`: the fonts stylesheet in <head> blocks DCL.
    await page.goto(`${origin}/`, { waitUntil: "commit", timeout: GOTO_TIMEOUT_MS });
    await page.getByRole("heading", { name: "Wobble Wars" }).waitFor({ timeout: GOTO_TIMEOUT_MS });
    await page.getByRole("link", { name: /^Play\b/ }).waitFor({ timeout: GOTO_TIMEOUT_MS });
    await page.locator("canvas").waitFor({ timeout: GOTO_TIMEOUT_MS });
    await page.waitForFunction(() => {
      const c = document.querySelector("canvas");
      return Boolean(c && c.width >= 640 && c.height >= 400);
    }, { timeout: GOTO_TIMEOUT_MS });
    const titleCanvas = await page.locator("canvas").count();
    await snap(page, titlePng);

    await page.getByRole("link", { name: /^Play\b/ }).click({ timeout: 10_000 });
    // waitForURL can miss a navigation that already settled during click().
    await page.waitForFunction(() => location.pathname.replace(/\/+$/, "") === "/play", null, {
      timeout: GOTO_TIMEOUT_MS,
    });
    await page.getByRole("heading", { name: /Who's playing/ }).waitFor({ timeout: GOTO_TIMEOUT_MS });
    await page.getByRole("button", { name: /To the meadow/i }).click();
    await page.waitForFunction(() => location.pathname.replace(/\/+$/, "") === "/battle", null, {
      timeout: GOTO_TIMEOUT_MS,
    });

    await page.locator("canvas").waitFor({ timeout: BATTLE_TIMEOUT_MS });
    await page.getByRole("button", { name: /^Ready$/ }).waitFor({ timeout: BATTLE_TIMEOUT_MS });
    const bootFailed = await page.getByText("Physics failed to boot").count();
    const webgl = await canvasWebGL(page);
    await snap(page, battlePng);

    const consoleErrors = realErrors(errors);
    const ok =
      titleCanvas > 0 &&
      bootFailed === 0 &&
      webgl.ok === true &&
      consoleErrors.length === 0;

    const verdict = {
      ok,
      url: page.url(),
      titleCanvas,
      battleCanvas: await page.locator("canvas").count(),
      webgl,
      bootFailed: bootFailed > 0,
      screenshots: { title: titlePng, battle: battlePng },
      consoleErrors: consoleErrors.slice(0, 8),
    };
    console.log(JSON.stringify(verdict, null, 2));
    if (!ok) process.exitCode = 1;
    return verdict;
  } catch (err) {
    const verdict = {
      ok: false,
      error: String(err?.message || err),
      consoleErrors: realErrors(errors).slice(0, 8),
    };
    console.error(JSON.stringify(verdict, null, 2));
    process.exitCode = 1;
    return verdict;
  } finally {
    await browser?.close();
  }
}

if (invokedAsScript()) {
  await runSmoke();
}
