import type { AuthUserRecord, AuthenticatedUser } from "@/services/auth/types";

const DEMO_USERS: AuthUserRecord[] = [
  {
    id: "U-1001",
    name: "System Administrator",
    email: "admin@enterprise.local",
    role: "admin",
    password: "Admin@12345",
  },
  {
    id: "U-1002",
    name: "Finance Controller",
    email: "finance@enterprise.local",
    role: "finance_manager",
    password: "Finance@12345",
  },
  {
    id: "U-1003",
    name: "Travel Agent",
    email: "agent@enterprise.local",
    role: "agent",
    password: "Agent@12345",
  },
  {
    id: "U-1004",
    name: "Internal Auditor",
    email: "auditor@enterprise.local",
    role: "auditor",
    password: "Auditor@12345",
  },
  {
    id: "U-1005",
    name: "Department Manager",
    email: "manager@enterprise.local",
    role: "manager",
    password: "Manager@12345",
  },
  {
    id: "U-1006",
    name: "Travel Desk Operator",
    email: "traveldesk@enterprise.local",
    role: "travel_desk",
    password: "TravelDesk@12345",
  },
];

function toAuthUser(record: AuthUserRecord): AuthenticatedUser {
  return {
    id: record.id,
    name: record.name,
    email: record.email,
    role: record.role,
  };
}

export function authenticateUser(
  email: string,
  password: string,
): AuthenticatedUser | null {
  const normalizedEmail = email.trim().toLowerCase();
  const record = DEMO_USERS.find(
    (item) => item.email.toLowerCase() === normalizedEmail && item.password === password,
  );
  return record ? toAuthUser(record) : null;
}

export function listDemoUsers(): Array<AuthenticatedUser & { password: string }> {
  return DEMO_USERS.map((record) => ({
    ...toAuthUser(record),
    password: record.password,
  }));
}
