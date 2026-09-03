"use client";

import { useMemo } from "react";
import { z } from "zod";

const STORAGE_KEY = "prisma-session";

const AuthClaimsSchema = z.object({
  npsn: z.string().nullish(),
  role: z.string(),
  user_id: z.string(),
});

const AuthSessionSchema = z.object({
  token: z.string(),
  user: z.object({
    id: z.string(),
    username: z.string(),
    fullName: z.string(),
    role: z.string(),
    organization: z.string().optional(),
    region: z.string().optional(),
    balai: z.string().nullish(),
  }),
  mustChangePassword: z.boolean().optional(),
});

export type ParsedAuthSession = {
  session: z.infer<typeof AuthSessionSchema>;
  npsn: string | null;
  role: string;
  userId: string;
};

export function useAuthSession(): ParsedAuthSession | null {
  return useMemo<ParsedAuthSession | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const sessionRes = AuthSessionSchema.safeParse(parsed);
      if (!sessionRes.success) {
        window.localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      const session = sessionRes.data;
      const tokenPayloadPart = session.token?.split(".")?.[1];
      let npsn: string | null = null;
      let role: string = session.user.role;
      let userId: string = session.user.id;
      if (tokenPayloadPart) {
        try {
          const decoded = atob(tokenPayloadPart);
          const claims = AuthClaimsSchema.safeParse(JSON.parse(decoded));
          if (claims.success) {
            if (claims.data.npsn) npsn = claims.data.npsn;
            if (claims.data.role) role = claims.data.role;
            if (claims.data.user_id) userId = claims.data.user_id;
          }
        } catch {
        }
      }
      return { session, npsn, role, userId };
    } catch {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(STORAGE_KEY);
      }
      return null;
    }
  }, []);
}
