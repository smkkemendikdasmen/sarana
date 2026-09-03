"use client";

export interface OnlyOfficePreparedConfig {
  storageKey: string;
  docserverApiJsUrl: string;
  config: {
    document: {
      fileType: string;
      key: string;
      title: string;
      url: string;
      permissions?: Record<string, boolean>;
    };
    documentType: "word" | "cell" | "slide";
    editorConfig: {
      callbackUrl: string;
      lang?: string;
      mode?: "edit" | "view";
      user?: { id: string; name: string };
      customization?: Record<string, boolean>;
    };
    height?: string;
    width?: string;
    type?: "desktop" | "mobile" | "embedded";
  };
}

const API_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/v1"
).replace(/\/$/, "");

function getBearerToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("prisma-session");
    if (!raw) return null;
    return JSON.parse(raw)?.token ?? null;
  } catch {
    return null;
  }
}

export async function onlyOfficePrepareEditor(q: {
  npsn: string;
  kind: string;
  userId?: string;
  userName?: string;
  editable?: boolean;
  applyPlaceholders?: boolean;
}): Promise<OnlyOfficePreparedConfig> {
  const token = getBearerToken();
  const params = new URLSearchParams();
  params.set("npsn", q.npsn);
  params.set("kind", q.kind);
  if (q.userId) params.set("userId", q.userId);
  if (q.userName) params.set("userName", q.userName);
  if (q.editable != null) params.set("editable", q.editable ? "1" : "0");
  if (q.applyPlaceholders != null)
    params.set("applyPlaceholders", q.applyPlaceholders ? "1" : "0");
  const url = `${API_URL}/onlyoffice/prepare-editor?${params.toString()}`;
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `ONLYOFFICE prepareEditor failed HTTP ${res.status} ${res.statusText} ${text}`.trim(),
    );
  }
  return (await res.json()) as OnlyOfficePreparedConfig;
}

export async function onlyOfficeReapplyPlaceholders(q: {
  npsn: string;
  kind: string;
}): Promise<{ storageKey: string; replaced: boolean; keys: number }> {
  const token = getBearerToken();
  const url = `${API_URL}/onlyoffice/reapply-placeholders`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(q),
  });
  if (!res.ok) {
    throw new Error(
      `ONLYOFFICE reapplyPlaceholders failed HTTP ${res.status} ${res.statusText}`,
    );
  }
  return (await res.json()) as { storageKey: string; replaced: boolean; keys: number };
}

export async function onlyOfficeDocxToHtml(storageKey: string): Promise<string> {
  const token = getBearerToken();
  const url = `${API_URL}/onlyoffice/docx-to-html?storageKey=${encodeURIComponent(storageKey)}`;
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    throw new Error(
      `ONLYOFFICE docxToHtml failed HTTP ${res.status} ${res.statusText}`,
    );
  }
  const data = (await res.json()) as { storageKey: string; html: string };
  return data.html ?? "";
}
