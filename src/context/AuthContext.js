import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import * as SecureStore from "expo-secure-store";

import { setAuthToken } from "../config/api";
import { refreshSession, fetchMe } from "../services/authService";

const ACCESS_KEY = "hn.accessToken";
const REFRESH_KEY = "hn.refreshToken";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  // Store a fresh session: token in memory for the API client + both
  // tokens in SecureStore so the session survives app restarts.
  const applySession = useCallback(({ tokens, userData }) => {
    setAuthToken(tokens.access);
    setUser(userData);

    SecureStore.setItemAsync(ACCESS_KEY, tokens.access);
    SecureStore.setItemAsync(REFRESH_KEY, tokens.refresh);
  }, []);

  const clearSession = useCallback(() => {
    setAuthToken(null);
    setUser(null);

    SecureStore.deleteItemAsync(ACCESS_KEY);
    SecureStore.deleteItemAsync(REFRESH_KEY);
  }, []);

  // On app launch: rotate the stored refresh token and restore the user.
  useEffect(() => {
    (async () => {
      try {
        const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);

        if (refreshToken) {
          const { tokens } = await refreshSession(refreshToken);

          setAuthToken(tokens.access);
          SecureStore.setItemAsync(ACCESS_KEY, tokens.access);
          SecureStore.setItemAsync(REFRESH_KEY, tokens.refresh);

          const { userData } = await fetchMe();
          setUser(userData);
        }
      } catch (error) {
        // Stale or revoked session — start clean silently.
        setAuthToken(null);
        setUser(null);
        SecureStore.deleteItemAsync(ACCESS_KEY);
        SecureStore.deleteItemAsync(REFRESH_KEY);
      } finally {
        setInitializing(false);
      }
    })();
  }, []);

  const value = useMemo(
    () => ({ user, initializing, applySession, clearSession }),
    [user, initializing, applySession, clearSession]
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
