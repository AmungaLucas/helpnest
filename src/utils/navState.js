// Navigation state persistence (React Navigation "State Persistence"
// pattern) — fixes "app dumps me on the home screen mid-flow".
//
// Why: Android may kill the app process while it sits BEHIND another
// activity. The ML Kit document scanner in the KYC flow is the heaviest
// case (Play services models + camera UI in the foreground). When the user
// returns, Android cold-starts the app; without persistence React
// Navigation lands on the initial route (Home), the staged documents and
// the in-flight scan are gone, and the user has to find their way back to
// Account & verification by hand.
//
// How: the NavigationContainer's state tree is JSON-serializable (params
// are ids only — the capture-callback registry keeps functions out of
// params by design), so it is debounced-saved on every state change and
// restored as the container's initialState on the next cold start. Saves
// are tagged with the account id, so a different sign-in never inherits
// another account's stack; sign-out clears the file outright.
//
// Storage: expo-file-system File/Paths (SDK 57 API). Paths.document is
// safe from the system's low-storage cleanup, unlike Paths.cache. Every
// call is failure-tolerant — persistence may never be the reason anything
// crashes or hangs.

import { File, Paths } from "expo-file-system";

const FILE_NAME = "helpnest-nav-state.json";

// Debounce handle + dedupe cache (onStateChange fires for every focus
// change; identical payloads are skipped so the KYC 12s poll and tab
// wiggles never rewrite the file).
let writeTimer = null;
let lastSavedJson = null;

function stateFile() {
  return new File(Paths.document, FILE_NAME);
}

// Restore the stack saved by the SAME account. Returns the navigation
// state object, or null when absent / other-account / unreadable.
export function loadNavState(userId) {
  if (!userId) return null;

  try {
    const file = stateFile();

    if (!file.exists) return null;

    const saved = JSON.parse(file.text());

    if (!saved || saved.userKey !== String(userId)) return null;

    return saved.state || null;
  } catch (error) {
    if (__DEV__) {
      console.log("[NAV] state restore skipped:", error?.message);
    }
    return null;
  }
}

// Debounced save from onStateChange. Never throws.
export function saveNavState(userId, state) {
  if (!userId || !state) return;

  const json = JSON.stringify({ userKey: String(userId), state });

  if (json === lastSavedJson) return;

  if (writeTimer) clearTimeout(writeTimer);

  writeTimer = setTimeout(() => {
    writeTimer = null;
    lastSavedJson = json;

    try {
      stateFile().write(json);
    } catch (error) {
      if (__DEV__) {
        console.log("[NAV] state save failed:", error?.message);
      }
    }
  }, 600);
}

// Sign-out / account switch: drop the saved stack (privacy on shared
// devices; the userKey check already guards the cross-account case).
export function clearNavState() {
  lastSavedJson = null;

  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }

  try {
    const file = stateFile();

    if (file.exists) file.delete();
  } catch (error) {
    // Nothing sensible to do — the file is best-effort by contract.
  }
}
