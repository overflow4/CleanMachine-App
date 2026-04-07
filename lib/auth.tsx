import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { AuthUser, Tenant } from "@/types";
import {
  login as apiLogin,
  logout as apiLogout,
  getSession,
  getSessionToken,
  switchAccount as apiSwitchAccount,
  getStoredAccounts,
  StoredAccount,
} from "./api";

interface AuthState {
  user: AuthUser | null;
  tenant: Tenant | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  accounts: StoredAccount[];
}

interface AuthContextValue extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  switchAccount: (account: StoredAccount) => Promise<void>;
  addAccount: (username: string, password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    tenant: null,
    isLoading: true,
    isAuthenticated: false,
    accounts: [],
  });

  const loadAccounts = useCallback(async () => {
    const accounts = await getStoredAccounts();
    setState((prev) => ({ ...prev, accounts }));
  }, []);

  const refresh = useCallback(async () => {
    try {
      const token = await getSessionToken();
      if (!token) {
        setState((prev) => ({ ...prev, user: null, tenant: null, isLoading: false, isAuthenticated: false }));
        return;
      }
      const session = await getSession();
      // The user object from the API has tenantSlug, not a full tenant object.
      // We store what we get and treat it as sufficient.
      const user = session.user;
      setState((prev) => ({
        ...prev,
        user,
        tenant: prev.tenant, // keep existing tenant if we have it
        isLoading: false,
        isAuthenticated: !!user,
      }));
    } catch {
      setState((prev) => ({ ...prev, user: null, tenant: null, isLoading: false, isAuthenticated: false }));
    }
  }, []);

  useEffect(() => {
    refresh();
    loadAccounts();
  }, [refresh, loadAccounts]);

  const login = useCallback(async (username: string, password: string) => {
    const result = await apiLogin(username, password);
    const user = result.data?.user;
    const tenant = result.data?.tenant || null;
    setState((prev) => ({
      ...prev,
      user,
      tenant,
      isLoading: false,
      isAuthenticated: true,
    }));
    // Reload accounts list
    const accounts = await getStoredAccounts();
    setState((prev) => ({ ...prev, accounts }));
  }, []);

  const addAccount = useCallback(async (username: string, password: string) => {
    // Login adds the account to storage automatically
    await apiLogin(username, password);
    // Refresh to pick up the new session
    await refresh();
    const accounts = await getStoredAccounts();
    setState((prev) => ({ ...prev, accounts }));
  }, [refresh]);

  const switchAccountFn = useCallback(async (account: StoredAccount) => {
    try {
      await apiSwitchAccount(account.sessionToken);
      await refresh();
    } catch {
      // If switch fails, try re-logging in
      throw new Error("Session expired. Please log in again.");
    }
  }, [refresh]);

  const logout = useCallback(async () => {
    await apiLogout();
    setState((prev) => ({ ...prev, user: null, tenant: null, isLoading: false, isAuthenticated: false }));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        logout,
        refresh,
        switchAccount: switchAccountFn,
        addAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
