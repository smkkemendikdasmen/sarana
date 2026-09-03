"use client";
import { Suspense } from "react";
import { cn } from "@/lib/utils";

// Inline Skeleton Shimmer (tanpa dependency @/components/ui/skeleton yang TIDAK ADA di project!)
function Shimmer({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      aria-hidden
      className={cn(
        "relative overflow-hidden rounded-md bg-slate-100/80",
        className,
      )}
      style={style}
    >
      <div
        className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/70 to-transparent"
        style={{
          animationName: "shimmer",
          animationDuration: "1.5s",
          animationIterationCount: "infinite",
          transform: "translateX(-100%)",
        }}
      />
    </div>
  );
}

export function BodyTabSkeleton({ rows = 20 }: { rows?: number }) {
  return (
    <div className="space-y-4 rounded-[28px] border border-slate-200 bg-white p-4">
      <div className="space-y-2">
        <Shimmer className="h-8 w-2/3 rounded-lg" />
        <Shimmer className="h-5 w-1/2 rounded-md" />
      </div>
      <div className="space-y-2 rounded-2xl border border-slate-200 p-3">
        <div className="flex gap-2 overflow-x-auto">
          {Array.from({ length: 6 }).map((_, i) => (
            <Shimmer key={i} className="h-10 w-28 shrink-0 rounded-full" />
          ))}
        </div>
      </div>
      <div className="rounded-2xl border border-slate-200">
        <div className="grid grid-cols-7 gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <Shimmer key={i} className="h-4 w-20 rounded" />
          ))}
        </div>
        <div className="divide-y divide-slate-200 px-4 py-3">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className={cn("grid grid-cols-7 gap-2 py-2", i % 2 === 0 && "bg-slate-50/40")}>
              <Shimmer className="h-4 w-10 rounded" />
              <Shimmer className="h-4 col-span-2 rounded" />
              <Shimmer className="h-4 w-16 rounded" />
              <Shimmer className="h-4 w-14 rounded" />
              <Shimmer className="h-4 w-12 rounded" />
              <Shimmer className="h-4 w-24 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export const DetailTabLazyWrap = ({
  active,
  children,
  skeletonRows = 20,
}: {
  active: boolean;
  children: React.ReactNode;
  skeletonRows?: number;
}) => {
  if (!active) return null;
  return <Suspense fallback={<BodyTabSkeleton rows={skeletonRows} />}>{children}</Suspense>;
};
