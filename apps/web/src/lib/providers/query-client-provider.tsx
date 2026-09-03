"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import * as idbKeyval from "idb-keyval";
import { useRef } from "react";

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60000,
        gcTime: 24 * 60 * 60 * 1000,
        retry: 2,
        refetchOnWindowFocus: true,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined = undefined;

function getQueryClient(): QueryClient {
  if (typeof window === "undefined") {
    return makeQueryClient();
  }
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}

declare global {
  interface Window {
    __queryClient?: QueryClient;
  }
  var __queryClient: QueryClient | undefined;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = useRef(getQueryClient()).current;

  if (typeof window !== "undefined") {
    try {
      (window as any).__queryClient = queryClient;
    } catch {
    }
    try {
      (globalThis as any).__queryClient = queryClient;
    } catch {
    }
  }

  const asyncPersister = createAsyncStoragePersister({
    storage: {
      getItem: (k: string) => idbKeyval.get(k),
      setItem: (k: string, v: string) => idbKeyval.set(k, v),
      removeItem: (k: string) => idbKeyval.del(k),
    },
    key: "saranasmk-rq-cache-v1",
  });

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: asyncPersister,
        maxAge: 24 * 60 * 60 * 1000,
      }}
      onSuccess={() => {
        try {
          queryClient.removeQueries({
            predicate: (query) =>
              typeof query.state.dataUpdatedAt === "number" &&
              query.state.dataUpdatedAt < Date.now() - 24 * 60 * 60 * 1000,
          });
        } catch {
        }
      }}
    >
      {children}
      {typeof process !== "undefined" && process.env?.NODE_ENV !== "production" ? (
        <ReactQueryDevtools initialIsOpen={false} />
      ) : null}
    </PersistQueryClientProvider>
  );
}
