"use client";

import {
  BarChart3,
  Building2,
  Bus,
  Calculator,
  Car,
  Cog,
  ChevronLeft,
  ChevronRight,
  FileCheck,
  FileText,
  Globe,
  LayoutDashboard,
  Landmark,
  LogOut,
  Plane,
  type LucideIcon,
  Printer,
  ReceiptText,
  Scale,
  Ticket,
  Users,
  Shield,
  Map,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import {
  SETTINGS_CHANGED_EVENT,
  SETTINGS_STORAGE_KEY,
} from "@/modules/settings/settings-config";
import { requiredPermissionForRoute } from "@/services/auth/page-permissions";
import { cn } from "@/utils/cn";
import { LocaleSwitcher } from "./locale-switcher";
import { CommandPalette } from "./command-palette";

interface AppShellProps {
  children: ReactNode;
}

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface SessionPayload {
  authenticated: boolean;
  user?: SessionUser;
  permissions?: string[];
}

export function AppShell({ children }: AppShellProps) {
  const locale = useLocale();
  const tNav = useTranslations("nav");
  const tApp = useTranslations("app");
  const tAuth = useTranslations("auth");
  const tRoles = useTranslations("roles");
  const tSections = useTranslations("navSections");
  const pathname = usePathname();
  const isLoginRoute = pathname === "/login";

  const sections: NavSection[] = [
    {
      title: tSections("main"),
      items: [
        { href: "/", label: tNav("dashboard"), icon: LayoutDashboard },
      ],
    },
    {
      title: tSections("services"),
      items: [
        { href: "/services", label: tNav("servicesHub"), icon: Globe, badge: 7 },
        { href: "/services/hotels", label: tNav("hotels"), icon: Building2, badge: 1 },
        { href: "/services/cars", label: tNav("carRental"), icon: Car, badge: 1 },
        { href: "/services/visa", label: tNav("visa"), icon: FileCheck, badge: 3 },
        { href: "/services/insurance", label: tNav("insurance"), icon: Shield },
        { href: "/services/tours", label: tNav("tours"), icon: Map, badge: 1 },
        { href: "/services/transfers", label: tNav("transfers"), icon: Bus, badge: 1 },
      ],
    },
    {
      title: tSections("operations"),
      items: [
        { href: "/travel", label: tNav("travel"), icon: Plane },
        { href: "/transactions", label: tNav("transactions"), icon: Ticket },
        { href: "/expenses", label: tNav("expenses"), icon: ReceiptText },
      ],
    },
    {
      title: tSections("finance"),
      items: [
        { href: "/accounting", label: tNav("accounting"), icon: Calculator },
        { href: "/treasury", label: tNav("treasury"), icon: Landmark },
        { href: "/bsp", label: tNav("bsp"), icon: Scale },
      ],
    },
    {
      title: tSections("tools"),
      items: [
        { href: "/crm", label: tNav("crm"), icon: Users },
        { href: "/reports", label: tNav("reports"), icon: BarChart3 },
        { href: "/ocr", label: tNav("ocr"), icon: FileText },
        { href: "/templates", label: tNav("templates"), icon: Printer },
        { href: "/settings", label: tNav("settings"), icon: Cog },
      ],
    },
  ];

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [contentVersion, setContentVersion] = useState(0);
  const [authLoading, setAuthLoading] = useState(true);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [sessionPermissions, setSessionPermissions] = useState<string[]>([]);

  useEffect(() => {
    function onSettingsChange() {
      setContentVersion((v) => v + 1);
    }
    window.addEventListener(SETTINGS_CHANGED_EVENT, onSettingsChange);
    window.addEventListener("storage", (ev) => {
      if (ev.key === SETTINGS_STORAGE_KEY) onSettingsChange();
    });
    return () => window.removeEventListener(SETTINGS_CHANGED_EVENT, onSettingsChange);
  }, []);

  useEffect(() => {
    let active = true;
    async function loadSession(): Promise<void> {
      try {
        const response = await fetch("/api/auth/session", {
          method: "GET",
          cache: "no-store",
        });
        const payload = (await response.json()) as SessionPayload;
        if (!active) return;
        if (payload.authenticated && payload.user) {
          setSessionUser(payload.user);
          setSessionPermissions(
            Array.isArray(payload.permissions) ? payload.permissions : [],
          );
        } else {
          setSessionUser(null);
          setSessionPermissions([]);
        }
      } catch {
        if (!active) return;
        setSessionUser(null);
        setSessionPermissions([]);
      } finally {
        if (active) setAuthLoading(false);
      }
    }
    setAuthLoading(true);
    void loadSession();
    return () => { active = false; };
  }, [pathname]);

  function isRouteActive(href: string): boolean {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  }

  function canAccessRoute(href: string): boolean {
    if (!sessionUser) return false;
    const requiredPermission = requiredPermissionForRoute(href);
    if (!requiredPermission) return false;
    return sessionPermissions.includes(requiredPermission);
  }

  async function logout(): Promise<void> {
    try { await fetch("/api/auth/logout", { method: "POST" }); } catch { /* no-op */ }
    window.location.href = `/${locale}/login`;
  }

  const roleLabelMap: Record<string, string> = {
    admin: tRoles("admin"),
    finance_manager: tRoles("finance_manager"),
    agent: tRoles("agent"),
    auditor: tRoles("auditor"),
    manager: tRoles("manager"),
    travel_desk: tRoles("travel_desk"),
  };

  if (isLoginRoute || (!authLoading && !sessionUser)) {
    return (
      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-white/85 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/70 lg:px-6">
          <div>
            <p className="text-sm font-semibold tracking-wide text-primary">{tApp("name")}</p>
            <p className="text-xs text-muted-foreground">{tApp("product")}</p>
          </div>
          <LocaleSwitcher />
        </header>
        <main key={contentVersion} className="mx-auto w-full max-w-3xl flex-1 p-4 lg:p-6">
          {children}
        </main>
      </div>
    );
  }

  const collapsed = isSidebarCollapsed;

  return (
    <div className={cn("grid min-h-screen transition-all duration-300", collapsed ? "lg:grid-cols-[64px_1fr]" : "lg:grid-cols-[240px_1fr]")}>
      {/* Sidebar */}
      <aside className="no-print flex flex-col border-e border-border bg-white">
        {/* Brand */}
        <div className={cn("flex items-center border-b border-border/50 px-3 py-4", collapsed && "justify-center px-2")}>
          {collapsed ? (
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white text-sm font-bold">R</div>
          ) : (
            <div>
              <p className="text-sm font-bold text-primary">{tApp("name")}</p>
              <p className="text-[10px] text-muted-foreground">{tApp("product")}</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 scrollbar-thin">
          {sections.map((section) => {
            const visibleItems = section.items.filter((item) => canAccessRoute(item.href));
            if (!visibleItems.length) return null;

            return (
              <div key={section.title} className="mb-3">
                {!collapsed && (
                  <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                    {section.title}
                  </p>
                )}
                <div className="space-y-0.5">
                  {visibleItems.map((item) => {
                    const Icon = item.icon;
                    const active = isRouteActive(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        title={collapsed ? item.label : undefined}
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-all relative",
                          collapsed && "justify-center px-0 py-2.5",
                          active
                            ? "bg-primary text-white shadow-sm shadow-primary/25"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                        )}
                      >
                        <Icon className={cn("h-4 w-4 shrink-0", collapsed && "h-[18px] w-[18px]")} />
                        {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                        {item.badge && item.badge > 0 ? (
                          <span className={cn(
                            "flex h-[18px] min-w-[18px] items-center justify-center rounded-full text-[9px] font-bold",
                            active ? "bg-white/25 text-white" : "bg-amber-100 text-amber-700",
                            collapsed && "absolute -top-0.5 -end-0.5 h-4 min-w-4 text-[8px]",
                          )}>
                            {item.badge}
                          </span>
                        ) : null}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* User + Collapse */}
        <div className="border-t border-border/50 p-2 space-y-1.5">
          {!collapsed && sessionUser && (
            <div className="rounded-lg bg-slate-50 px-3 py-2">
              <p className="text-xs font-semibold text-finance truncate">{sessionUser.name}</p>
              <p className="text-[10px] text-muted-foreground">{roleLabelMap[sessionUser.role] ?? sessionUser.role}</p>
            </div>
          )}
          {collapsed && sessionUser && (
            <div className="flex justify-center" title={sessionUser.name}>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                {sessionUser.name?.charAt(0) ?? "U"}
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={() => void logout()}
            className={cn(
              "flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-white text-xs text-slate-600 transition hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200",
              collapsed ? "h-8 w-full" : "h-8 px-2",
            )}
            title={collapsed ? tAuth("logout") : undefined}
          >
            <LogOut className="h-3.5 w-3.5" />
            {!collapsed && tAuth("logout")}
          </button>
          <button
            type="button"
            onClick={() => setIsSidebarCollapsed(!collapsed)}
            className="flex w-full items-center justify-center rounded-lg border border-border bg-white h-8 text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex min-h-screen flex-col bg-slate-50/30">
        {/* Top bar */}
        <header className="no-print sticky top-0 z-20 flex items-center justify-between border-b border-border bg-white/90 px-4 py-2.5 backdrop-blur lg:px-6">
          <Breadcrumb pathname={pathname} sections={sections} />
          <div className="flex items-center gap-2">
            <CommandPalette />
            <LocaleSwitcher />
            {collapsed && sessionUser && (
              <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
                {sessionUser.name?.split(" ")[0]}
              </span>
            )}
          </div>
        </header>

        <main key={contentVersion} className="print-sheet flex-1 p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

function Breadcrumb({ pathname, sections }: { pathname: string; sections: NavSection[] }) {
  const allItems = sections.flatMap((s) => s.items.map((i) => ({ ...i, section: s.title })));
  const current = allItems.find((i) => i.href === "/" ? pathname === "/" : pathname.startsWith(i.href));

  if (!current) return <div className="text-xs text-muted-foreground">&nbsp;</div>;

  const Icon = current.icon;
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="text-slate-400">{current.section}</span>
      <span className="text-slate-300">/</span>
      <span className="flex items-center gap-1 font-medium text-finance">
        <Icon className="h-3.5 w-3.5" />
        {current.label}
      </span>
    </div>
  );
}
