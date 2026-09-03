"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu, PanelLeftClose, PanelLeftOpen, ScrollText, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useRealtimeInvalidate } from "@/hooks/use-realtime-invalidate";
import { dashboardPath, navigationByRole, roleLabels } from "@/lib/roles";
import { APP_VERSION } from "@/lib/version";
import { useAuthStore } from "@/store/auth-store";

interface WorkspaceShellProps {
  children: React.ReactNode;
}

export function WorkspaceShell({ children }: WorkspaceShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { hydrate, hydrated, logout, session } = useAuthStore();
  const [compact, setCompact] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useRealtimeInvalidate();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    if (!session) {
      router.replace("/login");
      return;
    }

    if (session.mustChangePassword === true) {
      router.replace("/login");
      return;
    }

    if (pathname === "/") {
      router.replace(dashboardPath(session.user.role));
    }
  }, [hydrated, pathname, router, session]);

  useEffect(() => {
    if (mobileOpen && typeof document !== "undefined") {
      document.body.style.overflow = "hidden";
    }
    return () => {
      if (typeof document !== "undefined") {
        document.body.style.overflow = "";
      }
    };
  }, [mobileOpen]);

  const navItems = useMemo(
    () => (session ? navigationByRole[session.user.role] : []),
    [session],
  );

  if (!hydrated || !session || session.mustChangePassword === true) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="rounded-xl border border-slate-200 bg-white px-8 py-6 text-sm text-slate-600 shadow-sm">
          Menyiapkan workspace SARANA SMK...
        </div>
      </div>
    );
  }

  const initials = session.user.fullName
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const headerGreeting = `Selamat Datang ${roleLabels[session.user.role].toUpperCase()}`;
  const headerUserName = session.user.fullName.replace(/\s+(PRISMA|SARANA\s*SMK)$/i, "").trim();

  const SidebarContent = ({ onNavigate }: { onNavigate?: () => void }) => (
    <>
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-3 pb-5">
        <div className={compact ? "hidden" : "block"}>
          <h1 className="display-font mt-1 text-2xl font-semibold text-slate-950">SARANA SMK</h1>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            onClick={() => setCompact((value) => !value)}
            variant="ghost"
            size="icon"
            aria-label="Ubah ukuran sidebar"
            className="hidden lg:inline-flex"
          >
            {compact ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </Button>
          <Button
            type="button"
            onClick={() => setMobileOpen(false)}
            variant="ghost"
            size="icon"
            aria-label="Tutup menu"
            className="lg:hidden"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <nav className="mt-6 flex-1 space-y-2">
        {navItems.map((item, index) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          const previousGroup = index > 0 ? navItems[index - 1]?.group : undefined;
          const showGroupLabel = item.group && item.group !== previousGroup;

          return (
            <div key={item.href} className="space-y-2">
              {showGroupLabel ? (
                <p
                  className={`px-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400 ${
                    compact ? "hidden" : "block"
                  }`}
                >
                  {item.group}
                </p>
              ) : null}
              <Link
                href={item.href}
                onClick={() => {
                  if (onNavigate) onNavigate();
                }}
                className={`flex items-center gap-3 rounded-md px-4 py-3 text-sm font-medium transition ${
                  active
                    ? "border border-accent/20 bg-accent-soft text-primary shadow-sm"
                    : "border border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className={compact ? "hidden" : "inline"}>{item.label}</span>
              </Link>
            </div>
          );
        })}
      </nav>

      <div className="mt-6 border-t border-slate-200 pt-4">
        {session && (session.user.role === "ADMIN" || session.user.role === "SUPERADMIN") ? (
          <div className="space-y-2">
            <Link
              href="/admin/audit-log"
              onClick={() => {
                if (onNavigate) onNavigate();
              }}
              className={`flex items-center gap-3 rounded-md px-4 py-2.5 text-sm font-medium transition ${
                pathname === "/admin/audit-log"
                  ? "border border-accent/20 bg-accent-soft text-primary shadow-sm"
                  : "border border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-950"
              }`}
            >
              <ScrollText className="h-4 w-4 shrink-0" />
              <span className={compact ? "hidden" : "inline"}>Audit Log Perubahan</span>
            </Link>
            <div
              className={`px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-slate-400 ${compact ? "hidden" : "block"}`}
            >
              <span className="font-semibold text-slate-500">Versi</span>{" "}
              <span className="font-mono text-slate-600">v{APP_VERSION}</span>
            </div>
          </div>
        ) : (
          <div className={`px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-slate-400 ${compact ? "hidden" : "block"}`}>
            <span className="font-semibold text-slate-500">SARANA SMK · Versi</span>{" "}
            <span className="font-mono text-slate-600">v{APP_VERSION}</span>
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {mobileOpen ? (
        <div
          className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[268px] flex-col border-r border-slate-200 bg-white px-4 py-5 shadow-xl transition-transform duration-300 lg:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-hidden={!mobileOpen}
      >
        <SidebarContent onNavigate={() => setMobileOpen(false)} />
      </aside>

      <div className="p-4 md:p-6">
        <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-[1440px] gap-4 lg:grid-cols-[auto_minmax(0,1fr)]">
          <aside
            className={`hidden rounded-xl border border-slate-200 bg-white px-4 py-5 shadow-sm transition-all duration-300 lg:flex lg:flex-col ${
              compact ? "w-[96px]" : "w-[268px]"
            }`}
          >
            <SidebarContent />
          </aside>

          <main className="space-y-4">
            <Card>
              <CardContent className="flex flex-col gap-4 px-4 py-4 sm:px-6 sm:py-5 md:flex-row md:items-center md:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setMobileOpen(true)}
                    aria-label="Buka menu"
                    className="shrink-0 lg:hidden"
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                  <h2 className="min-w-0 truncate display-font text-lg font-semibold text-slate-950 sm:text-2xl">
                    {headerGreeting}
                  </h2>
                </div>

                <div className="flex flex-wrap items-center justify-start gap-3 sm:justify-end">
                  <div className="hidden rounded-md border border-slate-200 bg-white px-3 py-2 text-right sm:block sm:px-4 sm:py-3">
                    <p className="truncate text-sm font-semibold text-slate-900">{headerUserName}</p>
                  </div>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white sm:h-11 sm:w-11">
                    {initials}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      logout();
                      router.replace("/login");
                    }}
                    aria-label="Keluar"
                  >
                    <LogOut className="h-5 w-5" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div>{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
