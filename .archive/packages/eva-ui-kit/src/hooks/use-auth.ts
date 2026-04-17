import { useCallback, useEffect, useState } from "react";

export interface UserContext {
  user_id: string;
  email: string;
  name: string;
  role: string;
  portal_access: string[];
  workspace_grants: string[];
  data_classification_level: string;
  language: string;
}

export interface AuthState {
  user: UserContext | null;
  isAuthenticated: boolean;
  login: (email: string) => Promise<void>;
  logout: () => void;
}

const STORAGE_KEY = "eva-auth-user";
const API_BASE = "/v1/eva/auth";

function loadPersistedUser(): UserContext | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw) as UserContext;
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
  return null;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<UserContext | null>(loadPersistedUser);

  useEffect(() => {
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [user]);

  const login = useCallback(async (email: string) => {
    const response = await fetch(`${API_BASE}/demo/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Login failed: ${detail}`);
    }
    const userContext: UserContext = await response.json();
    setUser(userContext);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
  }, []);

  return {
    user,
    isAuthenticated: user !== null,
    login,
    logout,
  };
}
