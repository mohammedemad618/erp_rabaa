import assert from "node:assert/strict";
import test from "node:test";
import {
  createCustomer,
  getCustomer,
  listCustomers,
  searchCustomers,
} from "../modules/customers/customer-store";

function randomSuffix(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

test("createCustomer persists and is retrievable by list/search/get", async () => {
  const suffix = randomSuffix();
  const payload = {
    name: `Integration Customer ${suffix}`,
    phone: `+9665${Math.floor(Math.random() * 90000000 + 10000000)}`,
    email: `integration.customer.${suffix}@enterprise.local`,
    segment: "growth" as const,
  };

  const created = await createCustomer(payload);
  assert.equal(created.ok, true, created.ok ? undefined : created.error.message);
  if (!created.ok) {
    return;
  }

  const listed = await listCustomers();
  assert.ok(
    listed.some((customer) => customer.id === created.result.id),
    "Expected created customer to appear in listCustomers.",
  );

  const searched = await searchCustomers(payload.name.split(" ").slice(-1)[0], 10);
  assert.ok(
    searched.some((customer) => customer.id === created.result.id),
    "Expected created customer to appear in searchCustomers results.",
  );

  const loaded = await getCustomer(created.result.id);
  assert.ok(loaded, "Expected getCustomer to return the created customer.");
  if (!loaded) {
    return;
  }
  assert.equal(loaded.email, payload.email.toLowerCase());
  assert.equal(loaded.phone, payload.phone);
});

test("createCustomer rejects duplicates by phone and email", async () => {
  const suffix = randomSuffix();
  const phone = `+9665${Math.floor(Math.random() * 90000000 + 10000000)}`;
  const email = `duplicate.customer.${suffix}@enterprise.local`;

  const first = await createCustomer({
    name: `Duplicate Seed ${suffix}`,
    phone,
    email,
    segment: "starter",
  });
  assert.equal(first.ok, true, first.ok ? undefined : first.error.message);
  if (!first.ok) {
    return;
  }

  const duplicatePhone = await createCustomer({
    name: `Duplicate Phone ${suffix}`,
    phone,
    email: `other.${suffix}@enterprise.local`,
    segment: "starter",
  });
  assert.equal(duplicatePhone.ok, false);
  if (duplicatePhone.ok) {
    return;
  }
  assert.equal(duplicatePhone.error.code, "duplicate_customer");

  const duplicateEmail = await createCustomer({
    name: `Duplicate Email ${suffix}`,
    phone: `+9665${Math.floor(Math.random() * 90000000 + 10000000)}`,
    email,
    segment: "starter",
  });
  assert.equal(duplicateEmail.ok, false);
  if (duplicateEmail.ok) {
    return;
  }
  assert.equal(duplicateEmail.error.code, "duplicate_customer");
});

test("searchCustomers supports lookup by id, email, and normalized phone", async () => {
  const suffix = randomSuffix();
  const phone = `+9665${Math.floor(Math.random() * 90000000 + 10000000)}`;
  const email = `search.customer.${suffix}@enterprise.local`;

  const created = await createCustomer({
    name: `Search Target ${suffix}`,
    phone,
    email,
    segment: "growth",
  });
  assert.equal(created.ok, true, created.ok ? undefined : created.error.message);
  if (!created.ok) {
    return;
  }

  const byId = await searchCustomers(created.result.id, 10);
  assert.ok(
    byId.some((customer) => customer.id === created.result.id),
    "Expected search by id to include the created customer.",
  );

  const byEmail = await searchCustomers(email.toUpperCase(), 10);
  assert.ok(
    byEmail.some((customer) => customer.id === created.result.id),
    "Expected search by email to include the created customer.",
  );

  const normalizedPhoneQuery = phone.replace(/[^\d]/g, "");
  const byPhone = await searchCustomers(normalizedPhoneQuery, 10);
  assert.ok(
    byPhone.some((customer) => customer.id === created.result.id),
    "Expected search by normalized phone to include the created customer.",
  );
});
