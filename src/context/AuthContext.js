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

import { setAuthToken, setAuthEventHandler } from "../config/api";
import { refreshSession, fetchMe } from "../services/authService";

const ACCESS_KEY = "hn.accessToken";
const REFRESH_KEY = "hn.refreshToken";
const USER_KEY = "hn.user"; // last known profile, for offline-friendly relaunch

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const refreshInFlight = useRef(null);

  // Store a fresh session: token in memory for the API client, both tokens
  // plus the profile in SecureStore so the session survives app restarts.
  const applySession = useCallback(({ tokens, userData }) => {
    setAuthToken(tokens.access);
    setUser(userData);

    SecureStore.setItemAsync(ACCESS_KEY, tokens.access);
    SecureStore.setItemAsync(REFRESH_KEY, tokens.refresh);
    SecureStore.setItemAsync(USER_KEY, JSON.stringify(userData));
  }, []);

  const clearSession = useCallback(() => {
    setAuthToken(null);
    setUser(null);

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

  // Wire the API client's 401 handler to the rotation logic above.
  useEffect(() => {
    setAuthEventHandler(rotateSession);
    return () => setAuthEventHandler(null);
  }, [rotateSession]);

  // On app launch: rotate the stored refresh token and restore the user,
  // so returning users land straight on Home — never back in onboarding.
  useEffect(() => {
    (async () => {
      try {
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

  const value = useMemo(
    () => ({ user, initializing, applySession, clearSession, rotateSession }),
    [user, initializing, applySession, clearSession, rotateSession]
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
