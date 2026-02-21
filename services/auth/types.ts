export type EnterpriseRole =
  | "admin"
  | "finance_manager"
  | "agent"
  | "auditor"
  | "manager"
  | "travel_desk";

export interface AuthUserRecord {
  id: string;
  name: string;
  email: string;
  role: EnterpriseRole;
  password: string;
}

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: EnterpriseRole;
}

export interface SessionPayload extends AuthenticatedUser {
  iat: number;
  exp: number;
}
