"use client";

import {
  BarChart3,
  Calculator,
  Cog,
  ChevronDown,
  FileText,
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

interface AppShellProps {
  children: ReactNode;
}

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

type NavGroupId = "control" | "finance" | "ocr" | "customer" | "documents";

type NavSubgroupId =
  | "overview"
  | "salesFlow"
  | "accountingFlow"
  | "reconciliation"
  | "ocrOperations"
  | "relations"
  | "intelligence"
  | "automation"
  | "publishing";

interface NavSubgroup {
  id: NavSubgroupId;
  label: string;
  items: NavItem[];
}

interface NavGroup {
  id: NavGroupId;
  label: string;
  icon: LucideIcon;
  subgroups: NavSubgroup[];
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
  const tNavGroups = useTranslations("navGroups");
  const tNavSubgroups = useTranslations("navSubgroups");
  const tApp = useTranslations("app");
  const tAuth = useTranslations("auth");
  const tRoles = useTranslations("roles");
  const pathname = usePathname();
  const isLoginRoute = pathname === "/login";

  const navigation: NavGroup[] = [
    {
      id: "control",
      label: tNavGroups("control"),
      icon: LayoutDashboard,
      subgroups: [
        {
          id: "overview",
          label: tNavSubgroups("overview"),
          items: [
            { href: "/", label: tNav("dashboard"), icon: LayoutDashboard },
            { href: "/settings", label: tNav("settings"), icon: Cog },
          ],
        },
      ],
    },
    {
      id: "finance",
      label: tNavGroups("finance"),
      icon: Calculator,
      subgroups: [
        {
          id: "salesFlow",
          label: tNavSubgroups("salesFlow"),
          items: [
            {
              href: "/travel",
              label: tNav("travel"),
              icon: Plane,
            },
            { href: "/transactions", label: tNav("transactions"), icon: Ticket },
            { href: "/expenses", label: tNav("expenses"), icon: ReceiptText },
          ],
        },
        {
          id: "accountingFlow",
          label: tNavSubgroups("accountingFlow"),
          items: [
            { href: "/accounting", label: tNav("accounting"), icon: Calculator },
            { href: "/treasury", label: tNav("treasury"), icon: Landmark },
          ],
        },
        {
          id: "reconciliation",
          label: tNavSubgroups("reconciliation"),
          items: [{ href: "/bsp", label: tNav("bsp"), icon: Scale }],
        },
      ],
    },
    {
      id: "ocr",
      label: tNavGroups("ocr"),
      icon: FileText,
      subgroups: [
        {
          id: "ocrOperations",
          label: tNavSubgroups("ocrOperations"),
          items: [{ href: "/ocr", label: tNav("ocr"), icon: FileText }],
        },
      ],
    },
    {
      id: "customer",
      label: tNavGroups("customer"),
      icon: Users,
      subgroups: [
        {
          id: "relations",
          label: tNavSubgroups("relations"),
          items: [{ href: "/crm", label: tNav("crm"), icon: Users }],
        },
        {
          id: "intelligence",
          label: tNavSubgroups("intelligence"),
          items: [{ href: "/reports", label: tNav("reports"), icon: BarChart3 }],
        },
      ],
    },
    {
      id: "documents",
      label: tNavGroups("documents"),
      icon: Printer,
      subgroups: [
        {
          id: "publishing",
          label: tNavSubgroups("publishing"),
          items: [{ href: "/templates", label: tNav("templates"), icon: Printer }],
        },
      ],
    },
  ];

  const [expandedGroups, setExpandedGroups] = useState<Record<NavGroupId, boolean>>({
    control: false,
    finance: false,
    ocr: false,
    customer: false,
    documents: false,
  });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [contentVersion, setContentVersion] = useState(0);
  const [authLoading, setAuthLoading] = useState(true);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [sessionPermissions, setSessionPermissions] = useState<string[]>([]);

  useEffect(() => {
    const refreshContent = () => {
      setContentVersion((previous) => previous + 1);
    };

    const handleStorageChanged = (event: StorageEvent) => {
      if (event.key && event.key !== SETTINGS_STORAGE_KEY) {
        return;
      }
      refreshContent();
    };

    window.addEventListener(SETTINGS_CHANGED_EVENT, refreshContent);
    window.addEventListener("storage", handleStorageChanged);

    return () => {
      window.removeEventListener(SETTINGS_CHANGED_EVENT, refreshContent);
      window.removeEventListener("storage", handleStorageChanged);
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
        if (!active) {
          return;
        }

        if (payload.authenticated && payload.user) {
          setSessionUser(payload.user);
          setSessionPermissions(Array.isArray(payload.permissions) ? payload.permissions : []);
        } else {
          setSessionUser(null);
          setSessionPermissions([]);
        }
      } catch {
        if (!active) {
          return;
        }
        setSessionUser(null);
        setSessionPermissions([]);
      } finally {
        if (active) {
          setAuthLoading(false);
        }
      }
    }

    setAuthLoading(true);
    void loadSession();

    return () => {
      active = false;
    };
  }, [pathname]);

  function isRouteActive(href: string): boolean {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  function toggleGroup(groupId: NavGroupId): void {
    setExpandedGroups((previous) => ({
      ...previous,
      [groupId]: !previous[groupId],
    }));
  }

  function canAccessRoute(href: string): boolean {
    if (!sessionUser) {
      return false;
    }
    const requiredPermission = requiredPermissionForRoute(href);
    if (!requiredPermission) {
      return false;
    }
    return sessionPermissions.includes(requiredPermission);
  }

  async function logout(): Promise<void> {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });
    } catch {
      // no-op
    }
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

  return (
    <div
      className={cn(
        "grid min-h-screen transition-all duration-300",
        isSidebarCollapsed ? "lg:grid-cols-[80px_1fr]" : "lg:grid-cols-[260px_1fr]"
      )}
    >
      <aside className="no-print border-e border-border glass-panel flex flex-col justify-between">
        <div className="flex h-[calc(100vh-4rem)] flex-col p-4">
          <div className={cn("mb-6 flex items-center", isSidebarCollapsed ? "justify-center" : "justify-between")}>
            {!isSidebarCollapsed && (
              <div>
                <p className="text-sm font-semibold tracking-wide text-primary">{tApp("name")}</p>
                <h1 className="mt-1 text-lg font-bold text-finance">{tApp("product")}</h1>
                <p className="mt-1 text-xs text-muted-foreground">{tApp("subtitle")}</p>
              </div>
            )}
          </div>

          <nav className="space-y-2 overflow-y-auto pe-1">
            {navigation.map((group) => {
              const visibleSubgroups = group.subgroups
                .map((subgroup) => ({
                  ...subgroup,
                  items: subgroup.items.filter((item) => canAccessRoute(item.href)),
                }))
                .filter((subgroup) => subgroup.items.length > 0);

              if (!visibleSubgroups.length) {
                return null;
              }

              const GroupIcon = group.icon;
              const hasActiveItem = visibleSubgroups.some((subgroup) =>
                subgroup.items.some((item) => isRouteActive(item.href)),
              );
              const isExpanded = hasActiveItem || expandedGroups[group.id];

              return (
                <section key={group.id} className="rounded-md border border-slate-200/50 bg-white/40 mb-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (isSidebarCollapsed) setIsSidebarCollapsed(false);
                      toggleGroup(group.id);
                    }}
                    className={cn(
                      "flex w-full items-center rounded-md px-2.5 py-2 text-xs font-semibold transition",
                      hasActiveItem
                        ? "text-primary bg-primary/5"
                        : "text-muted-foreground hover:bg-slate-100 hover:text-foreground",
                      isSidebarCollapsed ? "justify-center" : "justify-between"
                    )}
                    title={isSidebarCollapsed ? group.label : undefined}
                  >
                    <span className="flex items-center gap-2">
                      <GroupIcon className={cn("h-4 w-4", isSidebarCollapsed && "h-5 w-5")} />
                      {!isSidebarCollapsed && group.label}
                    </span>
                    {!isSidebarCollapsed && (
                      <ChevronDown
                        className={cn("h-3.5 w-3.5 transition", isExpanded ? "rotate-180" : "")}
                      />
                    )}
                  </button>

                  {isExpanded && !isSidebarCollapsed ? (
                    <div className="mb-1 space-y-2 border-s border-border/70 pb-2 ps-2 pe-1">
                      {visibleSubgroups.map((subgroup) => (
                        <div key={`${group.id}-${subgroup.id}`} className="space-y-1">
                          <p className="px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                            {subgroup.label}
                          </p>
                          {subgroup.items.map((item) => {
                            const ItemIcon = item.icon;
                            const isActive = isRouteActive(item.href);

                            return (
                              <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition",
                                  isActive
                                    ? "bg-primary text-primary-foreground"
                                    : "text-muted-foreground hover:bg-slate-100 hover:text-foreground",
                                )}
                              >
                                <ItemIcon className="h-4 w-4" />
                                {item.label}
                              </Link>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </section>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-border/50">
          <button
            type="button"
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="flex w-full items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-slate-100 hover:text-foreground transition"
            title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            <ChevronDown className={cn("h-5 w-5 transition-transform", isSidebarCollapsed ? "-rotate-90" : "rotate-90")} />
          </button>
        </div>
      </aside>

      <div className="flex min-h-screen flex-col bg-slate-50/30">
        <header className="no-print sticky top-0 z-20 flex items-center justify-between border-b border-border glass-panel px-4 py-3 lg:px-6">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-full bg-slate-100 px-2 py-1">
              {sessionUser?.name ?? "-"}
            </span>
            <span className="rounded-full bg-blue-50 px-2 py-1 text-blue-700">
              {roleLabelMap[sessionUser?.role ?? ""] ?? sessionUser?.role ?? "-"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <LocaleSwitcher />
            <button
              type="button"
              onClick={() => void logout()}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-white px-2.5 py-1.5 text-xs text-foreground hover:bg-slate-100"
            >
              <LogOut className="h-3.5 w-3.5" />
              {tAuth("logout")}
            </button>
          </div>
        </header>

        <main key={contentVersion} className="print-sheet flex-1 p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

