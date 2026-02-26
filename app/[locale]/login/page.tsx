"use client";

import { Plane, Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";

interface LoginErrorPayload {
  code?: string;
  message?: string;
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

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
        }
      } catch {
        return;
      }
    }

    void checkSession();

    return () => {
      active = false;
    };
  }, [locale]);

  async function attemptLogin(nextEmail: string, nextPassword: string): Promise<void> {
    setError("");
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
            email: nextEmail,
            password: nextPassword,
          }),
        },
        REQUEST_TIMEOUT_MS,
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as LoginErrorPayload | null;
        if (payload?.code === "validation_failed") {
          setError(
            isArabic
              ? "Please enter both email and password."
              : "Please enter both email and password.",
          );
        } else if (payload?.code === "auth_unavailable") {
          setError(
            isArabic
              ? "Authentication service is unavailable. Please try again shortly."
              : "Authentication service is unavailable. Please try again shortly.",
          );
        } else {
          setError(tLogin("failed"));
        }
        emailRef.current?.focus();
        setShake(true);
        setTimeout(() => setShake(false), 600);
        return;
      }

      const nextPath = new URLSearchParams(window.location.search).get("next");
      if (nextPath && nextPath.startsWith("/")) {
        window.location.href = nextPath;
        return;
      }
      window.location.href = `/${locale}`;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setError(
          isArabic
            ? "Login timed out. Please check connection and try again."
            : "Login timed out. Please check connection and try again.",
        );
      } else {
        setError(tLogin("failed"));
      }
      emailRef.current?.focus();
      setShake(true);
      setTimeout(() => setShake(false), 600);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    await attemptLogin(email, password);
  }

  async function quickLoginAsAdmin(): Promise<void> {
    if (!QUICK_LOGIN_ENABLED || isSubmitting) {
      return;
    }
    const admin = DEMO_ACCOUNTS[0];
    if (!admin) {
      return;
    }
    setEmail(admin.email);
    setPassword(admin.password);
    await attemptLogin(admin.email, admin.password);
  }

  return (
    <section
      className={`surface-card overflow-hidden ${shake ? "animate-shake" : ""}`}
      style={{
        animation: shake ? "shake 0.5s ease-in-out" : undefined,
      }}
    >
      <div className="bg-gradient-to-r from-primary to-blue-700 px-6 py-5 text-white">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
            <Plane className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold">{tLogin("title")}</h2>
            <p className="mt-0.5 text-xs text-blue-100">{tLogin("subtitle")}</p>
          </div>
        </div>
      </div>

      <div className="p-6">
        <form onSubmit={submit} className="space-y-4">
          <FormField label={tLogin("email")} required>
            <Input
              ref={emailRef}
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                if (error) {
                  setError("");
                }
              }}
              size="lg"
              required
              autoComplete="email"
              className="rounded-xl"
            />
          </FormField>
          <FormField label={tLogin("password")} required>
            <Input
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                if (error) {
                  setError("");
                }
              }}
              size="lg"
              required
              autoComplete="current-password"
              className="rounded-xl"
            />
          </FormField>

          {error ? (
            <div className="flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-rose-500" />
              {error}
            </div>
          ) : null}

          <Button type="submit" className="h-11 w-full text-sm" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
                {isArabic ? "Signing in..." : "Signing in..."}
              </>
            ) : (
              tLogin("submit")
            )}
          </Button>

          {QUICK_LOGIN_ENABLED ? (
            <div className="space-y-2 rounded-xl border border-dashed border-border bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-finance">{tLogin("demoTitle")}</p>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => void quickLoginAsAdmin()}
                  disabled={isSubmitting}
                >
                  {isArabic ? "Quick Login as Admin" : "Quick Login as Admin"}
                </Button>
              </div>
              <div className="space-y-1.5 text-[11px] text-muted-foreground">
                {DEMO_ACCOUNTS.map((account) => (
                  <p key={account.email} className="rounded-md bg-white px-2 py-1.5">
                    <span className="font-medium text-finance">
                      {isArabic ? account.roleAr : account.roleEn}
                    </span>
                    {" - "}
                    <span className="font-mono">{account.email}</span>
                    {" / "}
                    <span className="font-mono">{account.password}</span>
                  </p>
                ))}
              </div>
            </div>
          ) : null}
        </form>
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
