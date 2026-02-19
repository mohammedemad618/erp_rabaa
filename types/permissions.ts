export type ProtectedAction =
  | "approve"
  | "refund"
  | "void"
  | "delete"
  | "financial_override";

export interface PermissionResult {
  allowed: boolean;
  reason?: string;
  requiresPin?: boolean;
}
