"use client";

import {
  AlertCircle,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LogOut,
  LockKeyhole,
  Mail,
  School,
  ShieldAlert,
  ShieldCheck,
  UserRound,
  LayoutDashboard,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  changePasswordFirstTimeRequest,
  loginRequest,
} from "@/lib/api";
import type { AuthSession } from "@/lib/roles";
import { dashboardPath, demoCredentials } from "@/lib/roles";
import { useAuthStore } from "@/store/auth-store";

function validateStrongPassword(password: string): string[] {
  const errors: string[] = [];
  const p = String(password ?? "");
  if (p.length < 8) errors.push("Minimal 8 (delapan) karakter.");
  if (!/[A-Z]/.test(p)) errors.push("Minimal 1 (satu) huruf BESAR (A – Z).");
  if (!/[a-z]/.test(p)) errors.push("Minimal 1 (satu) huruf KECIL (a – z).");
  if (!/[0-9]/.test(p)) errors.push("Minimal 1 (satu) ANGKA (0 – 9).");
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(p))
    errors.push("Minimal 1 (satu) SIMBOL (misalnya !@#$%^&*).");
  return errors;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const heroImage = "/images/smkmerahputih.jpg";

function getPostLoginPath(role: "SUPERADMIN" | "ADMIN" | "FASILITATOR_ALAT" | "FASILITATOR_ADMINISTRASI" | "SEKOLAH" | "KOORDINATOR_ALAT" | "PPK") {
  return dashboardPath(role);
}

export function LoginForm() {
  const router = useRouter();
  const { setSession, logout } = useAuthStore();
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [submittingLogin, setSubmittingLogin] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const loginInFlight = useRef(false);

  const [firstLoginSession, setFirstLoginSession] = useState<AuthSession | null>(null);
  const [firstLoginForm, setFirstLoginForm] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
    email: "",
    showOldPassword: false,
    showNewPassword: false,
    showConfirmPassword: false,
  });
  const [firstLoginSubmitting, setFirstLoginSubmitting] = useState(false);
  const [firstLoginError, setFirstLoginError] = useState("");
  const firstLoginInFlight = useRef(false);

  const firstLoginNewPwdErrors = useMemo(
    () => validateStrongPassword(firstLoginForm.newPassword),
    [firstLoginForm.newPassword],
  );
  const firstLoginConfirmPwdMatch = useMemo(() => {
    if (!firstLoginForm.confirmPassword) return true;
    return firstLoginForm.newPassword === firstLoginForm.confirmPassword;
  }, [firstLoginForm.newPassword, firstLoginForm.confirmPassword]);
  const firstLoginEmailValid = useMemo(() => {
    if (!firstLoginForm.email.trim()) return false;
    return EMAIL_REGEX.test(firstLoginForm.email.trim());
  }, [firstLoginForm.email]);
  const firstLoginCanSubmit = useMemo(() => {
    if (!firstLoginForm.oldPassword.trim()) return false;
    if (firstLoginNewPwdErrors.length > 0) return false;
    if (!firstLoginForm.confirmPassword.trim()) return false;
    if (!firstLoginConfirmPwdMatch) return false;
    if (!firstLoginEmailValid) return false;
    return true;
  }, [
    firstLoginForm.oldPassword,
    firstLoginNewPwdErrors,
    firstLoginForm.confirmPassword,
    firstLoginConfirmPwdMatch,
    firstLoginEmailValid,
  ]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loginInFlight.current) {
      return;
    }

    loginInFlight.current = true;
    setSubmittingLogin(true);
    setError("");
    setSuccess("");
    setFirstLoginSession(null);

    try {
      const session = await loginRequest({
        username: loginUsername,
        password: loginPassword,
      });
      setSession(session);
      if (session.mustChangePassword === true && session.user.role === "SEKOLAH") {
        setFirstLoginSession(session);
        setFirstLoginForm({
          oldPassword: loginPassword,
          newPassword: "",
          confirmPassword: "",
          email: "",
          showOldPassword: false,
          showNewPassword: false,
          showConfirmPassword: false,
        });
        setFirstLoginError("");
        return;
      }
      router.push(getPostLoginPath(session.user.role));
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Login gagal. Periksa akun Anda.",
      );
    } finally {
      setSubmittingLogin(false);
      loginInFlight.current = false;
    }
  }

  async function handleFirstLoginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!firstLoginSession) return;
    if (firstLoginInFlight.current) return;
    firstLoginInFlight.current = true;
    setFirstLoginSubmitting(true);
    setFirstLoginError("");
    try {
      await changePasswordFirstTimeRequest(firstLoginSession.token, firstLoginSession.user.id, {
        oldPassword: firstLoginForm.oldPassword.trim(),
        newPassword: firstLoginForm.newPassword.trim(),
        confirmPassword: firstLoginForm.confirmPassword.trim(),
        email: firstLoginForm.email.trim(),
      });
      const freshSession = await loginRequest({
        username: firstLoginSession.user.username,
        password: firstLoginForm.newPassword.trim(),
      });
      setSession(freshSession);
      setFirstLoginSession(null);
      router.push(getPostLoginPath(freshSession.user.role));
      router.refresh();
    } catch (err) {
      setFirstLoginError(err instanceof Error ? err.message : "Gagal menyimpan perubahan password.");
    } finally {
      setFirstLoginSubmitting(false);
      firstLoginInFlight.current = false;
    }
  }

  async function handleFirstLoginLogoutOnly() {
    if (!window.confirm("Batal mengganti password & keluar dari akun sekolah ini? Anda harus login ulang dan tetap akan diminta mengganti password saat login pertama.")) return;
    setFirstLoginSession(null);
    setFirstLoginForm({
      oldPassword: "",
      newPassword: "",
      confirmPassword: "",
      email: "",
      showOldPassword: false,
      showNewPassword: false,
      showConfirmPassword: false,
    });
    setFirstLoginError("");
    setFirstLoginSubmitting(false);
    firstLoginInFlight.current = false;
    setError("");
    setSuccess("");
    logout();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="grid min-h-screen bg-[#f5f7fb] lg:grid-cols-[420px_minmax(0,1fr)]">
      <section className="flex min-h-screen flex-col bg-white px-7 py-8 md:px-8">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-primary">
            <School className="h-5 w-5" />
          </div>
          <div>
            <p className="display-font text-[18px] font-semibold text-slate-900">SARANA SMK</p>
            <p className="text-xs text-slate-500">Platform Bantuan Sarana dan Informasi Sekolah SMK</p>
          </div>
        </div>

        <div className="flex flex-1 flex-col">
          <div className="mb-7">
            <h1 className="display-font text-[24px] font-semibold text-slate-900">
              Selamat Datang
            </h1>
            <p className="mt-2 text-sm text-slate-500">Masuk ke sistem Bantuan Sarana SMK</p>
          </div>

          <form
            className="space-y-5"
            action="about:blank"
            method="post"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void handleSubmit(event);
              return false;
            }}
          >
            <FieldLabel label="Username atau NPSN" icon={<UserRound className="h-4 w-4 text-slate-400" />}>
              <input
                type="text"
                name="username"
                autoComplete="username webauthn"
                value={loginUsername}
                onChange={(event) => setLoginUsername(event.target.value)}
                className="w-full bg-transparent text-sm text-slate-900 outline-none"
                placeholder="Masukan Username atau NPSN Anda"
              />
            </FieldLabel>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Katasandi</span>
                <button type="button" className="text-xs font-medium text-accent transition hover:text-primary">
                  Lupa password?
                </button>
              </div>
              <FieldBox icon={<LockKeyhole className="h-4 w-4 text-slate-400" />}>
                <input
                  name="password"
                  type={showLoginPassword ? "text" : "password"}
                  autoComplete="current-password webauthn"
                  value={loginPassword}
                  onChange={(event) => setLoginPassword(event.target.value)}
                  className="flex-1 bg-transparent text-sm text-slate-900 outline-none"
                  placeholder="Masukan Katasandi Anda"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword((cur) => !cur)}
                  className="rounded-md p-1 text-slate-400 transition hover:text-primary shrink-0"
                  title={showLoginPassword ? "Sembunyikan password" : "Tampilkan password"}
                >
                  {showLoginPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </FieldBox>
            </div>

            {error ? (
              <div className="rounded-2xl border border-danger/15 bg-danger/[0.08] px-4 py-3 text-sm text-danger">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              formNoValidate
              disabled={submittingLogin}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1f7bf2] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#1668d1] disabled:cursor-not-allowed disabled:opacity-70"
            >
              <ArrowRight className="h-4 w-4" />
              {submittingLogin ? "Masuk ke sistem..." : "Masuk ke Sistem"}
            </button>
          </form>

          {/* Demo credentials card: hidden per request */}
          <div className="hidden mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-800">Akun demo</p>
            </div>
            <div className="max-h-72 space-y-2 overflow-auto pr-1">
              {demoCredentials.map((credential) => (
                <button
                  key={credential.username}
                  type="button"
                  onClick={() => {
                    setLoginUsername(credential.username);
                    setLoginPassword(credential.password);
                  }}
                  className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left transition hover:border-accent/30 hover:bg-accent-soft"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800">{credential.role}</p>
                    <p className="text-xs text-slate-500">
                      {credential.username} / {credential.password}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                </button>
              ))}
            </div>
          </div>

          <div className="mt-auto pt-10 text-center text-xs text-slate-400">
            © 2026 Direktorat SMK. Hak Cipta Dilindungi. SARANA SMK
          </div>
        </div>
      </section>

      <section className="relative hidden overflow-hidden bg-[#0a315f] lg:flex">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${heroImage})` }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,32,66,0.68),rgba(4,24,56,0.88))]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(97,178,255,0.28),transparent_24%),linear-gradient(90deg,rgba(220,38,38,0.12),transparent_20%)]" />

        <div className="relative z-10 flex w-full flex-col justify-center px-12 py-14 xl:px-16">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-semibold text-white/80 backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Sistem Bantuan Sarana SMK Real-time
            </div>
            <h2 className="display-font mt-8 max-w-4xl text-5xl leading-[1.1] font-semibold text-white">
              Membangun Masa Depan <span className="text-[#6fc1ff]">SMK Indonesia.</span>
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-8 text-white/78">
              Platform terpadu untuk monitoring, verifikasi, bimbingan teknis, dan supervisi program Bantuan Sarana Sekolah Menengah Kejuruan di seluruh Indonesia.
            </p>
          </div>

          <div className="mt-10 grid gap-4 xl:grid-cols-3">
            {[
              {
                title: "Monitoring Real-time",
                icon: ShieldCheck,
              },
              {
                title: "Sistem Terintegrasi",
                icon: LayoutDashboard,
              },
              {
                title: "Akses Mudah Digunakan",
                icon: UserRound,
              },
            ].map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.title}
                  className="rounded-[22px] border border-white/12 bg-white/12 px-6 py-7 text-white backdrop-blur-md shadow-[0_1px_0_rgba(255,255,255,0.15)_inset]"
                >
                  <Icon className="h-7 w-7 text-white" />
                  <p className="mt-8 text-base font-semibold">{item.title}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {firstLoginSession ? (
        <FirstLoginDialogInline
          firstLoginSession={firstLoginSession}
          formState={firstLoginForm}
          setFormState={setFirstLoginForm}
          onSubmit={handleFirstLoginSubmit}
          onSubmitError={firstLoginError}
          submitting={firstLoginSubmitting}
          canSubmit={firstLoginCanSubmit}
          emailValid={firstLoginEmailValid}
          passwordErrors={firstLoginNewPwdErrors}
          strongMatchCount={5 - firstLoginNewPwdErrors.length}
          onLogoutOnly={handleFirstLoginLogoutOnly}
        />
      ) : null}
    </div>
  );
}

function FirstLoginDialogInline({
  firstLoginSession,
  formState,
  setFormState,
  onSubmit,
  onSubmitError,
  submitting,
  canSubmit,
  emailValid,
  passwordErrors,
  strongMatchCount,
  onLogoutOnly,
}: {
  firstLoginSession: AuthSession;
  formState: {
    oldPassword: string;
    newPassword: string;
    confirmPassword: string;
    email: string;
    showOldPassword: boolean;
    showNewPassword: boolean;
    showConfirmPassword: boolean;
  };
  setFormState: (
    updater: (
      current: {
        oldPassword: string;
        newPassword: string;
        confirmPassword: string;
        email: string;
        showOldPassword: boolean;
        showNewPassword: boolean;
        showConfirmPassword: boolean;
      },
    ) => {
      oldPassword: string;
      newPassword: string;
      confirmPassword: string;
      email: string;
      showOldPassword: boolean;
      showNewPassword: boolean;
      showConfirmPassword: boolean;
    },
  ) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onSubmitError: string | null;
  submitting: boolean;
  canSubmit: boolean;
  emailValid: boolean;
  passwordErrors: string[];
  strongMatchCount: number;
  onLogoutOnly: () => Promise<void>;
}) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const dlg = dialogRef.current;
      if (dlg && typeof dlg.showModal === "function" && !dlg.open) {
        try {
          dlg.showModal();
        } catch {
          /* non-fatal */
        }
      }
    }, 10);
    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  const newPasswordConfirmMatch =
    formState.confirmPassword.length === 0 || formState.newPassword === formState.confirmPassword;

  return (
    <dialog
      ref={dialogRef}
      className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 m-0 z-[100] backdrop:bg-slate-900/60 backdrop:backdrop-blur-sm rounded-[28px] border border-primary/20 bg-white p-0 shadow-[0_25px_80px_-20px_rgba(15,23,42,0.5)] w-[94vw] max-w-[620px] max-h-[92vh] overflow-hidden"
      onCancel={(event) => event.preventDefault()}
      onClick={(event) => {
        const dlg = dialogRef.current;
        if (dlg && event.target === dlg) {
          event.preventDefault();
        }
      }}
    >
          <form onSubmit={onSubmit} className="flex flex-col max-h-[92vh]">
            <div className="border-b border-slate-100 bg-gradient-to-r from-primary/10 via-white to-white px-6 py-5">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 shadow-sm">
                  <ShieldAlert className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
                    Login Pertama Kali — Wajib Ganti Password
                  </p>
                  <h1 className="mt-1.5 text-xl font-semibold text-slate-950 leading-7">
                    Selamat Datang, {firstLoginSession.user.fullName ?? "Sekolah"}
                  </h1>
                  <p className="mt-2 text-sm text-slate-600 leading-6">
                    Anda login menggunakan <strong>password DEFAULT</strong>. Untuk keamanan akun,
                    Anda <strong>WAJIB</strong> mengganti password baru dan mengisi email resmi sekolah sebelum dapat mengakses menu SARANA SMK.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              <div className="rounded-2xl border border-primary/15 bg-primary/[0.04] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/80">
                  Username Akun Sekolah (NPSN)
                </p>
                <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-primary/20 bg-white px-4 py-2.5">
                  <ShieldCheck className="h-4 w-4 text-primary/70 shrink-0" />
                  <input
                    type="text"
                    value={firstLoginSession.user.username}
                    disabled
                    readOnly
                    className="flex-1 bg-transparent text-base font-mono font-bold text-primary-900 outline-none select-all"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <label className="grid gap-2">
                  <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <KeyRound className="h-4 w-4 text-slate-500" />
                    Password Lama (Default)
                  </span>
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 transition focus-within:border-primary/50 focus-within:shadow-[0_0_0_4px_rgba(31,123,242,0.08)]">
                    <LockKeyhole className="h-4 w-4 text-slate-400 shrink-0" />
                    <input
                      type={formState.showOldPassword ? "text" : "password"}
                      value={formState.oldPassword}
                      onChange={(e) =>
                        setFormState((c) => ({ ...c, oldPassword: e.target.value }))
                      }
                      required
                      placeholder="Masukkan password default yang diberikan"
                      className="flex-1 bg-transparent text-sm text-slate-900 outline-none"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setFormState((c) => ({ ...c, showOldPassword: !c.showOldPassword }))
                      }
                      className="rounded-md p-1 text-slate-400 hover:text-primary transition shrink-0"
                      title={formState.showOldPassword ? "Sembunyikan" : "Tampilkan password"}
                    >
                      {formState.showOldPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </label>

                <label className="grid gap-2">
                  <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <ShieldAlert className="h-4 w-4 text-amber-600" />
                    Password Baru <span className="text-xs font-normal text-slate-500">(5 kriteria wajib)</span>
                  </span>
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 transition focus-within:border-primary/50 focus-within:shadow-[0_0_0_4px_rgba(31,123,242,0.08)]">
                    <LockKeyhole className="h-4 w-4 text-slate-400 shrink-0" />
                    <input
                      type={formState.showNewPassword ? "text" : "password"}
                      value={formState.newPassword}
                      onChange={(e) =>
                        setFormState((c) => ({ ...c, newPassword: e.target.value }))
                      }
                      required
                      placeholder="Password baru yang kuat"
                      className="flex-1 bg-transparent text-sm text-slate-900 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setFormState((c) => ({ ...c, showNewPassword: !c.showNewPassword }))
                      }
                      className="rounded-md p-1 text-slate-400 hover:text-primary transition shrink-0"
                      title={formState.showNewPassword ? "Sembunyikan" : "Tampilkan password"}
                    >
                      {formState.showNewPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <ul className="grid gap-1.5 rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-3">
                    {([
                      ["Minimal 8 (delapan) karakter", formState.newPassword.length >= 8],
                      ["Minimal 1 (satu) huruf BESAR (A – Z)", /[A-Z]/.test(formState.newPassword)],
                      ["Minimal 1 (satu) huruf KECIL (a – z)", /[a-z]/.test(formState.newPassword)],
                      ["Minimal 1 (satu) ANGKA (0 – 9)", /[0-9]/.test(formState.newPassword)],
                      [
                        "Minimal 1 (satu) SIMBOL (misal: !@#$%^&*)",
                        /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(formState.newPassword),
                      ],
                    ] as Array<[string, boolean]>).map(([label, ok], idx) => (
                      <li key={idx} className="flex items-center gap-2 text-xs leading-5">
                        {ok ? (
                          <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                        ) : (
                          <AlertCircle className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        )}
                        <span className={ok ? "text-emerald-700 font-medium" : "text-slate-500"}>
                          {label}
                        </span>
                      </li>
                    ))}
                  </ul>
                </label>

                <label className="grid gap-2">
                  <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Check className="h-4 w-4 text-emerald-600" />
                    Konfirmasi Password Baru
                  </span>
                  <div className={`flex items-center gap-2 rounded-xl border bg-white px-4 py-3 transition focus-within:shadow-[0_0_0_4px_rgba(31,123,242,0.08)] ${
                    formState.confirmPassword && !newPasswordConfirmMatch
                      ? "border-danger/50 focus-within:border-danger/50 focus-within:shadow-[0_0_0_4px_rgba(239,68,68,0.08)]"
                      : "border-slate-200 focus-within:border-primary/50"
                  }`}>
                    <LockKeyhole className="h-4 w-4 text-slate-400 shrink-0" />
                    <input
                      type={formState.showConfirmPassword ? "text" : "password"}
                      value={formState.confirmPassword}
                      onChange={(e) =>
                        setFormState((c) => ({ ...c, confirmPassword: e.target.value }))
                      }
                      required
                      placeholder="Ketik ulang password baru di atas"
                      className="flex-1 bg-transparent text-sm text-slate-900 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setFormState((c) => ({ ...c, showConfirmPassword: !c.showConfirmPassword }))
                      }
                      className="rounded-md p-1 text-slate-400 hover:text-primary transition shrink-0"
                      title={formState.showConfirmPassword ? "Sembunyikan" : "Tampilkan password"}
                    >
                      {formState.showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {formState.confirmPassword && !newPasswordConfirmMatch ? (
                    <p className="flex items-center gap-1.5 text-xs text-danger leading-5">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      Konfirmasi password baru tidak sama dengan password baru di atas.
                    </p>
                  ) : null}
                </label>

                <label className="grid gap-2">
                  <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Mail className="h-4 w-4 text-slate-500" />
                    Email Resmi Sekolah <span className="text-xs font-normal text-danger">*</span>
                  </span>
                  <div className={`flex items-center gap-2 rounded-xl border bg-white px-4 py-3 transition focus-within:shadow-[0_0_0_4px_rgba(31,123,242,0.08)] ${
                    formState.email && !emailValid
                      ? "border-danger/50 focus-within:border-danger/50 focus-within:shadow-[0_0_0_4px_rgba(239,68,68,0.08)]"
                      : "border-slate-200 focus-within:border-primary/50"
                  }`}>
                    <Mail className="h-4 w-4 text-slate-400 shrink-0" />
                    <input
                      type="email"
                      value={formState.email}
                      onChange={(e) =>
                        setFormState((c) => ({ ...c, email: e.target.value }))
                      }
                      required
                      placeholder="contoh: nama.smk@sch.id atau operator.smk@gmail.com"
                      className="flex-1 bg-transparent text-sm text-slate-900 outline-none"
                      autoComplete="email"
                    />
                  </div>
                  {formState.email && !emailValid ? (
                    <p className="flex items-center gap-1.5 text-xs text-danger leading-5">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      Format email tidak valid. Pastikan menggunakan @ dan domain yang benar (misal: sch.id / gmail.com).
                    </p>
                  ) : null}
                </label>
              </div>

              {onSubmitError ? (
                <div className="flex items-start gap-2 rounded-xl border border-danger/15 bg-danger/[0.08] px-4 py-3">
                  <AlertCircle className="h-4 w-4 text-danger shrink-0 mt-0.5" />
                  <p className="text-sm text-danger leading-6">{onSubmitError}</p>
                </div>
              ) : null}
            </div>

            <div className="border-t border-slate-100 bg-slate-50 px-6 py-4 space-y-3">
              <button
                type="submit"
                disabled={!canSubmit || submitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Menyimpan perubahan password &amp; masuk ke dashboard...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Simpan Password Baru &amp; Lanjut ke Dashboard
                  </>
                )}
              </button>
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] leading-5 text-slate-500 max-w-[380px]">
                  Setelah disimpan, sistem akan otomatis login dengan password BARU dan langsung mengarahkan Anda ke Dashboard Profil Sekolah tanpa perlu login ulang.
                </p>
                <button
                  type="button"
                  onClick={onLogoutOnly}
                  disabled={submitting}
                  className="flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Batal &amp; Keluar
                </button>
              </div>
            </div>
          </form>
        </dialog>
  );
}

function FieldLabel({
  label,
  icon,
  children,
}: {
  label: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      <FieldBox icon={icon}>{children}</FieldBox>
    </label>
  );
}

function FieldBox({
  icon,
  children,
}: {
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 transition focus-within:border-accent/40 focus-within:shadow-[0_0_0_4px_rgba(31,123,242,0.08)]">
      {icon}
      {children}
    </div>
  );
}
