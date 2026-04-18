"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { AxiosError } from "axios";
import api from "@/lib/api";
import { UserProfile } from "@/lib/types";

type AuthContextValue = {
  user: UserProfile | null;
  loading: boolean;
  fetchUser: () => Promise<UserProfile | null>;
  setUser: (user: UserProfile | null) => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

const AUTH_USER_KEY = "auth_user";

const readStoredUser = () => {
  if (typeof window === "undefined") return null;

  const storedUser = window.localStorage.getItem(AUTH_USER_KEY);

  if (!storedUser) return null;

  try {
    return JSON.parse(storedUser) as UserProfile;
  } catch {
    window.localStorage.removeItem(AUTH_USER_KEY);
    return null;
  }
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUserState] = useState<UserProfile | null>(() => readStoredUser());
  const [loading, setLoading] = useState(true);

  const setUser = (nextUser: UserProfile | null) => {
    setUserState(nextUser);

    if (typeof window === "undefined") return;

    if (nextUser) {
      window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(nextUser));
      return;
    }

    window.localStorage.removeItem(AUTH_USER_KEY);
  };

  const fetchUser = useCallback(async () => {
    setLoading(true);

    try {
      const res = await api.get("/auth/me", {
        withCredentials: true,
      });

      setUser(res.data);
      return res.data as UserProfile;
    } catch (error) {
      const status = (error as AxiosError)?.response?.status;
      const cachedUser = readStoredUser();

      // Preserve the current session on transient failures.
      if (status === 401 || status === 403) {
        if (typeof window !== "undefined") {
          window.localStorage.removeItem("auth_token");
        }

        if (!cachedUser) {
          setUser(null);
        }
      }

      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchUser();
  }, [fetchUser]);

  return (
    <AuthContext.Provider value={{ user, loading, fetchUser, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
};
