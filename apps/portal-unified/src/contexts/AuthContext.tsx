import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { UserContext as User } from "@/lib/api/types";

const STORAGE_KEY = "aia.auth.v1";

export type AuthState = {
  user: User | null;
  isReady: boolean;
  login: (user: User) => void;
  logout: () => void;
};

const AuthContextInternal = createContext<AuthState | null>(null);

const readStoredUser = (): User | null => {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { user?: User } | User;
    const user = "user" in parsed && parsed.user ? parsed.user : (parsed as User);
    if (!user || typeof user !== "object" || !("email" in user)) return null;
    return user as User;
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setUser(readStoredUser());
    setIsReady(true);
  }, []);

  const login = useCallback((next: User) => {
    setUser(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ user: next }));
    } catch {
      // swallow — quota/private mode
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // swallow
    }
  }, []);

  const value = useMemo<AuthState>(() => ({ user, isReady, login, logout }), [user, isReady, login, logout]);

  return <AuthContextInternal.Provider value={value}>{children}</AuthContextInternal.Provider>;
};

export const useAuth = (): AuthState => {
  const ctx = useContext(AuthContextInternal);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
};
