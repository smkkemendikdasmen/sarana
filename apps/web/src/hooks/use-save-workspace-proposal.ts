"use client";

import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";
import { z } from "zod";

import { API_URL, buildJsonMutationInit } from "@/lib/api";

const WspUpdateReqSchema = z.object({
  npsn: z.string().length(8),
  version: z.number().int().min(1),
  data_json: z.record(z.string(), z.any()).default({}),
  data_sha256: z.string().optional(),
});

export type WspUpdateReqValues = {
  version: number;
  data_json: Record<string, unknown>;
  data_sha256?: string;
};

export function useSaveWorkspaceProposal(
  npsn: string,
): UseMutationResult<
  unknown,
  Error,
  WspUpdateReqValues,
  { prevSnapshot: unknown }
> {
  const queryClient = useQueryClient();
  const safeNpsn = encodeURIComponent(String(npsn ?? "").trim());
  const queryKey = ["wsp", "detail", npsn] as const;

  return useMutation({
    mutationFn: async (values: WspUpdateReqValues) => {
      const bodyValid = WspUpdateReqSchema.parse({ npsn, ...values });
      const resp = await fetch(
        `${API_URL}/workspace-data/school/${safeNpsn}/proposal`,
        buildJsonMutationInit("PUT", bodyValid),
      );
      if (resp.status === 409) {
        throw new Error("OPTIMISTIC_LOCK Version conflict");
      }
      if (!resp.ok) {
        let msg = "Gagal menyimpan data proposal.";
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
      return resp.json();
    },
    onMutate: async (newVals) => {
      await queryClient.cancelQueries({ queryKey });
      const prevSnapshot = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (old) => {
        const prev =
          old && typeof old === "object"
            ? (old as Record<string, unknown>)
            : undefined;
        const prevVersion =
          typeof prev?.version === "number" ? (prev.version as number) : 0;
        const prevDataJson =
          prev?.data_json && typeof prev.data_json === "object"
            ? (prev.data_json as Record<string, unknown>)
            : {};
        const mergedDataJson = { ...prevDataJson, ...(newVals?.data_json ?? {}) };
        return {
          ...(prev ?? {}),
          version: prevVersion + 1,
          data_json: mergedDataJson,
        };
      });
      return { prevSnapshot };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prevSnapshot !== undefined) {
        queryClient.setQueryData(queryKey, ctx.prevSnapshot);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });
}
