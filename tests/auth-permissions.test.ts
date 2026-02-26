import assert from "node:assert/strict";
import test from "node:test";
import { hasPermission } from "../services/auth/rbac";
import { authenticateUser } from "../services/auth/user-directory";

type EnvSnapshot = {
  nodeEnv: string | undefined;
  allowDemoAccounts: string | undefined;
};

function captureEnv(): EnvSnapshot {
  return {
    nodeEnv: process.env.NODE_ENV,
    allowDemoAccounts: process.env.ALLOW_DEMO_ACCOUNTS,
  };
}

function restoreEnv(snapshot: EnvSnapshot): void {
  if (snapshot.nodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = snapshot.nodeEnv;
  }

  if (snapshot.allowDemoAccounts === undefined) {
    delete process.env.ALLOW_DEMO_ACCOUNTS;
  } else {
    process.env.ALLOW_DEMO_ACCOUNTS = snapshot.allowDemoAccounts;
  }
}

test("demo accounts authenticate in development mode", async () => {
  const snapshot = captureEnv();
  try {
    process.env.NODE_ENV = "development";
    delete process.env.ALLOW_DEMO_ACCOUNTS;

    const accounts = [
      ["admin@enterprise.local", "Admin@12345", "admin"],
      ["finance@enterprise.local", "Finance@12345", "finance_manager"],
      ["agent@enterprise.local", "Agent@12345", "agent"],
      ["auditor@enterprise.local", "Auditor@12345", "auditor"],
      ["manager@enterprise.local", "Manager@12345", "manager"],
      ["traveldesk@enterprise.local", "TravelDesk@12345", "travel_desk"],
    ] as const;

    for (const [email, password, role] of accounts) {
      const user = await authenticateUser(email, password);
      assert.ok(user, `Expected demo account ${email} to authenticate.`);
      assert.equal(user.role, role);
    }
  } finally {
    restoreEnv(snapshot);
  }
});

test("demo accounts are disabled in production by default", async () => {
  const snapshot = captureEnv();
  try {
    process.env.NODE_ENV = "production";
    delete process.env.ALLOW_DEMO_ACCOUNTS;

    const user = await authenticateUser("admin@enterprise.local", "Admin@12345");
    assert.equal(user, null);
  } finally {
    restoreEnv(snapshot);
  }
});

test("ALLOW_DEMO_ACCOUNTS=true enables demo accounts in production", async () => {
  const snapshot = captureEnv();
  try {
    process.env.NODE_ENV = "production";
    process.env.ALLOW_DEMO_ACCOUNTS = "true";

    const user = await authenticateUser("admin@enterprise.local", "Admin@12345");
    assert.ok(user);
    assert.equal(user.role, "admin");
  } finally {
    restoreEnv(snapshot);
  }
});

test("role permission boundaries remain enforced for service operations", () => {
  assert.equal(hasPermission("auditor", "travel.transition"), false);
  assert.equal(hasPermission("auditor", "settings.manage"), false);

  assert.equal(hasPermission("manager", "settings.manage"), false);
  assert.equal(hasPermission("agent", "settings.manage"), false);

  assert.equal(hasPermission("finance_manager", "travel.transition"), true);
  assert.equal(hasPermission("travel_desk", "travel.transition"), true);
});
