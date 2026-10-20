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

for (const f of walk(SRC).concat([path.join(APP, "App.js"), path.join(APP, "index.js")])) {
  const src = fs.readFileSync(f, "utf8");
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
