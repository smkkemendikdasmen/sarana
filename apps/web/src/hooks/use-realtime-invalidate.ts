"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { useAuthSession } from "@/hooks/use-auth-session";

interface RtPayload {
  data?: {
    table?: string;
    npsn?: string;
    scope?: "global" | "school";
  };
}

export function useRealtimeInvalidate(): void {
  const auth = useAuthSession();
  const queryClient = useQueryClient();
  const npsn = auth?.npsn ?? "";
  const role = auth?.role ?? "";

  useEffect(() => {
    if (!auth) return;

    const qs = new URLSearchParams();
    qs.set("scope", "table");
    if (npsn) qs.set("npsn", npsn);
    if (role) qs.set("role", role);

    let source: EventSource | null = null;
    try {
      source = new EventSource(`/api/realtime/stream?${qs.toString()}`);
    } catch {
      return undefined;
    }

    const handleOpen = () => {
      if (typeof console !== "undefined") {
        console.debug("[rt-sse] connected");
      }
    };

    const handleRt = (ev: MessageEvent) => {
      try {
        const payload: RtPayload =
          typeof ev.data === "string" ? JSON.parse(ev.data) : (ev.data as RtPayload);
        const table = payload?.data?.table ?? "";
        const payloadNpsn = payload?.data?.npsn ?? npsn;
        const scope = payload?.data?.scope ?? "school";
        const lcTable = String(table).toLowerCase();

        if (
          lcTable.includes("proposal") ||
          lcTable.includes("wsp") ||
          lcTable.includes("workspace_school_proposal") ||
          lcTable.includes("school_proposal")
        ) {
          void queryClient.invalidateQueries({
            queryKey: ["wsp", "detail", payloadNpsn ?? npsn],
          });
          if (scope === "global") {
            void queryClient.invalidateQueries({ queryKey: ["wsp"] });
          }
        }

        if (
          lcTable.includes("equipment") ||
          lcTable.includes("wse") ||
          lcTable.includes("peralatan") ||
          lcTable.includes("alat")
        ) {
          void queryClient.invalidateQueries({
            queryKey: ["wse", "detail", payloadNpsn ?? npsn],
          });
          if (scope === "global") {
            void queryClient.invalidateQueries({ queryKey: ["wse"] });
          }
        }

        const isAdmin =
          role === "ADMIN" ||
          role === "SUPERADMIN" ||
          role === "KOORDINATOR_ALAT" ||
          role === "PPK";

        if (
          isAdmin &&
          (lcTable.includes("verifikasi") ||
            lcTable.includes("selection") ||
            lcTable.includes("seleksi") ||
            lcTable.includes("assignment") ||
            lcTable.includes("penerima"))
        ) {
          void queryClient.invalidateQueries({
            predicate: (q) => {
              const k = q.queryKey;
              return (
                Array.isArray(k) &&
                k.length > 0 &&
                (String(k[0]).includes("admin") ||
                  String(k[0]).includes("selection") ||
                  String(k[0]).includes("verif") ||
                  String(k[0]).includes("assignment"))
              );
            },
          });
        }
      } catch {
      }
    };

    source.addEventListener("open", handleOpen);
    source.addEventListener("rt", handleRt as EventListener);

    return () => {
      try {
        source?.removeEventListener("open", handleOpen);
        source?.removeEventListener("rt", handleRt as EventListener);
      } catch {
      }
      try {
        source?.close();
      } catch {
      }
    };
  }, [auth, npsn, role, queryClient]);
}
