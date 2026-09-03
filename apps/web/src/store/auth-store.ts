"use client";

import { create } from "zustand";

import type { AuthSession } from "@/lib/roles";

const STORAGE_KEY = "prisma-session";

interface AuthState {
  hydrated: boolean;
  session: AuthSession | null;
  hydrate: () => void;
  setSession: (session: AuthSession) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  hydrated: false,
  session: null,
  hydrate: () => {
    if (typeof window === "undefined") {
      return;
    }

    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      set({ hydrated: true, session: null });
      return;
    }

    try {
      const session = JSON.parse(raw) as AuthSession;
      set({ hydrated: true, session });
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
      set({ hydrated: true, session: null });
    }
  },
  setSession: (session) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    }

    set({ hydrated: true, session });
  },
  logout: () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }

    set({ hydrated: true, session: null });
  },
}));
