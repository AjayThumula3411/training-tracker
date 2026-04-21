"use client";

import { UserProfile } from "@/lib/types";

const AUTH_USER_KEY = "auth_user";
const AUTH_TOKEN_KEY = "auth_token";

const getStorage = () => {
  if (typeof window === "undefined") return null;
  return window.sessionStorage;
};

const removeLegacyLocalStorageKeys = () => {
  if (typeof window === "undefined") return;

  window.localStorage.removeItem(AUTH_USER_KEY);
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
};

export const readStoredUser = () => {
  const storage = getStorage();

  if (!storage) return null;

  removeLegacyLocalStorageKeys();

  const storedUser = storage.getItem(AUTH_USER_KEY);

  if (!storedUser) return null;

  try {
    return JSON.parse(storedUser) as UserProfile;
  } catch {
    storage.removeItem(AUTH_USER_KEY);
    return null;
  }
};

export const storeUser = (user: UserProfile | null) => {
  const storage = getStorage();

  if (!storage) return;

  removeLegacyLocalStorageKeys();

  if (user) {
    storage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    return;
  }

  storage.removeItem(AUTH_USER_KEY);
};

export const readAuthToken = () => {
  const storage = getStorage();

  if (!storage) return null;

  removeLegacyLocalStorageKeys();
  return storage.getItem(AUTH_TOKEN_KEY);
};

export const storeAuthToken = (token: string | null) => {
  const storage = getStorage();

  if (!storage) return;

  removeLegacyLocalStorageKeys();

  if (token) {
    storage.setItem(AUTH_TOKEN_KEY, token);
    return;
  }

  storage.removeItem(AUTH_TOKEN_KEY);
};
