import prisma from "@/lib/prisma";
import { runMongoCommand, toMongoDate } from "@/lib/mongo-helper";
import { logger } from "@/lib/logger";
import type { AuthUserRecord, AuthenticatedUser } from "@/services/auth/types";

const INITIAL_USERS: AuthUserRecord[] = [
  {
    id: "U-1001",
    name: "System Administrator",
    email: "admin@enterprise.local",
    role: "admin",
    password: "Admin@12345",
  },
  {
    id: "U-1002",
    name: "Finance Manager",
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
    name: "Travel Desk Officer",
    email: "traveldesk@enterprise.local",
    role: "travel_desk",
    password: "TravelDesk@12345",
  },
];

async function ensureInitialUsers(): Promise<void> {
  const count = await prisma.user.count();
  if (count === 0) {
    logger.info("[Auth] Database is empty. Seeding initial users...");
    for (const user of INITIAL_USERS) {
      try {
        // Use raw MongoDB command via helper to bypass Prisma's internal transaction requirements
        // for simple insertions in standalone (non-replica-set) MongoDB instances.
        await runMongoCommand("users", "insert", {
          documents: [
            {
              _id: user.id,
              name: user.name,
              email: user.email,
              role: user.role,
              password: user.password,
              createdAt: toMongoDate(new Date()),
              updatedAt: toMongoDate(new Date()),
            },
          ],
        });
        logger.info(`[Auth] Seeded user: ${user.email}`);
      } catch (e) {
        logger.error(`[Auth] Failed to seed user ${user.email} using raw command:`, { error: e });
      }
    }
  }
}

function areDemoAccountsEnabled(): boolean {
  const override = process.env.ALLOW_DEMO_ACCOUNTS?.trim().toLowerCase();
  if (override === "false") return false;
  if (override === "true") return true;
  // Demo authentication is enabled by default in non-production environments only.
  return process.env.NODE_ENV !== "production";
}

export async function authenticateUser(
  email: string,
  password: string,
): Promise<AuthenticatedUser | null> {
  if (!areDemoAccountsEnabled()) return null;

  // Cache key for user lookup (password validation still needs to happen, but we can cache the user record lookup)
  // However, for security, we should be careful. 
  // In this demo implementation with plain text passwords (as per existing code), 
  // we will just add logging.

  await ensureInitialUsers();

  const emailTrimmed = email.trim().toLowerCase();
  logger.info(`[Auth] Attempting login for: ${emailTrimmed}`);

  const record = await prisma.user.findUnique({
    where: { email: emailTrimmed },
  });

  if (!record) {
    logger.warn(`[Auth] User not found: ${emailTrimmed}`);
    return null;
  }

  // In a real app, use bcrypt.compare(password, record.passwordHash)
  if (record.password !== password) {
    logger.warn(`[Auth] Invalid password for: ${emailTrimmed}`);
    return null;
  }

  logger.info(`[Auth] Login successful: ${emailTrimmed}`);
  return {
    id: record.id,
    email: record.email,
    name: record.name,
    role: record.role as any, // eslint-disable-line @typescript-eslint/no-explicit-any
  };
}
