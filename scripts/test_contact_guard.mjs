/* Contact-guard behavior test — runs the real module against a battery of
 * texts and asserts mask/no-mask. Run: node scripts/test_contact_guard.mjs */
import { scanForContacts } from "../src/utils/contactGuard.js";

let pass = 0;
let fail = 0;

function check(text, { masked = false, note = "" } = {}) {
  const r = scanForContacts(text);
  const hit = r.definiteHits.length > 0;
  const ok = hit === masked;
  if (ok) {
    pass += 1;
    console.log(`PASS [${masked ? "MASK" : "keep"}] ${text.slice(0, 64)}`);
  } else {
    fail += 1;
    console.log(
      `FAIL [expected ${masked ? "MASK" : "keep"}] ${text}\n     -> hits=${JSON.stringify(r.definiteHits)} masked="${r.masked}"`
    );
  }
  if (note) console.log(`      (${note})`);
}

// --- must MASK ---
check("Call me on 0712345678", { masked: true, note: "plain" });
check("Call 0712 345 678 today", { masked: true, note: "spaces" });
check("0712-345-678", { masked: true, note: "dashes" });
check("+254 712 345 678", { masked: true, note: "+254 spaces" });
check("+254712345678", { masked: true, note: "+254 plain" });
check("254712345678", { masked: true, note: "254 plain" });
check("01 2345 6789 landline-ish", { masked: true, note: "01xx" });
check("0$7^0&5@9*2!3#4$5%6", { masked: true, note: "user's symbol obfuscation" });
check("0•7•1•2•3•4•5•6•7•8", { masked: true, note: "bullet separators" });
check("●●● 0700111222 ●●●", { masked: true, note: "bullet padding" });
check("07/12/345/678", { masked: true, note: "slash groups" });
check("07**1234**5678", { masked: true, note: "star padding" });
check("sms me 0712345678 or 0700999888", { masked: true, note: "two numbers split" });
check("email me at jane@gmail.com", { masked: true, note: "email" });
check("check www.helpnest.co.ke", { masked: true, note: "url" });
check("zero seven one two three four five", { masked: true, note: "spelled EN" });
check("sifuri saba tatu nne tano sita saba", { masked: true, note: "spelled SW" });
check("zero•seven•one•two•three•four•five", { masked: true, note: "spelled with bullets" });
check("whatsapp me", { masked: false, note: "soft only (context) — no mask but flags" });

// --- must KEEP (no mask) ---
check("I charge 15000 per month, plus 500 transport", { masked: false, note: "salary" });
check("I am 27 years old with 5 years experience", { masked: false, note: "ages" });
check("I am available from 07/10/2026-08/10/2026", { masked: false, note: "date range" });
check("Available 07/10/2026 to 08/10/2026", { masked: false, note: "date range words" });
check("Order ref is A-0712-XY", { masked: false, note: "ref with letters" });
check("I leave at 7, arrive 12.30", { masked: false, note: "times" });
check("KES 2500 daily neg.", { masked: false, note: "price" });
check("My kids are 2, 5 and 9", { masked: false, note: "ages list" });
check("07 1234 5678", { masked: true, note: "single-space groups still masked" });
check("it costs 5 and 7 more makes 12", { masked: false, note: "prose numbers" });

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
