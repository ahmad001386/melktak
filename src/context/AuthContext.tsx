import React, { createContext, useContext, useState, useEffect } from "react";
import { User, Tenant } from "../types/index.js";
import {
  api,
  getStoredToken,
  getStoredUser,
  getStoredTenant,
  setStoredSession,
  clearStoredSession
} from "../services/api.js";

interface AuthContextType {
  user: User | null;
  tenant: Tenant | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: { agency_code: string; username: string; password: string }) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(getStoredToken());
  const [user, setUser] = useState<User | null>(getStoredUser());
  const [tenant, setTenant] = useState<Tenant | null>(getStoredTenant());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshUser = async () => {
    if (!getStoredToken()) {
      setIsLoading(false);
      return;
    }
    try {
      const res = await api.getMe();
      if (res.success && res.data) {
        setUser(res.data.user);
        setTenant(res.data.tenant);
        localStorage.setItem("amlak_user", JSON.stringify(res.data.user));
        localStorage.setItem("amlak_tenant", JSON.stringify(res.data.tenant));
      } else {
        clearStoredSession();
        setToken(null);
        setUser(null);
        setTenant(null);
      }
    } catch {
      // keep offline/local state if available
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();

    const handleUnauthorized = () => {
      setToken(null);
      setUser(null);
      setTenant(null);
    };

    window.addEventListener("amlak:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("amlak:unauthorized", handleUnauthorized);
  }, []);

  const login = async (credentials: { agency_code: string; username: string; password: string }) => {
    try {
      const res = await api.login(credentials);
      if (res.success && res.data) {
        setStoredSession(res.data.token, res.data.user, res.data.tenant);
        setToken(res.data.token);
        setUser(res.data.user);
        setTenant(res.data.tenant);
        return { success: true };
      }
      return {
        success: false,
        error: res.error?.message || "ورود ناموفق بود. لطفاً اطلاعات را بررسی کنید."
      };
    } catch (err: any) {
      return { success: false, error: err.message || "خطا در برقراری ارتباط." };
    }
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch {
      // ignore
    } finally {
      clearStoredSession();
      setToken(null);
      setUser(null);
      setTenant(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        tenant,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        login,
        logout,
        refreshUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
