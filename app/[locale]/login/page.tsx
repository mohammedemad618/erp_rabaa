"use client";

import { Clock3, Eye, EyeOff, Loader2, Lock, Mail, Plane, ShieldCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { cn } from "@/utils/cn";

interface LoginErrorPayload {
  code?: string;
  message?: string;
}

interface FieldErrors {
  email?: string;
  password?: string;
}

interface DemoAccount {
  email: string;
  password: string;
  roleAr: string;
  roleEn: string;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    email: "admin@enterprise.local",
    password: "Admin@12345",
    roleAr: "Admin",
    roleEn: "Admin",
  },
  {
    email: "finance@enterprise.local",
    password: "Finance@12345",
    roleAr: "Finance Manager",
    roleEn: "Finance Manager",
  },
  {
    email: "agent@enterprise.local",
    password: "Agent@12345",
    roleAr: "Agent",
    roleEn: "Agent",
  },
];

const QUICK_LOGIN_ENABLED = process.env.NODE_ENV !== "production";
const REQUEST_TIMEOUT_MS = 12000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export default function LoginPage() {
  const locale = useLocale();
  const isArabic = locale === "ar";
  const tLogin = useTranslations("auth.login");

  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSessionChecking, setIsSessionChecking] = useState(true);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [shake, setShake] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;

    async function checkSession(): Promise<void> {
      try {
        const response = await fetchWithTimeout(
          "/api/auth/session",
          {
            method: "GET",
            cache: "no-store",
          },
          REQUEST_TIMEOUT_MS,
        );
        const payload = (await response.json()) as { authenticated?: boolean };
        if (!active) {
          return;
        }
        if (payload.authenticated) {
          window.location.href = `/${locale}`;
          return;
        }
      } catch {
        // Ignore session probe failure and continue with login form.
      } finally {
        if (active) {
          setIsSessionChecking(false);
        }
      }
    }

    void checkSession();

    return () => {
      active = false;
    };
  }, [locale]);

  function validateCredentials(nextEmail: string, nextPassword: string): FieldErrors {
    const trimmedEmail = nextEmail.trim();
    const errors: FieldErrors = {};
    if (!trimmedEmail) {
      errors.email = "Email is required.";
    } else if (!EMAIL_PATTERN.test(trimmedEmail)) {
      errors.email = "Enter a valid email address.";
    }
    if (!nextPassword) {
      errors.password = "Password is required.";
    }
    return errors;
  }

  function triggerShake(): void {
    setShake(true);
    setTimeout(() => setShake(false), 600);
  }

  function focusFirstError(errors: FieldErrors): void {
    if (errors.email) {
      emailRef.current?.focus();
      return;
    }
    if (errors.password) {
      passwordRef.current?.focus();
    }
  }

  async function attemptLogin(nextEmail: string, nextPassword: string): Promise<void> {
    setError("");
    setFieldErrors({});
    try {
      setIsSubmitting(true);
      const response = await fetchWithTimeout(
        "/api/auth/login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: nextEmail.trim(),
            password: nextPassword,
            rememberMe,
          }),
        },
        REQUEST_TIMEOUT_MS,
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as LoginErrorPayload | null;
        if (payload?.code === "validation_failed") {
          setError("Please enter both email and password.");
        } else if (payload?.code === "invalid_credentials") {
          setError(tLogin("failed"));
        } else if (payload?.code === "auth_unavailable") {
          setError("Authentication service is unavailable. Please try again shortly.");
        } else {
          setError(payload?.message || tLogin("failed"));
        }
        passwordRef.current?.focus();
        triggerShake();
        return;
      }

      const nextPath = new URLSearchParams(window.location.search).get("next");
      if (nextPath && nextPath.startsWith("/")) {
        window.location.href = nextPath;
        return;
      }
      window.location.href = `/${locale}`;
    } catch (requestError) {
      if (requestError instanceof DOMException && requestError.name === "AbortError") {
        setError("Login timed out. Please check your network and try again.");
      } else {
        setError(tLogin("failed"));
      }
      passwordRef.current?.focus();
      triggerShake();
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    const errors = validateCredentials(email, password);
    if (errors.email || errors.password) {
      setFieldErrors(errors);
      setError("Please fix the highlighted fields.");
      focusFirstError(errors);
      triggerShake();
      return;
    }

    await attemptLogin(email, password);
  }

  async function quickLogin(account: DemoAccount): Promise<void> {
    if (!QUICK_LOGIN_ENABLED || isSubmitting || isSessionChecking) {
      return;
    }
    setError("");
    setFieldErrors({});
    setEmail(account.email);
    setPassword(account.password);
    await attemptLogin(account.email, account.password);
  }

  return (
    <section
      className={cn(
        "surface-card relative isolate overflow-hidden border border-slate-200/80 bg-white/90 shadow-[0_18px_70px_-36px_rgba(15,23,42,0.45)] backdrop-blur",
        shake && "animate-shake",
      )}
      style={{
        animation: shake ? "shake 0.5s ease-in-out" : undefined,
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -start-24 -top-24 h-64 w-64 rounded-full bg-blue-200/60 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-28 -end-20 h-72 w-72 rounded-full bg-emerald-200/50 blur-3xl"
      />

      <div className="grid lg:grid-cols-[0.95fr_1.05fr]">
        <aside className="relative hidden overflow-hidden border-e border-white/40 bg-gradient-to-b from-blue-700 via-blue-700 to-indigo-800 px-8 py-9 text-white lg:flex lg:flex-col lg:justify-between">
          <div
            aria-hidden
            className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.26),transparent_52%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.2),transparent_45%)]"
          />
          <div className="relative space-y-8">
            <p className="inline-flex rounded-full border border-white/30 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-100">
              Enterprise Secure Access
            </p>

            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 shadow-lg shadow-blue-900/30 backdrop-blur-sm">
                <Plane className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-blue-50">Identity Gateway</p>
                <p className="text-xs text-blue-100/85">Trusted login entry point</p>
              </div>
            </div>

            <div>
              <h3 className="text-2xl font-semibold leading-tight text-white">
                Access your workspace safely and quickly.
              </h3>
              <p className="mt-3 text-sm leading-6 text-blue-100/90">
                Sign in with your assigned account to continue to dashboards, operations, and
                finance workflows.
              </p>
            </div>

            <ul className="space-y-3 text-sm">
              <li className="rounded-xl border border-white/25 bg-white/10 px-3 py-2.5 backdrop-blur-sm">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-100" />
                  <span>Session cookies are secured and validated per request.</span>
                </div>
              </li>
              <li className="rounded-xl border border-white/25 bg-white/10 px-3 py-2.5 backdrop-blur-sm">
                <div className="flex items-start gap-3">
                  <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-blue-100" />
                  <span>Remember me extends session life for trusted devices.</span>
                </div>
              </li>
            </ul>
          </div>
          <p className="relative text-xs text-blue-100/85">
            Need access support? Contact your system administrator.
          </p>
        </aside>

        <div className="relative p-6 sm:p-8 lg:p-9">
          <div className="mb-6 rounded-2xl border border-slate-200/80 bg-gradient-to-r from-slate-50 to-white p-4 shadow-sm shadow-slate-900/5">
            <div className="mb-3 flex items-center gap-3 lg:hidden">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shadow-sm shadow-primary/15">
                <Plane className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Secure Access
                </p>
                <p className="text-sm font-medium text-finance">Enterprise Identity Gateway</p>
              </div>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-finance">{tLogin("title")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{tLogin("subtitle")}</p>
          </div>

          {isSessionChecking ? (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50/90 px-3 py-2 text-xs text-blue-700">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Checking existing session...
            </div>
          ) : null}

          <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200/70 bg-white/95 p-4 shadow-sm shadow-slate-900/5 sm:p-5" noValidate>
            <FormField label={tLogin("email")} required error={fieldErrors.email}>
              <div className="relative">
                <Mail className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <Input
                  ref={emailRef}
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (error) {
                      setError("");
                    }
                    if (fieldErrors.email) {
                      setFieldErrors((prev) => ({ ...prev, email: undefined }));
                    }
                  }}
                  size="lg"
                  variant={fieldErrors.email ? "error" : "default"}
                  required
                  autoComplete="email"
                  hasLeadingIcon
                  className="rounded-xl bg-white"
                />
              </div>
            </FormField>

            <FormField label={tLogin("password")} required error={fieldErrors.password}>
              <div className="relative">
                <Lock className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <Input
                  ref={passwordRef}
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    if (error) {
                      setError("");
                    }
                    if (fieldErrors.password) {
                      setFieldErrors((prev) => ({ ...prev, password: undefined }));
                    }
                  }}
                  size="lg"
                  variant={fieldErrors.password ? "error" : "default"}
                  required
                  autoComplete="current-password"
                  hasLeadingIcon
                  hasTrailingIcon
                  className="rounded-xl bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute end-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-finance focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tabIndex={isSubmitting ? -1 : 0}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </FormField>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                  disabled={isSubmitting}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                Remember this device for 30 days
              </label>
              <span className="text-xs text-slate-500">Need help? Contact admin.</span>
            </div>

            {error ? (
              <div
                className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600"
                role="alert"
              >
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-rose-500" />
                {error}
              </div>
            ) : null}

            <Button
              type="submit"
              className="h-11 w-full text-sm shadow-lg shadow-primary/25"
              disabled={isSubmitting || isSessionChecking}
              loading={isSubmitting}
            >
              {isSubmitting ? (isArabic ? "Signing in..." : "Signing in...") : tLogin("submit")}
            </Button>

            {QUICK_LOGIN_ENABLED ? (
              <div className="space-y-3 rounded-xl border border-dashed border-slate-300 bg-gradient-to-br from-slate-50 to-blue-50/40 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                    {tLogin("demoTitle")}
                  </p>
                  <p className="text-[11px] text-slate-500">Local/dev convenience</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {DEMO_ACCOUNTS.map((account) => (
                    <button
                      key={account.email}
                      type="button"
                      onClick={() => void quickLogin(account)}
                      disabled={isSubmitting || isSessionChecking}
                      className="rounded-lg border border-slate-200 bg-white/95 p-2.5 text-start transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5 hover:shadow-md hover:shadow-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <p className="text-xs font-semibold text-finance">
                        {isArabic ? account.roleAr : account.roleEn}
                      </p>
                      <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
                        {account.email}
                      </p>
                      <p className="truncate font-mono text-[11px] text-muted-foreground">
                        {account.password}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-[11px] text-slate-500">
              <p className="font-medium text-finance">Security notice</p>
              <p className="mt-0.5 leading-5">
                Do not share credentials. Session activity is validated and monitored.
              </p>
            </div>
          </form>
        </div>
      </div>

      <style jsx>{`
        @keyframes shake {
          0%,
          100% {
            transform: translateX(0);
          }
          20% {
            transform: translateX(-8px);
          }
          40% {
            transform: translateX(8px);
          }
          60% {
            transform: translateX(-4px);
          }
          80% {
            transform: translateX(4px);
          }
        }
      `}</style>
    </section>
  );
}
