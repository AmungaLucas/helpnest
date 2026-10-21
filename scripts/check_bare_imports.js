/** Verifies every bare (npm) import in helpnest/src resolves in node_modules. */
const fs = require("fs");
const path = require("path");

const APP = path.resolve(__dirname, "..");
const SRC = path.join(APP, "src");

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".js")) out.push(p);
  }
  return out;
}

const bare = new Set();

// Comment stripper that respects string/template literals, so prose like
// `throws "Creating blobs from 'ArrayBuffer'..."` in a comment can never be
// mistaken for a bare import (regex-literal edge cases are accepted; the
// esbuild syntax gate in ci_gate.mjs covers real parse errors).
function stripJsComments(src) {
  let out = "";
  let i = 0;
  let mode = "code";
  let quote = null;
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (mode === "code") {
      if (c === '"' || c === "'" || c === "`") {
        quote = c;
        out += c;
        i += 1;
        mode = "str";
        continue;
      }
      if (c === "/" && n === "/") { mode = "line"; i += 2; continue; }
      if (c === "/" && n === "*") { mode = "block"; i += 2; continue; }
      out += c;
      i += 1;
      continue;
    }
    if (mode === "str") {
      if (c === "\\") { out += src.slice(i, i + 2); i += 2; continue; }
      if (c === quote) { mode = "code"; quote = null; }
      out += c;
      i += 1;
      continue;
    }
    if (mode === "line") {
      if (c === "\n") { mode = "code"; out += c; }
      i += 1;
      continue;
    }
    if (c === "*" && n === "/") { mode = "code"; out += " "; i += 2; continue; }
    if (c === "\n") out += "\n";
    i += 1;
  }
  return out;
}

for (const f of walk(SRC).concat([path.join(APP, "App.js"), path.join(APP, "index.js")])) {
  const src = stripJsComments(fs.readFileSync(f, "utf8"));
  for (const m of src.matchAll(/(?:from\s*|require\()\s*["']([^"']+)["']/g)) {
    const spec = m[1];
    if (!spec.startsWith(".") && !spec.startsWith("/")) bare.add(spec);
  }
}

const missing = [];
for (const spec of [...bare].sort()) {
  // strip subpath
  const scopeRoot = spec.startsWith("@")
    ? spec.split("/").slice(0, 2).join("/")
    : spec.split("/")[0];
  const base = spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0];
  const pkgRoot = path.join(APP, "node_modules", base);
  if (!fs.existsSync(pkgRoot)) {
    missing.push(spec);
    console.log(`MISSING PKG: ${spec}  (needs ${base})`);
    continue;
  }
  // subpath resolvability via package exports (approximate: try require.resolve)
  try {
    require.resolve(path.join(APP, "node_modules", base, "package.json"));
  } catch (e) {
    console.log(`NO package.json: ${base}`);
  }
}

console.log(`\nScanned bare imports: ${bare.size}, missing packages: ${missing.length}`);
