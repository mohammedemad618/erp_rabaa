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

const ROLE_PERMISSIONS: Record<EnterpriseRole, AuthPermission[]> = {
  admin: [
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
  ],
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
  return ROLE_PERMISSIONS[role].includes(permission);
}
