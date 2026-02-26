import type { EnterpriseRole } from "@/services/auth/types";

export type AuthPermission =
  | "dashboard.view"
  | "transactions.view"
  | "accounting.view"
  | "bsp.view"
  | "treasury.view"
  | "crm.view"
  | "expenses.view"
  | "reports.view"
  | "ocr.view"
  | "templates.view"
  | "templates.manage"
  | "travel.view"
  | "travel.policy.view"
  | "travel.policy.manage"
  | "travel.create"
  | "travel.transition"
  | "travel.booking.manage"
  | "travel.expense.submit"
  | "travel.expense.review"
  | "travel.finance.sync"
  | "travel.auto_approve"
  | "travel.audit_export"
  | "sales.transition"
  | "ocr.extract"
  | "settings.view"
  | "settings.manage";

/** صلاح كامل — كل الصلاحيات في النظام (يُعطى لـ admin) */
export const FULL_PERMISSIONS: readonly AuthPermission[] = [
  "dashboard.view",
  "transactions.view",
  "accounting.view",
  "bsp.view",
  "treasury.view",
  "crm.view",
  "expenses.view",
  "reports.view",
  "ocr.view",
  "templates.view",
  "templates.manage",
  "travel.view",
  "travel.policy.view",
  "travel.policy.manage",
  "travel.create",
  "travel.transition",
  "travel.booking.manage",
  "travel.expense.submit",
  "travel.expense.review",
  "travel.finance.sync",
  "travel.auto_approve",
  "travel.audit_export",
  "sales.transition",
  "ocr.extract",
  "settings.view",
  "settings.manage",
] as const;

const ROLE_PERMISSIONS: Record<EnterpriseRole, AuthPermission[]> = {
  admin: [...FULL_PERMISSIONS],
  finance_manager: [
    "dashboard.view",
    "transactions.view",
    "accounting.view",
    "bsp.view",
    "treasury.view",
    "crm.view",
    "expenses.view",
    "reports.view",
    "ocr.view",
    "travel.view",
    "travel.policy.view",
    "travel.transition",
    "travel.expense.review",
    "travel.finance.sync",
    "travel.audit_export",
    "sales.transition",
    "ocr.extract",
    "settings.view",
  ],
  agent: [
    "dashboard.view",
    "transactions.view",
    "crm.view",
    "expenses.view",
    "ocr.view",
    "templates.view",
    "travel.view",
    "travel.policy.view",
    "travel.create",
    "travel.transition",
    "travel.expense.submit",
    "sales.transition",
    "ocr.extract",
  ],
  auditor: [
    "dashboard.view",
    "transactions.view",
    "accounting.view",
    "bsp.view",
    "treasury.view",
    "reports.view",
    "travel.view",
    "travel.policy.view",
    "travel.audit_export",
  ],
  manager: [
    "dashboard.view",
    "transactions.view",
    "crm.view",
    "expenses.view",
    "reports.view",
    "travel.view",
    "travel.policy.view",
    "travel.transition",
    "sales.transition",
  ],
  travel_desk: [
    "dashboard.view",
    "transactions.view",
    "expenses.view",
    "ocr.view",
    "travel.view",
    "travel.policy.view",
    "travel.transition",
    "travel.booking.manage",
    "sales.transition",
    "ocr.extract",
  ],
};

export function getRolePermissions(role: EnterpriseRole): AuthPermission[] {
  return [...ROLE_PERMISSIONS[role]];
}

export function hasPermission(role: EnterpriseRole, permission: AuthPermission): boolean {
  if (role === "admin") return true;
  return ROLE_PERMISSIONS[role].includes(permission);
}

/** تحقق إن كان الدور يملك الصلاح الكامل (كل الصلاحيات) */
export function hasFullPermissions(role: EnterpriseRole): boolean {
  if (role === "admin") return true;
  const perms = ROLE_PERMISSIONS[role];
  return perms.length === FULL_PERMISSIONS.length && FULL_PERMISSIONS.every((p) => perms.includes(p));
}
