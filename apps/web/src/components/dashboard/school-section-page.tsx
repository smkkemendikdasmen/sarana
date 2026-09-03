import { ChevronRight, FileCheck2 } from "lucide-react";

import { schoolPageContent } from "@/lib/dashboard-content";

type SchoolSectionKey = keyof typeof schoolPageContent;

export function SchoolSectionPage({ section }: { section: SchoolSectionKey }) {
  const content = schoolPageContent[section];

  return (
    <div className="space-y-6">
      <section className="panel rounded-[32px] p-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary/70">
              Workspace Sekolah
            </p>
            <h1 className="display-font mt-3 text-3xl font-semibold text-slate-950">{content.title}</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 md:text-base">
              {content.description}
            </p>
          </div>
          <div className="rounded-[28px] border border-primary/10 bg-primary/[0.06] p-6">
            <div className="flex items-center gap-3 text-primary">
              <FileCheck2 className="h-5 w-5" />
              <p className="text-sm font-semibold">Tahap awal sudah siap</p>
            </div>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              Halaman ini sudah dibuat sebagai fondasi modul sekolah dan siap dihubungkan ke data riil, validasi, serta alur bisnis berikutnya.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        {content.items.map((item) => (
          <article key={item} className="panel rounded-[28px] p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="display-font text-lg font-semibold text-slate-950">{item}</h2>
                <p className="mt-2 text-sm leading-7 text-slate-500">
                  Komponen, tabel, dan proses detail untuk modul ini siap diperluas di iterasi berikutnya.
                </p>
              </div>
              <span className="rounded-full border border-slate-200 bg-white p-2">
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </span>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
