"use client";

import {
  BarChart3,
  Calculator,
  ChevronLeft,
  ChevronRight,
  Cog,
  FileText,
  Globe,
  LayoutDashboard,
  Landmark,
  LogOut,
  type LucideIcon,
  Printer,
  ReceiptText,
  Scale,
  Ticket,
  Users,
  Settings2,
  Menu,
  X,
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
import { NotificationCenter } from "./notification-center";
import { Home } from "lucide-react";

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
  const isLoginRoute = pathname === "/login" || pathname.endsWith("/login");

  const sections: NavSection[] = [
    {
      title: tSections("main"),
      items: [
        { href: "/", label: tNav("dashboard"), icon: LayoutDashboard },
      ],
    },
    {
      title: tSections("operations"),
      items: [
        { href: "/services", label: tNav("servicesHub"), icon: Globe, badge: 7 },
        { href: "/services/manage", label: locale === "ar" ? "إدارة الخدمات" : "Manage Services", icon: Settings2 },
        { href: "/operations", label: tNav("operations"), icon: Ticket },
        { href: "/expenses", label: tNav("expenses"), icon: ReceiptText },
      ],
    },
    {
      title: locale === "ar" ? "العملاء" : "Customers",
      items: [
        { href: "/crm", label: tNav("crm"), icon: Users },
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
        { href: "/reports", label: tNav("reports"), icon: BarChart3 },
        { href: "/ocr", label: tNav("ocr"), icon: FileText },
        { href: "/templates", label: tNav("templates"), icon: Printer },
        { href: "/settings", label: tNav("settings"), icon: Cog },
      ],
    },
  ];

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [contentVersion, setContentVersion] = useState(0);
  const [authLoading, setAuthLoading] = useState(true);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [sessionPermissions, setSessionPermissions] = useState<string[]>([]);

  useEffect(() => {
    function onSettingsChange() {
      setContentVersion((v) => v + 1);
    }
    function onStorageChange(ev: StorageEvent) {
      if (ev.key === SETTINGS_STORAGE_KEY) {
        onSettingsChange();
      }
    }
    window.addEventListener(SETTINGS_CHANGED_EVENT, onSettingsChange);
    window.addEventListener("storage", onStorageChange);
    return () => {
      window.removeEventListener(SETTINGS_CHANGED_EVENT, onSettingsChange);
      window.removeEventListener("storage", onStorageChange);
    };
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

  // Close mobile sidebar when route changes
  useEffect(() => {
    setIsMobileOpen(false);
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

  const collapsed = isSidebarCollapsed && !isMobileOpen;

  return (
    <div className={cn("grid min-h-screen transition-all duration-300",
      collapsed ? "lg:grid-cols-[64px_1fr]" : "lg:grid-cols-[240px_1fr]"
    )}>

      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm transition-opacity"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "no-print flex flex-col border-e border-border bg-white",
        "fixed inset-y-0 start-0 z-50 transition-transform duration-300 ease-in-out",
        "lg:static lg:translate-x-0 w-64 lg:w-auto",
        isMobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Brand */}
        <div className={cn("flex items-center justify-between border-b border-border/50 px-3 py-4", collapsed && "lg:justify-center lg:px-2")}>
          <div className="flex items-center gap-2">
            {collapsed ? (
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white text-sm font-bold">R</div>
            ) : (
              <div>
                <p className="text-sm font-bold text-primary">{tApp("name")}</p>
                <p className="text-[10px] text-muted-foreground">{tApp("product")}</p>
              </div>
            )}
          </div>
          <button
            type="button"
            className="lg:hidden p-1 text-slate-500 hover:bg-slate-100 rounded-md"
            onClick={() => setIsMobileOpen(false)}
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
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
                          collapsed && "lg:justify-center lg:px-0 lg:py-2.5",
                          active
                            ? "bg-primary text-white shadow-sm shadow-primary/25"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                        )}
                      >
                        <Icon className={cn("h-4 w-4 shrink-0", collapsed && "lg:h-[18px] lg:w-[18px]")} />
                        {(!collapsed || isMobileOpen) && <span className="flex-1 truncate">{item.label}</span>}
                        {item.badge && item.badge > 0 ? (
                          <span className={cn(
                            "flex h-[18px] min-w-[18px] items-center justify-center rounded-full text-[9px] font-bold",
                            active ? "bg-white/25 text-white" : "bg-amber-100 text-amber-700",
                            collapsed && "lg:absolute lg:-top-0.5 lg:-end-0.5 lg:h-4 lg:min-w-4 lg:text-[8px]",
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
        <div className="border-t border-border/50 p-2 space-y-2 pb-safe">
          {(!collapsed || isMobileOpen) && sessionUser && (
            <div className="rounded-lg bg-slate-50 px-3 py-2.5">
              <p className="text-sm font-semibold text-finance truncate">{sessionUser.name}</p>
              <p className="text-xs text-muted-foreground">{roleLabelMap[sessionUser.role] ?? sessionUser.role}</p>
            </div>
          )}
          {collapsed && !isMobileOpen && sessionUser && (
            <div className="hidden lg:flex justify-center py-1" title={sessionUser.name}>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {sessionUser.name?.charAt(0) ?? "U"}
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void logout()}
              className={cn(
                "flex items-center justify-center gap-2 rounded-lg border border-border bg-white text-sm font-medium text-slate-600 transition hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/20",
                collapsed ? "h-9 w-full" : "h-9 px-3 flex-1",
              )}
              title={collapsed ? tAuth("logout") : undefined}
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              {(!collapsed || isMobileOpen) && tAuth("logout")}
            </button>
            <button
              type="button"
              onClick={() => setIsSidebarCollapsed(!collapsed)}
              className="hidden lg:flex w-9 items-center justify-center rounded-lg border border-border bg-white h-9 text-slate-400 transition hover:bg-slate-50 hover:text-slate-600 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!collapsed}
            >
              {collapsed ? <ChevronRight className="h-4 w-4" aria-hidden="true" /> : <ChevronLeft className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex min-w-0 min-h-screen flex-col bg-slate-50/30 lg:overflow-hidden">
        {/* Top bar */}
        <header className="no-print sticky top-0 z-20 flex items-center justify-between border-b border-border bg-white/90 px-4 py-2.5 backdrop-blur lg:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="lg:hidden p-1.5 -ms-1.5 text-slate-500 hover:bg-slate-100 rounded-md"
              onClick={() => setIsMobileOpen(true)}
              aria-label="Open sidebar"
              aria-expanded={isMobileOpen}
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
            <Breadcrumb pathname={pathname} sections={sections} />
          </div>
          <div className="flex items-center gap-2">
            <CommandPalette />
            <NotificationCenter />
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
  
  // Find the most specific match (longest href)
  const current = allItems
    .filter((i) => i.href === "/" ? pathname === "/" : pathname.startsWith(i.href))
    .sort((a, b) => b.href.length - a.href.length)[0];

  if (!current) return <div className="text-xs text-muted-foreground">&nbsp;</div>;

  const Icon = current.icon;
  
  return (
    <nav aria-label="Breadcrumb" className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
      <Link 
        href="/" 
        className="flex items-center text-slate-400 hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 rounded-sm"
        aria-label="Home"
      >
        <Home className="h-3.5 w-3.5" />
      </Link>
      
      <span className="text-slate-300" aria-hidden="true">/</span>
      
      <span className="text-slate-500 font-medium">{current.section}</span>
      
      <span className="text-slate-300" aria-hidden="true">/</span>
      
      <Link 
        href={current.href}
        className={cn(
          "flex items-center gap-1 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 rounded-sm",
          pathname === current.href ? "text-finance pointer-events-none" : "text-finance hover:text-primary"
        )}
        aria-current={pathname === current.href ? "page" : undefined}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {current.label}
      </Link>

      {/* Show sub-page if we are deeper than the menu item */}
      {pathname.length > current.href.length && pathname !== "/" && (
        <>
           <span className="text-slate-300" aria-hidden="true">/</span>
           <span className="text-slate-600 font-medium max-w-[150px] truncate" aria-current="page">
             {pathname.split('/').pop()?.replace(/-/g, ' ') || 'Details'}
           </span>
        </>
      )}
    </nav>
  );
}
