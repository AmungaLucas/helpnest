/* Wire-format + guard test: bundles the REAL app modules with esbuild
 * (stubbing expo-crypto/expo-secure-store) and cross-checks against
 * Node's built-in X25519/HKDF/ChaCha20-Poly1305 — the same contract the
 * gateway verify ran against services/chat.js. */
const fs = require("fs");
const path = require("path");
const nodeCrypto = require("crypto");
const { execSync } = require("child_process");

const APP = path.resolve(__dirname, "..");
const OUT = "/tmp/hn_chat_test";

async function main() {
  execSync(
    `npx -y esbuild ${APP}/src/services/chatCrypto.js ${APP}/src/utils/contactGuard.js ` +
      `--bundle --platform=node --format=cjs --outdir=${OUT} ` +
      `--external:expo-crypto --external:expo-secure-store`,
    { cwd: APP, stdio: "pipe" }
  );

  // ---- expo module stubs (resolved from the bundle dir) ----
  const expoCrypto = {
    getRandomBytes: (n) => new Uint8Array(nodeCrypto.randomBytes(n)),
  };
  const store = {};
  const expoSecureStore = {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1,
    getItemAsync: async (k) => store[k] ?? null,
    setItemAsync: async (k, v) => {
      store[k] = v;
    },
  };
  for (const [name, exports] of [
    ["expo-crypto", expoCrypto],
    ["expo-secure-store", expoSecureStore],
  ]) {
    const dir = path.join(OUT, "node_modules", name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "package.json"),
      JSON.stringify({ name, main: "index.js" })
    );
    fs.writeFileSync(path.join(dir, "index.js"), `module.exports = ${JSON.stringify("_STUB_")};`);
    // real exports injected post-hoc (JSON.stringify of functions is impossible)
    fs.writeFileSync(
      path.join(dir, "index.js"),
      `module.exports = global.__stubs["${name}"];`
    );
  }
  global.__stubs = { "expo-crypto": expoCrypto, "expo-secure-store": expoSecureStore };

  const cc = require(path.join(OUT, "services", "chatCrypto.js"));
  const guard = require(path.join(OUT, "utils", "contactGuard.js"));

  let passed = 0;
  let failed = 0;
  const check = (name, cond, detail) => {
    if (cond) {
      passed += 1;
      console.log("PASS", name);
    } else {
      failed += 1;
      console.log("FAIL", name, detail === undefined ? "" : "-> " + String(detail).slice(0, 200));
    }
  };

  // ---- 1) base64 helpers vs Buffer ----
  for (const len of [0, 1, 2, 3, 12, 16, 31, 100, 333]) {
    const bytes = new Uint8Array(nodeCrypto.randomBytes(len));
    const b64 = cc.bytesToBase64(bytes);
    const expected = Buffer.from(bytes).toString("base64");
    check(`base64 encode len=${len}`, b64 === expected, `${b64} != ${expected}`);
    const back = cc.base64ToBytes(expected);
    check(
      `base64 decode len=${len}`,
      Buffer.from(back).equals(Buffer.from(bytes))
    );
  }

  // ---- 2) identity + seal/open cross-impl ----
  const id = await cc.ensureIdentity();
  check("identity created with 64-hex pub", /^[0-9a-f]{64}$/.test(id.pubHex), id.pubHex);
  const again = await cc.ensureIdentity();
  check("identity stable across calls", again.pubHex === id.pubHex && again.created === false);

  const CONV = "7f0e1111-2222-3333-4444-555566667777";

  // Node-side peer keypair (raw 32-byte pub from SPKI der)
  const { publicKey: nodePub, privateKey: nodePriv } =
    nodeCrypto.generateKeyPairSync("x25519");
  const nodePubHex = nodePub
    .export({ type: "spki", format: "der" })
    .subarray(12)
    .toString("hex");

  // Node derives the SAME conversation key the app derives
  const appShared = (() => {
    // recompute via the app's own primitives: use the noble path indirectly —
    // we validate end-to-end through seal/open instead.
    return null;
  })();

  const nodeShared = nodeCrypto.diffieHellman({
    privateKey: nodePriv,
    publicKey: x25519PubFromHex(id.pubHex),
  });
  const nodeConvKey = Buffer.from(
    nodeCrypto.hkdfSync(
      "sha256",
      nodeShared,
      Buffer.from(CONV),
      Buffer.from("hn-chat-v1"),
      32
    )
  );

  const msg = "Habari! Niko available Monday kama 8am.";
  const env = cc.seal(CONV, nodePubHex, msg);

  const d = nodeCrypto.createDecipheriv(
    "chacha20-poly1305",
    nodeConvKey,
    Buffer.from(env.nonce, "hex"),
    { authTagLength: 16 }
  );
  const raw = Buffer.from(env.cipher, "base64");
  d.setAuthTag(raw.subarray(raw.length - 16));
  const nodeOpensApp =
    Buffer.concat([d.update(raw.subarray(0, raw.length - 16)), d.final()]).toString("utf8") ===
    msg;
  check("node opens app-sealed message (HKDF+AEAD contract)", nodeOpensApp);

  const nonce2 = nodeCrypto.randomBytes(12);
  const c2 = nodeCrypto.createCipheriv(
    "chacha20-poly1305",
    nodeConvKey,
    nonce2,
    { authTagLength: 16 }
  );
  const nodeCipher = Buffer.concat([
    c2.update(Buffer.from("Sealed from the other side", "utf8")),
    c2.final(),
    c2.getAuthTag(),
  ]);
  const opened = cc.openEnvelope(CONV, nodePubHex, {
    nonce: nonce2.toString("hex"),
    cipher: nodeCipher.toString("base64"),
  });
  check("app opens node-sealed message", opened === "Sealed from the other side", opened);

  let tamperCaught = false;
  try {
    const bad = Buffer.from(nodeCipher);
    bad[5] ^= 0xff;
    cc.openEnvelope(CONV, nodePubHex, {
      nonce: nonce2.toString("hex"),
      cipher: bad.toString("base64"),
    });
  } catch (e) {
    tamperCaught = true;
  }
  check("tampered ciphertext rejected", tamperCaught);

  let wrongKeyThrows = false;
  try {
    cc.openEnvelope(CONV, "aa".repeat(32), {
      nonce: nonce2.toString("hex"),
      cipher: nodeCipher.toString("base64"),
    });
  } catch (e) {
    wrongKeyThrows = true;
  }
  check("wrong peer key rejected", wrongKeyThrows);

  // ---- 3) contactGuard (§10.1) ----
  const cases = [
    ["Call me on 0712345678 tomorrow", true, "phone"],
    ["Nipigie +254 712 345 678 asante", true, "phone"],
    ["My email is grace.wanjiru@gmail.com", true, "email"],
    // wa.me/254... contains a REAL phone number — the phone layer is the
    // correct detector (kind may be phone OR url; both mask the whole span)
    ["Check https://wa.me/254712345678", true, "phone|url"],
    ["visit www.cleanup.co.ke for rates", true, "url"],
    ["My number is zero seven one two three four five six seven eight", true, "spelled"],
    ["namba yangu ni 0712345678", true, "phone"],
    ["The salary is 15000 per month", false, null],
    ["I am 23 years old", false, null],
    ["I can work 8am to 1pm", false, null],
    ["Reference RQT90210 is fine", false, null],
  ];

  for (const [text, shouldMask, kind] of cases) {
    const scan = guard.scanForContacts(text);
    check(
      `guard "${text.slice(0, 38)}" -> ${shouldMask ? "mask:" + kind : "clean"}`,
      shouldMask
        ? scan.definiteHits.length > 0 && scan.masked.includes("[contact hidden]") &&
            scan.flag && scan.flag.severity === "definite" &&
            (kind.includes("|") ? kind.includes(scan.flag.kind) : scan.flag.kind === kind)
        : scan.definiteHits.length === 0 && scan.masked === text,
      JSON.stringify({ hits: scan.definiteHits, masked: scan.masked, flag: scan.flag })
    );
  }

  const soft = guard.scanForContacts("You can whatsapp me later");
  check(
    "soft context phrase -> warn only, no mask",
    soft.definiteHits.length === 0 && soft.softKinds.includes("whatsapp") &&
      soft.flag && soft.flag.severity === "soft",
    JSON.stringify(soft)
  );

  const leet = guard.scanForContacts("ping me on o7l2 345 678 ok");
  check(
    "leet phone (o->0,l->1) detected",
    leet.definiteHits.length > 0 && leet.masked.includes("[contact hidden]"),
    JSON.stringify(leet)
  );

  console.log(`GUARD_TEST_DONE passed=${passed} failed=${failed}`);
  process.exit(failed === 0 ? 0 : 1);

  function x25519PubFromHex(hex) {
    // wrap a raw 32-byte X25519 public key into a node KeyObject
    const der = Buffer.concat([
      Buffer.from("302a300506032b656e032100", "hex"),
      Buffer.from(hex, "hex"),
    ]);
    return nodeCrypto.createPublicKey({ key: der, format: "der", type: "spki" });
  }
}

main().catch((e) => {
  console.error("TEST_FATAL", e);
  process.exit(1);
});
