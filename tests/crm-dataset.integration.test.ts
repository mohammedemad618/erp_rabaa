import assert from "node:assert/strict";
import test from "node:test";
import { buildCrmDataset } from "../modules/crm/services/crm-dataset";
import type { Customer } from "../modules/customers/types";
import type { Transaction } from "../modules/transactions/types";

function createTransaction(customer: Customer): Transaction {
  const timestamp = "2036-01-02T10:00:00.000Z";
  return {
    id: "TX-CRM-001",
    pnr: "PNR-CRM-001",
    ticketNumber: "TKT-CRM-001",
    customerName: customer.name,
    customerPhone: customer.phone,
    airline: "Saudia",
    branch: "Riyadh",
    salesAmount: 1000,
    taxAmount: 200,
    totalAmount: 1200,
    currency: "SAR",
    paymentMethod: "bank",
    status: "approved",
    approvalState: "approved",
    agent: "Integration Agent",
    createdAt: timestamp,
    issuedAt: timestamp,
    accountingPreview: [
      {
        id: "ACC-CRM-001-D",
        side: "debit",
        account: "Bank Clearing",
        amount: 1200,
        currency: "SAR",
      },
      {
        id: "ACC-CRM-001-C",
        side: "credit",
        account: "Ticket Revenue",
        amount: 1200,
        currency: "SAR",
      },
    ],
    approvalTimeline: [
      {
        id: "APR-CRM-001",
        actor: "Manager",
        status: "approved",
        at: timestamp,
      },
    ],
    auditMetadata: {
      createdBy: "System",
      createdAt: timestamp,
      updatedBy: "System",
      updatedAt: timestamp,
      version: 1,
    },
  };
}

test("buildCrmDataset includes known customers without transactions", () => {
  const knownCustomers: Customer[] = [
    {
      id: "CUST-CRM-001",
      name: "Acme Logistics",
      phone: "+966500000001",
      email: "acme.logistics@enterprise.local",
      segment: "growth",
      createdAt: "2036-01-01T09:00:00.000Z",
    },
    {
      id: "CUST-CRM-002",
      name: "Nile Group",
      phone: "+966500000002",
      email: "nile.group@enterprise.local",
      segment: "starter",
      createdAt: "2036-01-01T10:00:00.000Z",
    },
  ];

  const dataset = buildCrmDataset([], [], [], knownCustomers);
  assert.equal(dataset.totals.customers, 2);
  assert.deepEqual(
    new Set(dataset.customers.map((customer) => customer.id)),
    new Set(["CUST-CRM-001", "CUST-CRM-002"]),
  );
});

test("buildCrmDataset does not duplicate known customer when transactions match", () => {
  const customer: Customer = {
    id: "CUST-CRM-100",
    name: "Unified Trading",
    phone: "+966500001000",
    email: "unified.trading@enterprise.local",
    segment: "strategic",
    createdAt: "2036-01-01T09:00:00.000Z",
  };

  const dataset = buildCrmDataset([createTransaction(customer)], [], [], [customer]);
  assert.equal(dataset.totals.customers, 1);
  assert.equal(dataset.customers[0]?.id, customer.id);
  assert.equal(dataset.customers[0]?.totalBookings, 1);
  assert.equal(dataset.customers[0]?.totalSales, 1200);
});
