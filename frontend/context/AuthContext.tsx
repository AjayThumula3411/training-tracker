"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { AxiosError } from "axios";
import api from "@/lib/api";
import { readAuthToken, readStoredUser, storeAuthToken, storeUser } from "@/lib/auth-storage";
import { UserProfile } from "@/lib/types";

type AuthContextValue = {
  user: UserProfile | null;
  loading: boolean;
  fetchUser: () => Promise<UserProfile | null>;
  setUser: (user: UserProfile | null) => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUserState] = useState<UserProfile | null>(() => {
    const token = readAuthToken();
    const cachedUser = readStoredUser();

    if (!token) {
      storeUser(null);
      return null;
    }

    return cachedUser;
  });
  const [loading, setLoading] = useState(true);

  const setUser = (nextUser: UserProfile | null) => {
    setUserState(nextUser);
    storeUser(nextUser);
  };

  const fetchUser = useCallback(async () => {
    const cachedUser = readStoredUser();
    const token = readAuthToken();

    if (!token) {
      setUser(null);
      setLoading(false);
      return null;
    }

    setLoading(true);

    try {
      const res = await api.get("/auth/me");

      setUser(res.data);
      return res.data as UserProfile;
    } catch (error) {
      const status = (error as AxiosError)?.response?.status;

      // Preserve the current session on transient failures.
      if (status === 401 || status === 403 || status === 404) {
        storeAuthToken(null);
        setUser(null);
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
