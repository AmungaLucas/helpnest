/**
 * Contact Guard — PRD v1.1 §10.1 layered detection, executed ON-DEVICE
 * before a message is sealed (the platform is E2EE, so this is where the
 * §10.2 masking behaviour lives).
 *
 * Layers implemented (image/OCR intentionally deferred per §10.1):
 *   normalization   leet-map O->0, l/|->1 (1:1 so spans stay aligned)
 *   pattern         KE phone shapes (07xx/01xx/+2547x/+2541x). Separators
 *                   between digits can be space/dot/dash OR any symbol run
 *                   of 1-2 chars ("0$7^0&5@9...", "0•7•0•...", "07 / 12 /
 *                   345 / 678") — obfuscation with decorative symbols is
 *                   caught too, with a date-range guard so "07/10/2026-08/
 *                   10/2026" is never masked. Emails, URLs/domain refs.
 *   context         channel phrases EN + Swahili ("whatsapp", "nipigie",
 *                   "call me"...) -> SOFT risk only (§10.1: never
 *                   auto-restrict on an uncertain message)
 *   spelled digits  EN + Swahili number-word sequences (>= 7 digits);
 *                   single symbols ("zero•seven•one...") act as connectors
 *   false positives salaries, times, ages, reference numbers don't match
 *                   the phone SHAPE and are never masked
 *
 * Behaviour (§10.2): definite hits are MASKED OUT of the outgoing text —
 * the sender's own copy shows the masked version too — and the send is
 * reported to the server as a flag { kind, severity:'definite' } so the
 * §10.5 escalation tiers (warning -> 24h -> 7d) run server-side. Soft hits
 * warn but never mask or restrict.
 */

const MASK = "[contact hidden]";

const LEET = /o/g;
const LEET_L = /[l|]/g;

// Any punctuation/symbol character (bullets •●○¤■☆~, $^&@*, currency
// marks...) — these are treated as digit separators, so obfuscated numbers
// like "0$7^0&5@9*2!3#4$5%6" are caught. Letters always END a candidate run,
// which keeps prose numbers ("leaves at 7, arrives 12.30") from merging.
const SYMBOL_CHAR = /[^0-9A-Za-z\s]/;

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

const URL_RE =
  /((?:https?:\/\/|www\.)[^\s]+|\b[a-z0-9][a-z0-9-]*\.(?:com|net|org|ke|co\.ke|or\.ke|me|app|io|africa|xyz|link|site|online)\b)/gi;

// "WhatsApp me on..." — channel intent without a concrete identifier.
const CONTEXT_PHRASES = [
  "whatsapp",
  "whats app",
  "whatsap",
  "nipigie",
  "piga simu",
  "call me",
  "text me",
  "sms me",
  "simu yangu",
  "namba yangu",
  "nambari yangu",
  "number yangu",
  "my number",
  "phone me",
  "dial me",
];

const NUMBER_WORDS = {
  zero: "0",
  sifuri: "0",
  one: "1",
  moja: "1",
  two: "2",
  mbili: "2",
  three: "3",
  tatu: "3",
  four: "4",
  nne: "4",
  five: "5",
  tano: "5",
  six: "6",
  sita: "6",
  seven: "7",
  saba: "7",
  eight: "8",
  nane: "8",
  nine: "9",
  tisa: "9",
};

const CONNECTORS = new Set(["na", "and", "-", ",", "."]);

function mergeSpans(spans) {
  const sorted = [...spans].sort((a, b) => a.start - b.start || b.end - a.end);
  const out = [];

  for (const span of sorted) {
    const last = out[out.length - 1];

    if (last && span.start <= last.end) {
      last.end = Math.max(last.end, span.end);
      if (span.kind === "phone") last.kind = "phone";
    } else {
      out.push({ ...span });
    }
  }

  return out;
}

// KE phone shapes, digit-based: 07XXXXXXXX / 01XXXXXXXX (10 digits) or
// +254 7X/1X (12 digits). Separator-agnostic by construction.
function looksLikeKenyanPhone(digits) {
  return (
    (digits.length === 10 && /^0[17]/.test(digits)) ||
    (digits.length === 12 && /^254[17]/.test(digits))
  );
}

// Date ranges ("07/10/2026-08/10/2026") have 16 digits and start with 07 —
// they would satisfy the shape check, so reject spans whose separator-delimited
// groups look like a calendar date (a 20xx year group plus day/month pairs).
function isDateLike(groups) {
  if (groups.length < 3) return false;

  const hasYear = groups.some((g) => g.length === 4 && /^20\d\d$/.test(g));
  const twoDigitGroups = groups.filter((g) => g.length === 2).length;

  return hasYear && twoDigitGroups >= 2;
}

// Try a candidate run: mask it when the stripped digits form a KE phone.
// Long junk between digit groups (2+ consecutive non-digits — ", ", " / ",
// "**" padding) splits the run so two numbers separated by punctuation are
// each judged on their own digits.
function phoneSpansFromRun(source, start, end, out, depth = 0) {
  while (start < end && !/\d/.test(source[start])) start += 1;
  while (end > start && !/\d/.test(source[end - 1])) end -= 1;

  if (start >= end) return;

  const raw = source.slice(start, end);
  const digits = raw.replace(/\D/g, "");

  if (looksLikeKenyanPhone(digits)) {
    const groups = raw.split(/\D+/).filter(Boolean);

    if (!isDateLike(groups)) {
      out.push({ kind: "phone", start, end });
      return;
    }
  }

  // Not a phone — split at STRUCTURAL boundaries (a space touching
  // punctuation: ", ", " / ", " ... ") and retry each fragment once, so two
  // numbers separated by punctuation are judged on their own digits.
  // Repeated-symbol padding ("**", "•••") never splits — it is obfuscation
  // INSIDE one number. Depth-bounded; fragments keep single-char separators.
  if (depth >= 2) return;

  const splitRe = /(?:\s[^\d\s]|[^\d\s]\s)/g;
  let cursor = start;
  let match;
  let splitAny = false;

  while ((match = splitRe.exec(raw))) {
    splitAny = true;
    const fragEnd = start + match.index + 1;

    if (fragEnd > cursor) {
      phoneSpansFromRun(source, cursor, fragEnd, out, depth + 1);
    }

    cursor = start + match.index + 1;
  }

  if (splitAny && cursor < end) {
    phoneSpansFromRun(source, cursor, end, out, depth + 1);
  }
}

// Scan maximal runs of digits/symbols/plus/spaces (letters end a run — that
// is what keeps prose numbers from merging), then test each as a phone.
function findPhones(source) {
  const spans = [];
  const n = source.length;
  let i = 0;

  while (i < n) {
    const ch = source[i];
    const isDigit = /\d/.test(ch);
    // '+' may open a run only when digits follow (+254...).
    const opensRun =
      isDigit || (ch === "+" && /\d/.test(source[i + 1] || ""));

    if (!opensRun) {
      i += 1;
      continue;
    }

    let j = i + 1;

    // Extend the run through digits, single spaces and symbol characters.
    // Letters are the hard boundary (no space-then-letter continuation).
    while (j < n && (/\d/.test(source[j]) || SYMBOL_CHAR.test(source[j]) || source[j] === " ")) {
      j += 1;
    }

    phoneSpansFromRun(source, i, j, spans);
    i = j;
  }

  return spans;
}

function findSpelledDigits(text) {
  const tokens = [];
  const re = /([A-Za-z']+)|(\d+)|(\s+)|(.)/g;
  let match;

  while ((match = re.exec(text))) {
    tokens.push({
      text: match[0],
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  const spans = [];
  let run = [];

  const flush = () => {
    if (run.length >= 7) {
      spans.push({ kind: "spelled", start: run[0].start, end: run[run.length - 1].end });
    }
    run = [];
  };

  for (const token of tokens) {
    const word = token.text.toLowerCase();

    if (NUMBER_WORDS[word]) {
      run.push(token);
      continue;
    }

    if (run.length > 0 && (CONNECTORS.has(word) || /^\s+$/.test(token.text) || (token.text.length === 1 && SYMBOL_CHAR.test(token.text)))) {
      // connector inside a spelled run — letters end it, spaces and single
      // symbol separators ("zero•seven•one") keep it scanning
      run.push(token);
      continue;
    }

    flush();
  }

  flush();
  return spans;
}

/**
 * Scans a draft. Returns:
 *   definiteHits  [{kind, start, end}] — real contact identifiers
 *   softKinds     ["context", ...]     — channel phrases, no masking
 *   masked        text with definite hits replaced by "[contact hidden]"
 *   flag          {kind, severity} payload for the gateway ledger, or null
 */
export function scanForContacts(text) {
  const source = String(text || "");

  if (!source.trim()) {
    return { definiteHits: [], softKinds: [], masked: source, flag: null };
  }

  // 1:1 leet normalization keeps spans aligned with the original string.
  const leet = source
    .toLowerCase()
    .replace(LEET, "0")
    .replace(LEET_L, "1");

  const rawSpans = [
    ...findPhones(source),
    ...findPhones(leet).map((s) => ({ ...s, kind: "phone" })),
    ...[...source.matchAll(EMAIL_RE)].map((m) => ({
      kind: "email",
      start: m.index,
      end: m.index + m[0].length,
    })),
    ...[...source.matchAll(URL_RE)].map((m) => ({
      kind: "url",
      start: m.index,
      end: m.index + m[0].length,
    })),
    ...findSpelledDigits(source),
  ];

  const definiteHits = mergeSpans(rawSpans);

  const lower = source.toLowerCase();
  const softKinds = CONTEXT_PHRASES.filter((phrase) => lower.includes(phrase));

  let masked = source;

  for (let i = definiteHits.length - 1; i >= 0; i -= 1) {
    const span = definiteHits[i];
    masked = masked.slice(0, span.start) + MASK + masked.slice(span.end);
  }

  const firstDefinite = definiteHits[0];

  return {
    definiteHits,
    softKinds,
    masked,
    flag:
      definiteHits.length > 0
        ? { kind: firstDefinite ? firstDefinite.kind : "other", severity: "definite" }
        : softKinds.length > 0
          ? { kind: "context", severity: "soft" }
          : null,
  };
}

export const CONTACT_MASK = MASK;

export function maskedSenderNotice(kind) {
  const what =
    kind === "email" ? "an email address" : kind === "url" ? "a link" : "contact details";

  return (
    `Contact information was detected and withheld. The recipient will not see ${what}. ` +
    "To share contacts, both parties must be verified, the employer needs paid access, " +
    "and both must consent in the chat."
  );
}
