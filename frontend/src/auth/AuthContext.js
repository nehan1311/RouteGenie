import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { login as loginRequest, getMe } from "../api/auth";
import { setAuthToken } from "../api/client";
import { clearSession, loadSession, saveSession } from "./sessionStorage";

const AuthContext = createContext(null);

const emptySession = {
  token: null,
  role: null,
  repId: null,
  name: null,
};

function normalizeLoginPayload(payload) {
  return {
    token: payload.access_token,
    role: payload.role,
    repId: payload.rep_id,
    name: payload.name,
  };
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(emptySession);
  const [isLoading, setIsLoading] = useState(true);

  async function applySession(nextSession) {
    setAuthToken(nextSession.token);
    setSession(nextSession);
    await saveSession(nextSession);
  }

  async function login(email, password) {
    const result = await loginRequest(email, password);
    if (result.error) return result;

    const nextSession = normalizeLoginPayload(result.data);
    await applySession(nextSession);
    return { data: nextSession, error: null };
  }

  async function logout() {
    setAuthToken(null);
    setSession(emptySession);
    await clearSession();
  }

  useEffect(() => {
    let mounted = true;

    async function restoreSession() {
      const storedSession = await loadSession();
      if (!storedSession?.token) {
        if (mounted) setIsLoading(false);
        return;
      }

      const result = await getMe(storedSession.token);
      if (!mounted) return;

      if (result.error) {
        setAuthToken(null);
        setSession(emptySession);
        await clearSession();
      } else {
        const nextSession = {
          token: storedSession.token,
          role: result.data.role,
          repId: result.data.rep_id,
          name: storedSession.name || result.data.email,
        };
        setAuthToken(nextSession.token);
        setSession(nextSession);
        await saveSession(nextSession);
      }

      setIsLoading(false);
    }

    restoreSession();
    return () => {
      mounted = false;
    };
  }, []);

  const value = useMemo(
    () => ({
      token: session.token,
      role: session.role,
      repId: session.repId,
      name: session.name,
      isLoading,
      isAuthenticated: Boolean(session.token),
      login,
      logout,
    }),
    [session, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
