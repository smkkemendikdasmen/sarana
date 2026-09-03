"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { z } from "zod";

import { API_URL, buildGetInit } from "@/lib/api";

const WseRespSchema = z.object({
  npsn: z.string().optional(),
  equipmentTables: z.record(z.string(), z.any()).default({}),
  version: z.number().int().default(1),
  updatedAt: z.string().nullish(),
  integritySha: z.string().nullish(),
});

export type WorkspaceEquipmentResp = z.infer<typeof WseRespSchema>;

export function useSchoolEquipment(
  npsn: string | null | undefined,
): UseQueryResult<WorkspaceEquipmentResp> {
  const enabled = !!npsn && npsn.length === 8;

  return useQuery({
    queryKey: ["wse", "detail", npsn] as const,
    enabled,
    staleTime: 1 * 60 * 1000,
    queryFn: async ({ signal }) => {
      const safeNpsn = encodeURIComponent(String(npsn ?? "").trim());
      const resp = await fetch(
        `${API_URL}/workspace-data/school/${safeNpsn}/equipment`,
        {
          ...buildGetInit(),
          signal,
        },
      );
      if (!resp.ok) {
        let msg = "Gagal mengambil data equipment.";
        try {
          const err = await resp.json();
          if (typeof err?.message === "string") msg = err.message;
          else if (Array.isArray(err?.message) && err.message.length) {
            msg = String(err.message[0]);
          }
        } catch {
        }
        throw new Error(msg);
      }
      const json = await resp.json();
      const envelope =
        typeof json === "object" && json !== null && "data" in json && typeof json.data === "object"
          ? (json.data as Record<string, unknown>)
          : json;
      const parsed = WseRespSchema.safeParse(envelope);
      if (!parsed.success) {
        throw new Error("Format respons data equipment tidak valid.");
      }
      return parsed.data;
    },
  });
}
