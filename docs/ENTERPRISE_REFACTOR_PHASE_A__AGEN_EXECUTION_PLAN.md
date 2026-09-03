# ==============================================================================
#  SARANASMK — ENTERPRISE REFACTOR PHASE A
#  AGEN EXECUTION PLAYBOOK (READ ONLY UNTUK AGEN)
#  TANGGAL: 2026-08-31 | SCOPE: LOKAL ONLY — 0% MODIFIKASI LIVE SERVER 103.160.202.73
# ==============================================================================

## 🚨 ATURAN EKSEKUSI AGEN (WAJIB DIPATUHI SEBELUM APAPUN)
1. **URUTAN FASE WAJIB 0 → A10**, TIDAK BOLEH LONCAT FASE.
2. **STOP TOTAL & REPORT** jika di salah satu fase Acceptance Criteria (AC) tidak terpenuhi. Jangan dipaksa lanjut.
3. **VERIFY RC=0** setiap build command. Setiap fase memiliki AC numeric EXIT / stdout yang BISA dibandingkan literal.
4. **LIVE SERVER 103.160.202.73 = ABSOLUT DILARANG DIUBAH APAPUN.** Hanya kerja di lokal /Users/ilahilah/Documents/Project/PRISMA/saranasmk.
5. **JANGAN hapus permanen apapun.** File pindahkan ke `__ARCHIVE_LEGACY_20260831__/TREE_REFACTOR_PHASE_A_<STAMP>/` preserve relative path jika diinstruksikan.

---

# ------------------------------------------------------------------------------
#  PART 0 — EVALUASI BEFORE REFACTOR (ACUAN AGEN APA YANG BAGUS & BURUK)
# ------------------------------------------------------------------------------

## 🟢 0.1 apps/api (NestJS) — YANG SUDAH OK & DIPERTAHANKAN
- RLS SET LOCAL via NestJS CLS v5 context per request ✅
- JWT claim npsn + role inject via JWTAuthGuard ✅
- Redis tryGetOrFallback circuit breaker service ✅
- PgNotifyListener 12 LISTEN channels → Redis PubSub bridge ✅
- Umzug v3 migration runner idempotent ✅
- 4 SECURITY DEFINER helper PostgreSQL RLS scope ✅

## 🔴 0.2 apps/api (NestJS) — KEKURANGAN ENTERPRISE YANG WAJIB DI-FIX FASE INI
| # | Issue Enterprise Cost | Lokasi |
|---|---|---|
| AP1 | TIDAK ADA Health Check endpoint `/health` (deploy_canary.sh butuh HTTP 200 curl health slot threshold 95%) | apps/api belum punya controller health |
| AP2 | TIDAK ADA Global Exception Filter Nest → user error DB / 404 / 400 = stack trace HTML error Nest default, bukan JSON standard | app.module |
| AP3 | TIDAK ADA ValidationPipe global DTO → input user payload tidak disanitasi zod/class-validator sebelum masuk service → bisa injection string > DB column length | main.ts bootstrap |
| AP4 | TIDAK ADA Throttler Guard Login endpoint → brute force 1000x percobaan password bisa | auth.controller |
| AP5 | Response body tidak wrap standard → setiap controller return beda format → FE susah buat generic hook → cost tinggi tambah fitur | semua controller |
| AP6 | TIDAK ADA API Version Prefix /v1 → suatu hari breaking change API v2 tidak bisa parallel deploy | main.ts |
| AP7 | DTO interface types hanya ada di apps/api, apps/web menulis ulang DTO manual di lib/api.ts → BOM WAKTU types drift (FE field A, BE field B = runtime NaN error user) | apps/api vs apps/web lib/api.ts |

## 🟢 0.3 apps/web (Next 15 App Router) — YANG SUDAH OK & DIPERTAHANKAN
- Role-based Route Group App Router `/<ROLE>/...` ✅
- Page Server Component default → JS kecil untuk user SEKOLAH ✅
- SSE `/api/realtime/stream` scope npsn/table/global ✅
- api.ts client request dedup via InFlight Promise Map + multi TTL tier ✅
- Component slicing per role (admin/ vs school/) ✅

## 🔴 0.4 apps/web (Next.js) — KEKURANGAN ENTERPRISE YANG WAJIB DI-FIX
| # | Issue Enterprise Cost | Lokasi |
|---|---|---|
| FE1 | TanStack/SWR Query = TIDAK ADA. Caching cuma Map memory → tab reload = hilang semua, spamming BE PostgreSQL Redis | lib/api.ts |
| FE2 | Tidak ada Mutation Optimistic Update + Background Revalidate + Auto Retry network rural → save user loading spinner berkedip, gagal tanpa retry | semua save handler |
| FE3 | Realtime SSE event tidak wired auto-invalidate cache FE → FASIL save review, SEKOLAH harus F5 manual, padahal SSE payload sudah sampai! | /api/realtime/stream + components |
| FE4 | Tidak ada Form Stack Standard (react-hook-form + zod) → tiap page bikin state sendiri, user close tab navigate tidak ada dirty confirm "simpan dulu?" → kehilangan 30 menit input user sekolah complaint mahal | semua form save |
| FE5 | Schema validasi tidak single source. FE tidak tahu batas char 255. BE reject error 500. | FE forms |
| FE6 | Tidak ada Global Error Boundary Next App Router → runtime React error = layar PUTIH, user WA screenshot tanpa stack trace. | app/ |
| FE7 | Store auth zustand belum ada refresh token rotation middleware. Token 15 menit user logout paksa. | store/auth-store.ts |
| FE8 | Junk file legacy .bak masih ada di components folder → bingung developer baru | school-proposal-page.tsx.bak |

---

# ------------------------------------------------------------------------------
#  PART 1 — FASE EKSEKUSI REFACTOR ENTERPRISE (URUT 0 s/d 10)
# ------------------------------------------------------------------------------

## ═══════════════════════════════════════════════════════════════════════════
## FASE 0 — PERSIAPAN & FROZEN BASELINE SNAPSHOT
## ═══════════════════════════════════════════════════════════════════════════
**TUJUAN:** Simpan state SEBELUM refactor. Jika gagal total, rollback kembali ke sini.
**URUTAN PERINTAH AGEN:**
1. Buat timestamp STAMP=$(date +%Y%m%d_%H%M%S)
2. ARCHIVE_SUB=__ARCHIVE_LEGACY_20260831__/TREE_REFACTOR_PHASE_A_BASELINE_${STAMP}
3. Copy seluruh: apps/api/src + apps/web/src + apps/api/package.json + apps/web/package.json + apps/api/tsconfig.json + apps/web/tsconfig.json + root package.json ke ARCHIVE_SUB preserve relative path. Jangan pindah, copy (cp -R).
4. Buat snapshot root package-lock.json SHA256 → simpan ke ${ARCHIVE_SUB}/pre_refactor_package-lock.sha256
5. JALANKAN SMOKE TEST BUILD BASELINE (harus PASS — jika FAIL, berhenti report ke user dulu):
   - cd apps/api && npx tsc --noEmit  (AC: EXIT 0)
   - cd apps/web && npx next build (AC: EXIT 0, dan stdout last line = route summary ○ static + ƒ dynamic)
6. Record 2 baseline exit code ke ${ARCHIVE_SUB}/baseline_rc.log (format: API_TSC_RC=0, NEXT_BUILD_RC=0)
**ACCEPTANCE CRITERIA (AC0):** cp -R tanpa error, baseline_rc.log 2 baris = 0 semua, next build 60+ routes tercompile.

---

## ═══════════════════════════════════════════════════════════════════════════
## FASE 1 — MONOREPO PACKAGES LAYER: shared-types package + Turborepo Pipeline
## ═══════════════════════════════════════════════════════════════════════════
**TUJUAN:** Satu DTO untuk API & WEB. Hilangkan types drift bomb biaya tinggi runtime.
**URUTAN PERINTAH:**
1. ROOT npm install **TURBOREPO** global di devDependencies: `npm install --save-dev turbo@^2`
2. Buat FOLDER root `packages/` (jika belum ada).
3. Buat subfolder: `packages/shared-types/` dengan struktur:
   ```
   packages/shared-types/
     package.json          (name="@saranasmk/shared-types", version="0.1.0", types="./src/index.ts", exports: { ".": "./src/index.ts" }, peer deps zod ^3)
     tsconfig.json         (strict, target ES2022, module Bundler, declaration: true, noEmit: true)
     src/
       index.ts            (re-export SEMUA modul dibawah)
       branded-types.ts    (export type NpsnChar8 = string & { __brand: 'NPSN_CHAR8' } , type UserRoleCode, dll BRANDED types)
       auth.dto.ts         (export LoginReqSchema: z.object(username+password), LoginRespSchema { ok:boolean, token, claims:{npsn,role,user_id}, AuthClaimsSchema + infer types z.infer )
       wsp.dto.ts          (export WspUpdateReqSchema { npsn:NpsnChar8, version:number.int, data_json:z.record(z.any), data_sha256?:string }, WspRespSchema, OptimisticLockErrSchema { code: 'OPTIMISTIC_LOCK', expected_version, current_version }  + z.infer types)
       wse.dto.ts          (export WseUpdateReqSchema, WseRespSchema simetri wsp.dto.ts + z.infer)
       assignment.dto.ts   (export AssignmentDTO schema)
       health.dto.ts       (export HealthRespSchema { ok:z.literal(true), slot?:string, ts:z.string().datetime(), uptimeMs:z.number().int, memRssMb:z.number() })
       api-wrapper.dto.ts  (export ApiOkRespSchema<T> = z.object({ ok: z.literal(true), data: T, traceId: z.string(), ts: z.string().datetime() }), ApiErrRespSchema { ok:false, error:{ code, message, traceId, statusCode } } standard envelope)
   ```
4. Tambah 2 path mapping di **apps/api/tsconfig.json** "compilerOptions" -> "paths": {
       "@saranasmk/shared-types": ["../../packages/shared-types/src/index.ts"],
       "@saranasmk/shared-types/*": ["../../packages/shared-types/src/*"]
   }
5. Tambah path mapping yang **SAMA PERSIS** di **apps/web/tsconfig.json** "compilerOptions" -> "paths"
6. Tambahkan juga baseUrl: "." jika belum ada, dan moduleResolution: "bundler".
7. Buat root file **turbo.json** dengan pipeline tasks:
   ```jsonc
   {
     "$schema": "https://turbo.build/schema.json",
     "tasks": {
       "build": { "dependsOn": ["^build"], "outputs": ["dist/**", ".next/**", "!.next/cache/**"] },
       "typecheck": { "dependsOn": ["^typecheck"] },
       "lint": { "outputs": [] },
       "dev": { "cache": false, "persistent": true }
     }
   }
   ```
8. Tambah di masing-masing workspace package.json scripts:
   - apps/api/package.json "typecheck": "tsc --noEmit"
   - apps/web/package.json "typecheck": "tsc --noEmit"
   - packages/shared-types/package.json "typecheck": "tsc --noEmit"
9. Ubah root package.json scripts: tambah 3 script: `"typecheck": "turbo run typecheck"`, `"build:all": "turbo run build"`, `"lint:all": "turbo run lint"`. Tambahkan "workspaces" jika monorepo workspaces mau native npm workspace (optional, default ok).
10. Smoke TEST packages shared-types: cd packages/shared-types && npx tsc --noEmit (RC=0)
**ACCEPTANCE CRITERIA (AC1):**
- ls packages/shared-types/src/ = tepat 7 files ts + 1 index (total 8)
- apps/api & apps/web tsconfig "paths" kedua tsconfig.json -> literal string "@saranasmk/shared-types" MATCH both
- npx tsc --noEmit di packages/shared-types EXIT 0

---

## ═══════════════════════════════════════════════════════════════════════════
## FASE 2 — INSTALL DEPENDENCIES CORE REFACTOR (TANPA IMPLEMENTASI)
## ═══════════════════════════════════════════════════════════════════════════
**TUJUAN:** Semua npm package yang dibutuhkan refactor terinstall. Tidak mengubah kode source logic dulu.
**URUTAN PERINTAH:**
1. INSTALL APPS/API (NestJS side — run di folder apps/api, --save / --save-dev benar):
   - PROD dependencies: @nestjs/throttler @nestjs/swagger class-validator class-transformer @nestjs/terminus @nestjs/axios zod
   - DEV dependencies: @nestjs/schematics @types/node terupdate
2. INSTALL APPS/WEB (Next side — run di folder apps/web):
   - PROD: @tanstack/react-query @tanstack/react-query-devtools @tanstack/react-query-persist-client @tanstack/query-sync-storage-persister idb-keyval react-hook-form @hookform/resolvers zod
   - DEV: (tidak perlu tambahan)
3. Setelah semua install SUCCESS (RC=0 npm install), RUN LAGI baseline typecheck verify aman:
   - apps/api tsc --noEmit (RC=0)
   - apps/web next build (RC=0)
   (Jika keduanya masih 0, dependency aman. Ada error = revert package.json dari FASE0 snapshot, laporkan.)
**ACCEPTANCE CRITERIA (AC2):**
- grep "@tanstack/react-query" apps/web/package.json dependencies EXIST true, version major ^5.
- grep "@nestjs/throttler" apps/api/package.json dependencies EXIST true.
- Dua typecheck EXIT 0.

---

## ═══════════════════════════════════════════════════════════════════════════
## FASE 3 — REFACTOR apps/api ENTERPRISE STACK (Issue AP1–AP7)
## ═══════════════════════════════════════════════════════════════════════════
**TUJUAN:** NestJS production grade. Health endpoint OK untuk deploy_canary.sh threshold 95% 2xx.
**URUTAN PERINTAH (JALAN berurutan, setiap step verify tsc RC=0, tsc apps/api):**

### STEP 3.1 — Common HTTP Layer (ResponseIntercept + ExceptionFilter + ValidationPipe)
1. Buat FOLDER BARU `apps/api/src/common/http/` TEPAT berisi 4 files:
   - `index.ts` (re-export semua)
   - `response.interceptor.ts` — Nest Injectable NestInterceptor, intercept execution, tap next.handle() map ke { ok:true, data:payload, traceId: ambil dari CLS req.id, ts: new Date().toISOString() }
   - `all-exceptions.filter.ts` — Catch(ExceptionFilter) HttpException + generic Error, catch dan return JSON { ok:false, error:{ code, message, traceId, statusCode } } via ArgumentsHost switchToHttp getResponse. Jangan expose stack trace production.
   - `zod-validation.pipe.ts` (atau LEBIH BAIK pakai Nest ValidationPipe global dengan class-validator. Kita PAKAI ValidationPipe official.)
2. Di `apps/api/src/main.ts` bootstrap() — SEBELUM app.listen register sequence WAJIB:
   a) app.enableCors({ origin: true, credentials: true })
   b) app.setGlobalPrefix("v1")
   c) app.useGlobalPipes(new ValidationPipe({ whitelist:true, forbidNonWhitelisted: true, transform:true, stopAtFirstError: false }))
   d) app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)), new ResponseInterceptor())
   e) app.useGlobalFilters(new AllExceptionsFilter())
   f) SwaggerModule setup DocumentBuilder setTitle 'SARANASMK Enterprise API v1' setVersion '1.0' addBearerAuth() build → app.useGlobalPrefix → SwaggerModule.setup('/v1/docs', app, document)
   g) Root Update env default NEXT_PUBLIC_API_BASE_URL fallback di apps/web lib/api.ts dari "/api/v1" KINI SUDAH COCOK dengan prefix.

### STEP 3.2 — Terminus Health Check Module
1. Apps/api buat folder `src/health/` berisi `health.controller.ts` + `health.module.ts`
   - @Controller() (NO PREFIX, JANGAN /v1/health, route HEALTH = GET "/health" AGAR deploy_canary.sh curl port 4000/health langsung 200).
   - Inject HealthCheckService + import TypeOrmHealthIndicator / atau custom check: MemoryRSSIndicator (process.memoryUsage().rss MB) dan UptimeIndicator process.uptime() seconds. Return schema sesuai @saranasmk/shared-types HealthRespSchema (ok:true, slot process.env.SLOT ?? 'blue', ts ISO, uptimeMs: uptime*1000 int, memRssMb number).
2. Import HealthModule.register({}) di app.module.ts imports array.

### STEP 3.3 — Throttler Anti Brute Force Login
1. Apps/api app.module imports: ThrottlerModule.forRoot([{ ttl: 60000, limit: 20 }])
2. Apps/api/src/auth/auth.controller.ts POST /login endpoint decorator tambah @Throttle({ default: { limit: 5, ttl: 60000 } }) (5x login gagal 60 detik lock per IP)

### STEP 3.4 — DTO SHARED IMPORT Critical Files (5 files DULU)
Ganti DTO di lokasi ini menjadi IMPORT dari @saranasmk/shared-types zod infer (atau class-validator DTO convert jika perlu). Utamakan paling sering dipanggil duluan:
1. auth/login.dto.ts
2. workspace-data.dto.ts (untuk /workspace-data/school/* controller)
3. users/users.dto.ts
4. school-profile/school-profile.dto.ts
5. cp-fase-f/cp-fase-f.dto.ts

### STEP 3.5 — VERIFY
- Run apps/api `npx tsc --noEmit` (RC=0).
- Grep literal: setGlobalPrefix('v1') di main.ts EXIST.
- Grep useGlobalFilters EXIST.
- Grep Throttle login auth.controller.ts EXIST.
- ls apps/api/src/health/health.controller.ts exist = true
**ACCEPTANCE CRITERIA (AC3):** tsc RC=0, 5 sub step folder exist sesuai, grep 4 keywrod match.

---

## ═══════════════════════════════════════════════════════════════════════════
## FASE 4 — REFACTOR apps/web TANSTACK QUERY v5 CLIENT PROVIDER + PERSIST
## ═══════════════════════════════════════════════════════════════════════════
**TUJUAN:** Ganti Map<> memory cache → TanStack Query v5 + IndexedDB Persist Survive tab reload.
**URUTAN PERINTAH:**

### STEP 4.1 Query Client Root Provider Persistent IndexedDB
1. Buat folder `apps/web/src/lib/providers/`.
2. Buat file TEPAT: `apps/web/src/lib/providers/query-client-provider.tsx`
   - "use client"; top directive.
   - Import createSyncStoragePersister from @tanstack + idbKeyval dari idb-keyval
   - const makeQueryClient = () => new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, gcTime: 24*60*60*1000, retry: 2, refetchOnWindowFocus:true }, mutations: { retry:0 } } })
   - Component provider dalamnya: PersistQueryClientProvider client={queryClient} persister={createSyncStoragePersister({storage: idbKeyval wrap? No, pakai @tanstack/query-async-storage-persister JIKA idb async — BETUL: pakai Async Persister, create IDBKeyValStorage adapter wrap idb-keyval get/set/removeItem), maxAgeMs=24*60*60*1000}}
   - Import TanStack Query Devtools HANYA jika process.env.NODE_ENV !== 'production' -> dynamic import atau conditional render.
   - Bungkus children dalam return element.
3. Inject provider ini di ROOT APPS LAYOUT `apps/web/src/app/layout.tsx` TEPAT setelah <body> tag dan sebelum semua anak children lain (wrap semua children JSX). Pastikan layout.tsx import client provider wrapped with "use client" or make inner component. (Kalau layout server component: buat client wrapper "Providers.tsx" client component lalu import server component ke app/layout.tsx children inside body.)

### STEP 4.2 HAPUS Map<> cache di apps/web/src/lib/api.ts
1. Buka file: apps/web/src/lib/api.ts
2. HAPUS SEMUA lines yang merujuk clientGetCache (variable declaration, const clientGetCache Map, evictClientCacheIfNeeded function, semua clientGetCache.set() / .get() / .has() di getWithCache wrapper function).
3. TAPI **JANGAN HAPUS clientGetInFlight Promise Map!** biarkan tetap ada untuk dedup concurrent request SERVER SIDE / middleware sebelum react query kick in. Atau simpel: delete TOTAL semua lines yang kata clientGetCache dan evictClientCacheIfNeeded.
4. Simpan file api.ts.

### STEP 4.3 Verify FASE 4
- apps/web npx tsc --noEmit RC=0.
- apps/web next build RC=0.
- grep QueryClient apps/web/src/lib/providers/query-client-provider.tsx exist true.
- grep clientGetCache apps/web/src/lib/api.ts COUNT lines = 0 (dihabisin).
**ACCEPTANCE CRITERIA (AC4):** 4 check above ALL PASS.

---

## ═══════════════════════════════════════════════════════════════════════════
## FASE 5 — STANDARD LIBRARY HOOKS (4 hook CRITICAL utama shared)
## ═══════════════════════════════════════════════════════════════════════════
**TUJUAN:** Semua page tinggal import hook useWorkspaceProposal, TIDAK USAH handle loading error cache dedup retry manual.
**URUTAN PERINTAH:**

Buat FOLDER BARU `apps/web/src/hooks/` dengan ISI 4 files EXACT:

1. **hooks/use-workspace-proposal.ts**
   - Export function `useWorkspaceProposal(npsn: NpsnChar8 | null | undefined)`
   - Import WspRespSchema dari @saranasmk/shared-types, useQuery @tanstack/react-query
   - const { data, ...rest } = useQuery({
       queryKey: ["wsp", "detail", npsn] as const,
       enabled: !!npsn && npsn.length === 8,
       queryFn: async ({ signal }) => {
         const resp = await fetch(`${API_URL}/workspace-data/school/${npsn}/proposal`, { ...buildGetInit(), signal });
         const json = await resp.json();
         const parsed = WspRespSchema.safeParse(json);
         if (!parsed.success) throw new Error('Invalid WSP response payload');
         return parsed.data.data ?? parsed.data; // sesuai wrapper envelope ApiOkResp atau raw
       },
       staleTime: 1 * 60 * 1000,
     });
   - Return default useQuery.

2. **hooks/use-save-workspace-proposal.ts**
   - Export `useSaveWorkspaceProposal(npsn)`: useMutation + optimistik update.
   - useMutationContext:
     - mutationFn: async (values) => {
         const bodyValid = WspUpdateReqSchema.parse({ npsn, ...values });
         const resp = await fetch(`${API_URL}/workspace-data/school/${npsn}/proposal`, buildJsonMutationInit('PUT', bodyValid));
         if (resp.status === 409) throw new OptimisticLockError('Version conflict please refresh');
         const j = await resp.json(); return j;
       }
     - onMutate: async (newVals) => {
         await queryClient.cancelQueries({ queryKey: ["wsp","detail",npsn] });
         const prev = queryClient.getQueryData(["wsp","detail",npsn]);
         queryClient.setQueryData(["wsp","detail",npsn], (old) => ({ ...old, version: (old?.version ?? 0)+1, data_json:{ ...old?.data_json, ...newVals?.data_json } }));
         return { prevSnapshot: prev }
       }
     - onError: (_err, _vars, ctx) => ctx?.prevSnapshot !== undefined && queryClient.setQueryData(["wsp","detail",npsn], ctx.prevSnapshot)
     - onSettled: () => queryClient.invalidateQueries({ queryKey: ["wsp","detail", npsn] })

3. **hooks/use-school-equipment.ts** (symetri useWorkspaceProposal for WSE table, queryKey ["wse","detail",npsn], endpoint `/workspace-data/school/${npsn}/equipment`)

4. **hooks/use-auth-session.ts** (return AuthClaims parsed zod safeParse from localStorage prisma-session key, return { session, npsn, role, userId } or null)

### 5.5 VERIFY FASE 5
- apps/web `npx tsc --noEmit` EXIT 0
- ls apps/web/src/hooks/ count files = 4 .ts files sesuai nama di atas
**ACCEPTANCE CRITERIA (AC5):** tsc RC=0, 4 file hooks exist.

---

## ═══════════════════════════════════════════════════════════════════════════
## FASE 6 — WIRE REALTIME SSE → AUTO INVALIDATE TANSTACK QUERIES (Issue FE3!)
## ═══════════════════════════════════════════════════════════════════════════
**TUJUAN:** Bila FASIL save review SEKOLAH di browser A, browser B login SEKOLAH OTOMATIS refresh data TANPA user tekan F5. Ini most value untuk user.
**URUTAN PERINTAH:**
1. Buat file `apps/web/src/hooks/use-realtime-invalidate.ts` ("use client"):
   - Ambil npsn & role dari useAuthSession()
   - Inside useEffect(() => { new EventSource(`/api/realtime/stream?scope=table&npsn=${npsn}&role=${role}`) })
   - EventSource.addEventListener('open') log ready
   - EventSource.addEventListener('rt', (ev) => try parse JSON, if payload.data.table === 'workspace_school_proposal_data' && npsn === payload.data.npsn → queryClient.invalidateQueries queryKey wsp; else if equipment → invalidate wse; admin global → invalidate list queries)
   - Cleanup source.close() on unmount via cleanup useEffect return.
2. Mount PANGGIL hook useRealtimeInvalidate() DI COMPONENT `apps/web/src/components/layout/workspace-shell.tsx` (supaya seluruh route group workspace auto subscribe TANPA harus mount disetiap page 100x!).
3. Verify apps/web tsc RC=0.
**ACCEPTANCE CRITERIA (AC6):** tsc RC=0, grep useRealtimeInvalidate workspace-shell.tsx EXIST line match = true.

---

## ═══════════════════════════════════════════════════════════════════════════
## FASE 7 — FORM STANDARD RHF + ZOD: REFACTOR 1 HALAMAN CRITICAL (sekolah save sarana)
## ═══════════════════════════════════════════════════════════════════════════
**TUJUAN:** 1x buat pola, tinggal copy paste untuk semua 20+ form lain nanti. JANGAN refactor SEMUA form — overload agen. CUKU 1 PAGE CONTOH PERMANEN.
**TARGET PAGE EXACT:** `apps/web/src/components/school/school-proposal-sarana-page.tsx`
**URUTAN PERINTAH:**

1. TOP imports page tsx tambah 5 lines: useForm from react-hook-form; zodResolver from @hookform/resolvers/zod; WspUpdateReqSchema from @saranasmk/shared-types; useSaveWorkspaceProposal from @/hooks/use-save-workspace-proposal; useBeforeUnload next/navigation; useBeforeUnload from react.
2. Define di atas component: const FormSchema = WspUpdateReqSchema.pick({ data_json: z.true }).extend({ data_json: z.record(z.any()).refine(...) untuk anggaran fields })
3. Inside component function:
   - const { npsn } = useAuthSession();
   - const { data: wspData } = useWorkspaceProposal(npsn)
   - const { register, handleSubmit, formState:{ isDirty, errors }, control, reset } = useForm({ resolver: zodResolver(FormSchema), defaultValues: async () => ({ data_json: wspData?.data_json ?? {} }) })
   - const saveMut = useSaveWorkspaceProposal(npsn)
   - useBeforeUnload( (e)=> { if (isDirty && !saveMut.isSuccess) { e.preventDefault(); e.returnValue = '' } })
   - Router useBeforeUnload dari next navigation juga dirty confirm block route change.
4. Ganti <form onSubmit={handleSubmit(values => saveMut.mutate(values as any))}> — wrap inputs dengan Controller RHF bind name="data_json.xxx".
5. Tombol SIMPAN: disabled={saveMut.isPending || !isDirty}, show loading spinner icon if isPending. Tampilkan toast/success message onSuccess mutation.
6. VERIFY apps/web tsc RC=0, next build RC=0.

**ACCEPTANCE CRITERIA (AC7):**
- grep "useForm(" school-proposal-sarana-page.tsx line count ≥ 1
- grep zodResolver file tsx EXIST = true
- grep WspUpdateReqSchema import EXIST = true
- 2x verify RC=0.

---

## ═══════════════════════════════════════════════════════════════════════════
## FASE 8 — GLOBAL ERROR BOUNDARY + NOT FOUND APP ROUTER (Issue FE6)
## ═══════════════════════════════════════════════════════════════════════════
**TUJUAN:** Tidak ada lagi layar putih error runtime React. User ada tombol refresh / kembali ke dashboard.
**URUTAN PERINTAH:**
1. Buat `apps/web/src/app/error.tsx` Next standard error boundary client component ("use client" on top directive).
   - props default { error, reset }: { error: Error & { digest?: string }; reset: () => void }.
   - UI: Card centered 480px width, title "Terjadi kesalahan sistem" red, body DEV show error.stack; PROD hanya "Silakan coba lagi atau hubungi admin jika berulang.", Tombol 1 [Coba Lagi] onClick reset(). Tombol 2 [Dashboard] redirect Link href role dashboard via useAuthSession role.
2. Buat `apps/web/src/app/not-found.tsx` Next standard 404. Link ke login or dashboard.
3. Tambahkan nested error boundary contoh admin: `apps/web/src/app/(workspace)/admin/error.tsx` (wrap admin scope error friendly).
4. Verify next build RC=0.

**ACCEPTANCE CRITERIA (AC8):** 3 files exist (global error, not-found, admin error), next build RC=0.

---

## ═══════════════════════════════════════════════════════════════════════════
## FASE 9 — ARSIPKAN JUNK FILES LEGACY REFACTOR
## ═══════════════════════════════════════════════════════════════════════════
**TUJUAN:** Folder components sekolah bersih, tidak ada .bak membingungkan developer baru.
**URUTAN PERINTAH:**
1. STAMP=$(date +%H%M%S); SUB=__ARCHIVE_LEGACY_20260831__/TREE_REFACTOR_PHASE_A_JUNK_${STAMP}
2. MOVE preserve relpath ke SUB (mv command, bukan delete):
   - apps/web/src/components/school/school-proposal-page.tsx.bak
   - Find recursively: find apps -name '.DS_Store' -print → mv satu per satu preserve relpath ke SUB/apps/..
   - Find all *.log files in project root or apps/**/*.log exclude node_modules → mv preserve.
3. Done, verify mv semua EXIT 0.

---

## ═══════════════════════════════════════════════════════════════════════════
## FASE 10 — FINAL SMOKE BUILD + TYPECHECK VERIFICATION ALL
## ═══════════════════════════════════════════════════════════════════════════
**TUJUAN:** Final sanity check LULUS sebelum agen tulis report SUKSES ke user.
**URUTAN PERINTAH — JALANKAN BERURUTAN & RECORD EXACT EXIT / COUNTS:**

| #    | PERINTAH EXACT CD                                                                                     | EXPECTED EXIT CODE | EXPECTED OUTPUT |
|------|-------------------------------------------------------------------------------------------------------|--------------------|-----------------|
| 10.1 | cd packages/shared-types && npx tsc --noEmit                                                          | RC=0               | (no errors stdout length < 20 bytes or empty) |
| 10.2 | cd apps/api && npx tsc --noEmit                                                                        | RC=0               | empty |
| 10.3 | cd apps/web && npx tsc --noEmit                                                                        | RC=0               | empty |
| 10.4 | cd apps/web && npx next build                                                                          | RC=0               | Summary lines ○ (static) + ƒ (dynamic) total routes ≥ 60 |
| 10.5 | ROOT /saranasmk $ npx turbo run typecheck                                                              | RC=0               | Tasks: X successful, 0 failed (X ≥ 3) |
| 10.6 | ROOT grep -rn "clientGetCache" apps/web/src/ 2>/dev/null | wc -l                                               | NUMERIC = 0      | Tidak ada sisa Map cache tua di src/ |
| 10.7 | ROOT ls apps/web/src/hooks/*.ts | wc -l                                                                 | NUMERIC ≥ 4        | Hook files exist |
| 10.8 | ROOT grep -c "setGlobalPrefix" apps/api/src/main.ts                                                   | NUMERIC ≥ 1        | API v1 prefix wired |
| 10.9 | ROOT sha256sum package-lock.json > _BACKUP_PRODUCTION/_reports/post_refactor_phaseA_package_lock_sha256.txt && ls -la _BACKUP_PRODUCTION/_reports/post_refactor_phaseA_package_lock_sha256.txt | RC=0, file exist non empty | SHA256 saved |
| 10.10| ROOT ls packages/shared-types/src/wsp.dto.ts apps/api/src/health/health.controller.ts apps/web/src/app/error.tsx apps/web/src/lib/providers/query-client-provider.tsx | RC=0, 4 files listed | Critical files exist |

**ACCEPTANCE CRITERIA (AC10):** 10/10 checklist di atas SESUAI expected. 1 saja tidak match — ROLLBACK ke FASE0 snapshot baseline copy folder, laporkan ke user langkah mana yang gagal + stderr.

---

## ═══════════════════════════════════════════════════════════════════════════
## END OF PLAYBOOK — JANGAN LANJUT FASE B SEBELUM REPORT KE USER DULU!
## ═══════════════════════════════════════════════════════════════════════════
✅ SEMUA PASS → Report ke user format MARKDOWN:
- [Fase X] PASS / FAIL — setiap fase baris 1
- Total file yang baru dibuat: X files, di modify: Y files, di archive: Z files
- Estimasi performance gain untuk user: cache persist survive reload, optimistic save, auto-invalidate realtime, etc.
- Rekomendasi NEXT PHASE B: Refactor sisa 19 form pages to RHF+Zod pattern, Refresh Token Rotation middleware auth, Feature Flags edge deploy canary component flags.
