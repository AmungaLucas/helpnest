/**
 * Scans helpnest/src for module-scope launch-crash hazards:
 *  1. withAlpha(colors.X) / withAlpha(<expr>) where the color token does not
 *     exist in the palette  ->  hex.replace of undefined  ->  [runtime not ready]
 *  2. colors.X references whose X is not a palette key (silent undefined
 *     styles, reported as info)
 *  3. imports of theme/colors from wrong relative depth (colors undefined)
 */
const fs = require("fs");
const path = require("path");

const SRC = path.resolve(__dirname, "..", "src");
const colorsSrc = fs.readFileSync(path.join(SRC, "theme/colors.js"), "utf8");
const palette = new Set();
for (const m of colorsSrc.matchAll(/^\s{2}([A-Za-z0-9_]+):\s/gm)) {
  palette.add(m[1]);
}
console.log("Palette keys:", [...palette].join(", "));

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".js")) out.push(p);
  }
  return out;
}

const files = walk(SRC);
let badAlpha = 0;
let badToken = 0;
let badImport = 0;

for (const f of files) {
  const rel = path.relative(path.resolve(__dirname, ".."), f);
  const src = fs.readFileSync(f, "utf8");

  // 3. verify the colors import specifier resolves to src/theme/colors.js
  const importRe =
    /import\s*{([^}]*)}\s*from\s*["']([^"']*theme\/colors|[^"']*\/colors)["']/g;
  for (const m of src.matchAll(importRe)) {
    const spec = m[2];
    const fromDir = path.dirname(f);
    const resolved = path
      .normalize(path.join(fromDir, spec))
      .replace(/\.js$/, "");
    const expected = path.join(SRC, "theme/colors");
    if (!resolved.endsWith(path.join("theme", "colors"))) {
      console.log(`[IMPORT?] ${rel}: '${spec}' -> ${resolved}`);
    }
    if (!fs.existsSync(resolved + ".js") && resolved !== expected) {
      console.log(`[IMPORT BROKEN] ${rel}: '${spec}' -> ${resolved} MISSING`);
      badImport += 1;
    }
  }

  // 1. withAlpha(...) first-arg token check
  for (const m of src.matchAll(/withAlpha\(\s*colors\.([A-Za-z0-9_]+)/g)) {
    if (!palette.has(m[1])) {
      console.log(
        `[CRASH] ${rel}: withAlpha(colors.${m[1]}) — '${m[1]}' NOT in palette`
      );
      badAlpha += 1;
    }
  }
  // withAlpha passed a non-colors.* identifier or member chain — flag for review
  for (const m of src.matchAll(/withAlpha\(\s*(?![\s)])([A-Za-z_$][\w$.]*)/g)) {
    if (!/^colors\./.test(m[1]) && m[1] !== "hex" && m[1] !== "color") {
      console.log(`[REVIEW] ${rel}: withAlpha(${m[1]}, ...) — non-palette arg`);
    }
  }

  // 2. any colors.X token check (info-level)
  for (const m of src.matchAll(/colors\.([A-Za-z0-9_]+)/g)) {
    if (!palette.has(m[1])) {
      console.log(`[TOKEN] ${rel}: colors.${m[1]} not in palette`);
      badToken += 1;
    }
  }
}

console.log(
  `\nDone. withAlpha crashes: ${badAlpha}, unknown tokens: ${badToken}, broken imports: ${badImport}`
);
