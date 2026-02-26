import type { AuthPermission } from "@/services/auth/rbac";

export const PAGE_PERMISSION_BY_ROUTE: Record<string, AuthPermission> = {
  "/": "dashboard.view",
  "/operations": "dashboard.view",
  "/operations/new": "travel.create",
  "/travel": "travel.view",
  "/travel/create": "travel.create",
  "/settings": "settings.view",
  "/transactions": "transactions.view",
  "/accounting": "accounting.view",
  "/bsp": "bsp.view",
  "/treasury": "treasury.view",
  "/crm": "crm.view",
  "/crm/create": "crm.view",
  "/expenses": "expenses.view",
  "/reports": "reports.view",
  "/ocr": "ocr.view",
  "/templates": "templates.view",
  "/services": "dashboard.view",
  "/services/hotels": "dashboard.view",
  "/services/cars": "dashboard.view",
  "/services/visa": "dashboard.view",
  "/services/insurance": "dashboard.view",
  "/services/tours": "dashboard.view",
  "/services/transfers": "dashboard.view",
  "/services/manage": "settings.manage",
};

export function requiredPermissionForRoute(route: string): AuthPermission | null {
  return PAGE_PERMISSION_BY_ROUTE[route] ?? null;
}
