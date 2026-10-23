import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as SecureStore from "expo-secure-store";

import {
  setAuthToken,
  setAuthEventHandler,
  setAccountBlockedHandler,
} from "../config/api";
import { refreshSession, fetchMe } from "../services/authService";
import { syncLocationOnAuth } from "../utils/location";
import { clearNavState } from "../utils/navState";

const ACCESS_KEY = "hn.accessToken";
const REFRESH_KEY = "hn.refreshToken";
const USER_KEY = "hn.user"; // last known profile, for offline-friendly relaunch
// One-way onboarding marker: set the first time a session is applied and
// NEVER cleared by sign-out. It answers "has this device been through
// onboarding before?" so the guest area can open on Login instead of
// replaying role selection (PRD §5 onboarding flow).
const HAS_ACCOUNT_KEY = "hn.hasAccount";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);
  // True once any session has existed on this device (survives sign-out).
  const [hasAccount, setHasAccount] = useState(false);
  // PRD §3.2/§15.6 — set when the gateway answers 403 { banned|suspended }.
  // While set, RootNavigator swaps the whole app for AccountStatusScreen
  // (banned: read-only + sign out; suspended: + the appeal form the gateway
  // deliberately keeps reachable for suspended accounts). Cleared when a
  // fresh session is applied or when the user acknowledges the screen.
  const [accountBlocked, setAccountBlocked] = useState(null);
  const refreshInFlight = useRef(null);

  // Merge a profile patch (e.g. location) into the session + cache.
  const updateUser = useCallback((partial) => {
    setUser((prev) => {
      if (!prev) return prev;

      const next = { ...prev, ...partial };
      SecureStore.setItemAsync(USER_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  // Persist the one-way onboarding marker. Deliberately not part of
  // clearSession — logging out must land the user on Login, not back in
  // role selection.
  const markHasAccount = useCallback(() => {
    setHasAccount(true);
    SecureStore.setItemAsync(HAS_ACCOUNT_KEY, "1");
  }, []);

  // Store a fresh session: token in memory for the API client, both tokens
  // plus the profile in SecureStore so the session survives app restarts.
  const applySession = useCallback(
    ({ tokens, userData }) => {
      setAuthToken(tokens.access);
      setUser(userData);
      // A successful fresh login means the account is usable again —
      // drop any stale blocked state from a previous session.
      setAccountBlocked(null);

      SecureStore.setItemAsync(ACCESS_KEY, tokens.access);
      SecureStore.setItemAsync(REFRESH_KEY, tokens.refresh);
      SecureStore.setItemAsync(USER_KEY, JSON.stringify(userData));
      markHasAccount();

      // Auth-time location refresh (BUILD 2026-10-21.19): every login or
      // signup takes a fresh device fix and PATCHes it to the profile, so
      // "near me" matching works from the very first session. The launch
      // capture alone could be stale (or missing if permission was granted
      // later). Silent + best-effort — never blocks or fails the login.
      syncLocationOnAuth().then((freshUser) => {
        if (freshUser) {
          updateUser(freshUser);
        }
      });
    },
    [updateUser, markHasAccount]
  );

  const clearSession = useCallback(() => {
    setAuthToken(null);
    setUser(null);
    // Drop the persisted navigation stack too — the next sign-in (possibly
    // a different account on a shared device) must never restore it.
    clearNavState();

    SecureStore.deleteItemAsync(ACCESS_KEY);
    SecureStore.deleteItemAsync(REFRESH_KEY);
    SecureStore.deleteItemAsync(USER_KEY);
  }, []);

  // Rotate the refresh token in the background. Used on app launch and
  // whenever the API client hits a 401 with an expired access token.
  // Single-flight: concurrent 401s share one rotation instead of racing
  // (a second rotation with an already-used token would fail).
  const rotateSession = useCallback(() => {
    if (refreshInFlight.current) {
      return refreshInFlight.current;
    }

    refreshInFlight.current = (async () => {
      try {
        const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);

        if (!refreshToken) {
          return false;
        }

        const { tokens } = await refreshSession(refreshToken);

        setAuthToken(tokens.access);
        SecureStore.setItemAsync(ACCESS_KEY, tokens.access);
        SecureStore.setItemAsync(REFRESH_KEY, tokens.refresh);

        return true;
      } catch (error) {
        // Hard auth failure (revoked / expired / reused token) ends the
        // session. Network-level trouble keeps it — the user stays put
        // and the next request can retry.
        if (!error?.isNetwork) {
          clearSession();
        }
        return false;
      } finally {
        refreshInFlight.current = null;
      }
    })();

    return refreshInFlight.current;
  }, [clearSession]);

  // Wire the API client's 401 handler to the rotation logic above, and its
  // 403 banned/suspended handler to the blocked-state swap.
  useEffect(() => {
    setAuthEventHandler(rotateSession);
    return () => setAuthEventHandler(null);
  }, [rotateSession]);

  useEffect(() => {
    setAccountBlockedHandler((payload) => setAccountBlocked(payload));
    return () => setAccountBlockedHandler(null);
  }, []);

  // On app launch: rotate the stored refresh token and restore the user,
  // so returning users land straight on Home — never back in onboarding.
  useEffect(() => {
    (async () => {
      try {
        // Read the onboarding marker first so the guest entry route is
        // known before `initializing` flips (both state updates batch into
        // one render, avoiding a one-frame wrong destination).
        const storedHasAccount = await SecureStore.getItemAsync(HAS_ACCOUNT_KEY);
        if (storedHasAccount === "1") {
          setHasAccount(true);
        }

        const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);

        if (refreshToken) {
          try {
            const { tokens } = await refreshSession(refreshToken);

            setAuthToken(tokens.access);
            SecureStore.setItemAsync(ACCESS_KEY, tokens.access);
            SecureStore.setItemAsync(REFRESH_KEY, tokens.refresh);

            const { userData } = await fetchMe();
            setUser(userData);
            SecureStore.setItemAsync(USER_KEY, JSON.stringify(userData));
          } catch (error) {
            const offline =
              error?.isNetwork ||
              (typeof error?.status === "number" && error.status >= 500);

            if (offline) {
              // Gateway unreachable at launch — fall back to the cached
              // profile so the user still opens into the app. Requests
              // made before connectivity returns will 401 and trigger
              // the refresh handler above.
              const [cachedUser, cachedAccess] = await Promise.all([
                SecureStore.getItemAsync(USER_KEY),
                SecureStore.getItemAsync(ACCESS_KEY),
              ]);

              if (cachedUser && cachedAccess) {
                setAuthToken(cachedAccess);
                setUser(JSON.parse(cachedUser));
              } else {
                clearSession();
              }
            } else {
              // Stale or revoked session — start clean silently.
              clearSession();
            }
          }
        }
      } catch (error) {
        clearSession();
      } finally {
        setInitializing(false);
      }
    })();
  }, [clearSession]);

  // Acknowledge the blocked screen (sign out / back to login). Does NOT
  // run through clearSession because rotation can call that too — a banned
  // user's screen must survive unrelated session teardown.
  const acknowledgeBlocked = useCallback(() => {
    setAccountBlocked(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      initializing,
      hasAccount,
      accountBlocked,
      acknowledgeBlocked,
      applySession,
      clearSession,
      updateUser,
      rotateSession,
    }),
    [
      user,
      initializing,
      hasAccount,
      accountBlocked,
      acknowledgeBlocked,
      applySession,
      clearSession,
      updateUser,
      rotateSession,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>.");
  }
  return ctx;
}
