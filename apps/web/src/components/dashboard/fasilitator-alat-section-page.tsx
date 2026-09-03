"use client";

import { ChevronRight } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

type FacilitatorAlatSectionContent = {
  title: string;
  description: string;
  items: string[];
};

export function FacilitatorAlatSectionPage({
  eyebrow,
  content,
}: {
  eyebrow: string;
  content: FacilitatorAlatSectionContent;
}) {
  return (
    <div className="space-y-6">
      <section className="panel rounded-[32px] p-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary/70">{eyebrow}</p>
            <h1 className="display-font mt-3 text-3xl font-semibold text-slate-950">{content.title}</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 md:text-base">{content.description}</p>
          </div>
          <div className="rounded-[28px] border border-primary/10 bg-primary/[0.06] p-6">
            <p className="text-sm font-semibold text-primary">Fasilitator Alat</p>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              Halaman ini disiapkan untuk mendukung pendampingan sekolah, tindak lanjut lapangan, dan pemetaan kebutuhan alat.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        {content.items.map((item) => (
          <Card key={item} className="rounded-[28px]">
            <CardContent className="flex items-start justify-between gap-4 p-6">
              <div>
                <p className="text-lg font-semibold text-slate-950">{item}</p>
                <p className="mt-2 text-sm leading-7 text-slate-500">
                  Struktur halaman sudah siap dan bisa dilanjutkan ke tabel, form, serta alur kerja fasilitator alat.
                </p>
              </div>
              <span className="rounded-full border border-slate-200 bg-white p-2">
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </span>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
