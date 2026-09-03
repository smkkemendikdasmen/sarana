"use client";

import { Eye, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  DocumentEditablePreview,
  type DocumentKind,
} from "@/components/shared/document-editable-preview";

/**
 * READONLY wrapper of DocumentEditablePreview.
 * Semua tombol edit, field input, upload, save = DISABLED / dihilangkan.
 * Cocok untuk menu "Review RPD dan PKS" (hanya preview hasil sekolah).
 */
export function DocumentReadonlyPreview(props: {
  schoolKey: string;
  schoolName: string;
  schoolNpsn: string;
  schoolProvince?: string;
  schoolCity?: string;
  schoolAddress?: string;
  kind: DocumentKind;
}) {
  return (
    <div className="space-y-4">
      <Card className="overflow-hidden rounded-[24px] border border-emerald-200 bg-gradient-to-br from-emerald-50/70 via-white to-white shadow-[0_1px_2px_rgba(16,185,129,0.05)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-100 bg-emerald-50/60 px-5 py-3.5">
          <div className="flex items-center gap-2 min-w-0">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] border border-emerald-200 bg-white text-emerald-700 shadow-sm">
              <Eye className="h-4.5 w-4.5" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-800">
                Mode Review · Read Only
              </p>
              <p className="text-sm font-semibold text-slate-900 truncate">
                Tidak dapat di-edit · Preview hasil pengisian dari sekolah
              </p>
            </div>
          </div>
          <Badge className="border border-emerald-200 bg-white text-emerald-700 text-[11px] font-semibold">
            <ShieldCheck className="mr-1 h-3.5 w-3.5" />
            Hanya Tinjauan
          </Badge>
        </div>
        <div className="[&_input]:!pointer-events-none [&_input]:!bg-slate-50/70 [&_input]:!text-slate-700 [&_textarea]:!pointer-events-none [&_textarea]:!bg-slate-50/70 [&_textarea]:!text-slate-700 [&_select]:!pointer-events-none [&_select]:!bg-slate-50/70 [&_select]:!text-slate-700 [&_button]:!hidden">
          <DocumentEditablePreview
            schoolKey={props.schoolKey}
            schoolName={props.schoolName}
            schoolNpsn={props.schoolNpsn}
            schoolProvince={props.schoolProvince ?? ""}
            schoolCity={props.schoolCity ?? ""}
            schoolAddress={props.schoolAddress}
            kind={props.kind}
          />
        </div>
      </Card>
    </div>
  );
}
