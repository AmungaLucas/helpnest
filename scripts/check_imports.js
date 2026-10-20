#!/usr/bin/env node
// Scan all relative imports under helpnest/src and report any that do not
// resolve to an existing file (with RN-style extension inference).
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "src");
const EXTS = [".js", ".jsx", ".ts", ".tsx", ".json", "/index.js"];

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (/\.(js|jsx|ts|tsx)$/.test(e.name)) yield p;
  }
}

function resolves(base) {
  if (fs.existsSync(base) && fs.statSync(base).isFile()) return true;
  for (const ext of EXTS) if (fs.existsSync(base + ext)) return true;
  return false;
}

let files = 0, bad = 0;
for (const file of walk(ROOT)) {
  files++;
  const src = fs.readFileSync(file, "utf8");
  const re = /(?:from\s*|require\(\s*)["'](\.[^"']+)["']/g;
  let m;
  while ((m = re.exec(src))) {
    const target = path.resolve(path.dirname(file), m[1]);
    if (!resolves(target)) {
      bad++;
      console.log(`MISSING  ${path.relative(ROOT, file)}  ->  ${m[1]}`);
    }
  }
}
console.log(`\nScanned ${files} files under src/ — ${bad === 0 ? "ALL relative imports resolve OK" : bad + " broken import(s)"}`);
process.exit(bad === 0 ? 0 : 1);
