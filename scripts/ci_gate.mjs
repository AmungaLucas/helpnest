#!/usr/bin/env node
// HelpNest CI gate — the same three checks that caught the real launch
// crashes (colors.danger, wrong-depth theme imports, noble bare imports),
// wired to fail the build:
//   1. syntax gate  — every src file (plus App.js/index.js) parses with the
//                     JSX loader via esbuild
//   2. theme hazards — scripts/scan_colors_launch_crash.js
//                      (withAlpha crashes / unknown palette tokens / broken
//                      theme imports — any nonzero fails)
//   3. import resolution — scripts/check_bare_imports.js (missing npm
//                      packages) + scripts/check_imports.js (relative paths)
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");

let failed = false;
function fail(msg) {
  console.error("CI-GATE FAIL:", msg);
  failed = true;
}

// ---- 1) syntax gate -------------------------------------------------------
const esbuild = require("esbuild");
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.jsx?$/.test(e.name)) files.push(p);
  }
})(SRC);
for (const f of [path.join(ROOT, "App.js"), path.join(ROOT, "index.js")]) {
  if (fs.existsSync(f)) files.push(f);
}

let syntaxErrors = 0;
for (const f of files) {
  try {
    esbuild.transformSync(fs.readFileSync(f, "utf8"), {
      loader: "jsx",
      sourcefile: f,
    });
  } catch (e) {
    syntaxErrors += 1;
    const text = e.errors ? e.errors[0].text : e.message;
    fail(`${path.relative(ROOT, f)}: ${String(text).slice(0, 200)}`);
  }
}
console.log(`[1/3] syntax gate: ${files.length} files parsed, ${syntaxErrors} error(s)`);

// ---- 2) + 3) scanners ------------------------------------------------------
function runScanner(script, summaryRegex, fails) {
  const r = spawnSync(process.execPath, [path.join(ROOT, script)], {
    encoding: "utf8",
    cwd: ROOT,
  });
  const out = (r.stdout || "") + (r.stderr || "");
  const lines = out.trim().split("\n");
  console.log(lines.slice(-4).join("\n"));
  const m = out.match(summaryRegex);
  if (!m) {
    fail(`${script}: no summary line found`);
    return;
  }
  if (fails(m)) fail(`${script}: ${m[0]}`);
  else if (r.status !== 0) fail(`${script}: exit ${r.status}`);
}

runScanner(
  "scripts/scan_colors_launch_crash.js",
  /withAlpha crashes: (\d+), unknown tokens: (\d+), broken imports: (\d+)/,
  (m) => Number(m[1]) > 0 || Number(m[2]) > 0 || Number(m[3]) > 0
);

runScanner(
  "scripts/check_bare_imports.js",
  /Scanned bare imports: (\d+), missing packages: (\d+)/,
  (m) => Number(m[2]) > 0
);

// check_imports exits non-zero on its own when imports are broken
{
  const r = spawnSync(process.execPath, [path.join(ROOT, "scripts/check_imports.js")], {
    encoding: "utf8",
    cwd: ROOT,
  });
  const out = ((r.stdout || "") + (r.stderr || "")).trim();
  console.log(out.split("\n").slice(-2).join("\n"));
  if (r.status !== 0) fail("check_imports: broken relative imports");
}

if (failed) {
  console.error("\nCI GATE: FAILED");
  process.exit(1);
}
console.log("\nCI GATE: ALL PASS");
