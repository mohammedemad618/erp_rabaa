"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
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
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="surface-card p-6">
      <h2 className="text-2xl font-bold text-finance">{tLogin("title")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{tLogin("subtitle")}</p>

      <form onSubmit={submit} className="mt-4 space-y-3">
        <label className="block text-xs text-muted-foreground">
          {tLogin("email")}
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm text-foreground"
            required
          />
        </label>
        <label className="block text-xs text-muted-foreground">
          {tLogin("password")}
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm text-foreground"
            required
          />
        </label>
        {error ? <p className="text-xs text-rose-600">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {tLogin("submit")}
        </Button>
      </form>

      <div className="mt-5 border-t border-border pt-4">
        <h3 className="text-sm font-semibold text-finance">{tLogin("demoTitle")}</h3>
        <div className="mt-2 overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-50 text-muted-foreground">
              <tr>
                <th className="px-2 py-2 text-start">{tLogin("email")}</th>
                <th className="px-2 py-2 text-start">{tLogin("password")}</th>
                <th className="px-2 py-2 text-start">{tLogin("role")}</th>
              </tr>
            </thead>
            <tbody>
              {DEMO_ACCOUNTS.map((account) => (
                <tr key={account.email} className="border-t border-border">
                  <td className="px-2 py-2">
                    <bdi>{account.email}</bdi>
                  </td>
                  <td className="px-2 py-2">
                    <bdi>{account.password}</bdi>
                  </td>
                  <td className="px-2 py-2">
                    <bdi>{roleLabelByKey[account.role] ?? account.role}</bdi>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
