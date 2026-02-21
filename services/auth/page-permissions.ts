import type { AuthPermission } from "@/services/auth/rbac";

export const PAGE_PERMISSION_BY_ROUTE: Record<string, AuthPermission> = {
  "/": "dashboard.view",
  "/travel": "travel.view",
  "/settings": "settings.view",
  "/transactions": "transactions.view",
  "/accounting": "accounting.view",
  "/bsp": "bsp.view",
  "/treasury": "treasury.view",
  "/crm": "crm.view",
  "/expenses": "expenses.view",
  "/reports": "reports.view",
  "/ocr": "ocr.view",
  "/templates": "templates.view",
};

export function requiredPermissionForRoute(route: string): AuthPermission | null {
  return PAGE_PERMISSION_BY_ROUTE[route] ?? null;
}
