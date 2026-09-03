import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function angkaTerbilang(angka: number): string {
  if (angka === 0) return "Nol";
  const kata = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"];
  let n = angka;
  if (n < 12) return kata[n];
  if (n < 20) return `${angkaTerbilang(n - 10)} Belas`;
  if (n < 100) {
    const p = Math.floor(n / 10);
    const s = n % 10;
    return s === 0 ? `${kata[p]} Puluh` : `${kata[p]} Puluh ${kata[s]}`;
  }
  if (n < 200) return `Seratus ${angkaTerbilang(n - 100)}`;
  if (n < 1000) {
    const p = Math.floor(n / 100);
    const s = n % 100;
    return s === 0 ? `${kata[p]} Ratus` : `${kata[p]} Ratus ${angkaTerbilang(s)}`;
  }
  if (n < 2000) return `Seribu ${angkaTerbilang(n - 1000)}`;
  if (n < 1000000) {
    const p = Math.floor(n / 1000);
    const s = n % 1000;
    return s === 0 ? `${angkaTerbilang(p)} Ribu` : `${angkaTerbilang(p)} Ribu ${angkaTerbilang(s)}`;
  }
  if (n < 1000000000) {
    const p = Math.floor(n / 1000000);
    const s = n % 1000000;
    return s === 0 ? `${angkaTerbilang(p)} Juta` : `${angkaTerbilang(p)} Juta ${angkaTerbilang(s)}`;
  }
  if (n < 1000000000000) {
    const p = Math.floor(n / 1000000000);
    const s = n % 1000000000;
    return s === 0 ? `${angkaTerbilang(p)} Miliar` : `${angkaTerbilang(p)} Miliar ${angkaTerbilang(s)}`;
  }
  const p = Math.floor(n / 1000000000000);
  const s = n % 1000000000000;
  return s === 0 ? `${angkaTerbilang(p)} Triliun` : `${angkaTerbilang(p)} Triliun ${angkaTerbilang(s)}`;
}

export function formatRupiah(
  num: number,
  opts?: { symbol?: boolean; full?: boolean },
): string {
  const n = Math.max(0, Math.round(Number(num) || 0));
  const symbol = opts?.symbol !== false;
  const formatted = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
  if (opts?.full) {
    const terbilang = angkaTerbilang(n).trim();
    return `${symbol ? formatted : formatted.replace("Rp", "").trim()} (${terbilang} Rupiah)`;
  }
  return symbol ? formatted : formatted.replace("Rp", "").trim();
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let size = Number(bytes);
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i += 1;
  }
  return `${size.toFixed(size >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export function isImage(mime: unknown): boolean {
  return typeof mime === "string" && /^image\//i.test(mime);
}

export function isPdf(mime: unknown): boolean {
  return typeof mime === "string" && /application\/pdf/i.test(mime);
}

export function formatDateTime(d: Date | string | number | null | undefined): string {
  if (!d) return "—";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function compareConcentrationCode(a: string, b: string): number {
  const aSplit = String(a || "").split(".");
  const bSplit = String(b || "").split(".");
  const depth = Math.max(aSplit.length, bSplit.length);
  for (let i = 0; i < depth; i += 1) {
    const av = aSplit[i];
    const bv = bSplit[i];
    if (av === bv) continue;
    if (av == null) return -1;
    if (bv == null) return 1;
    const an = Number(av);
    const bn = Number(bv);
    if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
    return av.localeCompare(bv);
  }
  return 0;
}

export function concentrationNameOf(kk: { code?: string; name?: string; label?: string; displayName?: string } | null | undefined): string {
  if (!kk) return "";
  return kk.displayName || kk.label || kk.name || kk.code || "";
}
