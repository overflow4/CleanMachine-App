import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { AuthUser, Tenant } from "@/types";
import { login as apiLogin, logout as apiLogout, getSession, getSessionToken } from "./api";

interface AuthState {
  user: AuthUser | null;
  tenant: Tenant | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    tenant: null,
    isLoading: true,
    isAuthenticated: false,
  });

  const refresh = useCallback(async () => {
    try {
      const token = await getSessionToken();
      if (!token) {
        setState({ user: null, tenant: null, isLoading: false, isAuthenticated: false });
        return;
      }
      const session = await getSession();
      setState({
        user: session.user,
        tenant: session.tenant,
        isLoading: false,
        isAuthenticated: true,
      });
    } catch {
      setState({ user: null, tenant: null, isLoading: false, isAuthenticated: false });
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (username: string, password: string) => {
    const result = await apiLogin(username, password);
    setState({
      user: result.data.user,
      tenant: result.data.tenant,
      isLoading: false,
      isAuthenticated: true,
    });
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setState({ user: null, tenant: null, isLoading: false, isAuthenticated: false });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
