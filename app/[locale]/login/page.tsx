"use client";

import { Plane, Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

const DEMO_ACCOUNTS = [
  { email: "admin@enterprise.local", password: "Admin@12345", role: "admin" },
  { email: "finance@enterprise.local", password: "Finance@12345", role: "finance_manager" },
  { email: "agent@enterprise.local", password: "Agent@12345", role: "agent" },
  { email: "auditor@enterprise.local", password: "Auditor@12345", role: "auditor" },
  { email: "manager@enterprise.local", password: "Manager@12345", role: "manager" },
  { email: "traveldesk@enterprise.local", password: "TravelDesk@12345", role: "travel_desk" },
] as const;

export default function LoginPage() {
  const locale = useLocale();
  const tLogin = useTranslations("auth.login");
  const tRoles = useTranslations("roles");

  const [email, setEmail] = useState<string>(DEMO_ACCOUNTS[0].email);
  const [password, setPassword] = useState<string>(DEMO_ACCOUNTS[0].password);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  const roleLabelByKey: Record<string, string> = {
    admin: tRoles("admin"),
    finance_manager: tRoles("finance_manager"),
    agent: tRoles("agent"),
    auditor: tRoles("auditor"),
    manager: tRoles("manager"),
    travel_desk: tRoles("travel_desk"),
  };

  useEffect(() => {
    let active = true;

    async function checkSession(): Promise<void> {
      try {
        const response = await fetch("/api/auth/session", {
          method: "GET",
          cache: "no-store",
        });
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

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError("");
    try {
      setIsSubmitting(true);
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      if (!response.ok) {
        setError(tLogin("failed"));
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
    } catch {
      setError(tLogin("failed"));
      setShake(true);
      setTimeout(() => setShake(false), 600);
    } finally {
      setIsSubmitting(false);
    }
  }

  function selectAccount(account: (typeof DEMO_ACCOUNTS)[number]): void {
    setEmail(account.email);
    setPassword(account.password);
    setError("");
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
          <label className="block text-xs font-medium text-finance">
            {tLogin("email")}
            <input
              ref={emailRef}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 text-sm text-foreground shadow-sm transition focus:border-primary focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary/10"
              required
              autoComplete="email"
            />
          </label>
          <label className="block text-xs font-medium text-finance">
            {tLogin("password")}
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 text-sm text-foreground shadow-sm transition focus:border-primary focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary/10"
              required
              autoComplete="current-password"
            />
          </label>

          {error ? (
            <div className="flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-rose-500" />
              {error}
            </div>
          ) : null}

          <Button type="submit" className="w-full h-11 text-sm" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
                {locale === "ar" ? "جاري الدخول..." : "Signing in..."}
              </>
            ) : (
              tLogin("submit")
            )}
          </Button>
        </form>

        <div className="mt-6 border-t border-border pt-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {tLogin("demoTitle")}
          </h3>
          <div className="mt-3 grid gap-2">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.email}
                type="button"
                onClick={() => selectAccount(account)}
                className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-start transition-all hover:border-primary/40 hover:bg-blue-50/40 hover:shadow-sm ${
                  email === account.email
                    ? "border-primary/50 bg-blue-50/60 shadow-sm"
                    : "border-border bg-white"
                }`}
              >
                <div>
                  <p className="text-xs font-medium text-finance">
                    <bdi>{account.email}</bdi>
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    <bdi>{account.password}</bdi>
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  account.role === "admin"
                    ? "bg-blue-100 text-blue-700"
                    : account.role === "finance_manager"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-100 text-slate-600"
                }`}>
                  {roleLabelByKey[account.role] ?? account.role}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
      `}</style>
    </section>
  );
}
