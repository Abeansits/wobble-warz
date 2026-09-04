import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { isBenignConsoleError, realErrors } from "./playwright-smoke.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));

describe("isBenignConsoleError", () => {
  test("drops favicon and aborted Google Fonts", () => {
    assert.equal(isBenignConsoleError("Failed to load resource: /favicon.ico"), true);
    assert.equal(isBenignConsoleError("net::ERR_ABORTED https://fonts.googleapis.com/css2?family=Lilita+One"), true);
    assert.equal(isBenignConsoleError("fonts.gstatic.com/s/nunito/v26.woff2"), true);
  });

  test("keeps real runtime failures", () => {
    assert.equal(isBenignConsoleError("TypeError: Cannot read properties of null"), false);
    assert.equal(isBenignConsoleError("[sim] Jolt WASM abort"), false);
    assert.deepEqual(realErrors(["favicon.ico 404", "Physics failed to boot"]), ["Physics failed to boot"]);
  });
});

test("playwright-smoke wires the guard and clicks title → battle", () => {
  const src = readFileSync(join(ROOT, "playwright-smoke.mjs"), "utf8");
  assert.match(src, /from "\.\/browser-guard\.mjs"/);
  assert.match(src, /const origin = checkedUrl\(url\)/);
  assert.match(src, /checkedOutputPath\(join\(screenshotsDir, "e2e-title\.png"\)/);
  assert.match(src, /checkedOutputPath\(join\(screenshotsDir, "e2e-battle\.png"\)/);
  assert.match(src, /waitUntil: "commit"/);
  assert.doesNotMatch(src, /waitUntil:\s*["']networkidle["']/, "Vite HMR never reaches networkidle");
  assert.match(src, /getByRole\("link", \{ name: \/Play together\/ \}\)/);
  assert.match(src, /pathname\.replace\(\/\\\/\+\$\/, ""\) === "\/battle"/);
  assert.match(src, /getContext\("webgl2"\) \|\| c\.getContext\("webgl"\)/);
  assert.match(src, /} finally \{\s*await browser\?\.close\(\);/s);
  assert.doesNotMatch(
    src.slice(src.indexOf("browser = await launchChromium")),
    /process\.exit\(/,
    "process.exit after Chromium launch skips finally teardown",
  );
});
