import {
  type AccountingLine,
  type ApprovalStep,
  type Transaction,
  type TransactionStatus,
} from "../types";

const AIRLINES = [
  "Saudi Airlines",
  "Qatar Airways",
  "Emirates",
  "Etihad",
  "Flynas",
  "Turkish Airlines",
];

const AGENTS = [
  "Amina Khalid",
  "Yasser Salem",
  "Lina Rahman",
  "Fadi Saad",
  "Nour Hassan",
];

const CUSTOMERS = [
  "Ahmed Al Dossary",
  "Mona Al Harbi",
  "Joseph Matta",
  "Raghad Al Otaibi",
  "Khaled Banat",
  "Rita Haddad",
];

const STATUSES: TransactionStatus[] = [
  "draft",
  "ocr_reviewed",
  "pending_approval",
  "approved",
  "pending_payment",
  "paid",
  "receipt_issued",
  "refunded",
  "voided",
];

function pad(input: number, length: number): string {
  return input.toString().padStart(length, "0");
}

function createAccountingLines(
  salesAmount: number,
  taxAmount: number,
  currency: string,
): AccountingLine[] {
  return [
    {
      id: "l1",
      side: "debit",
      account: "Cash",
      amount: salesAmount + taxAmount,
      currency,
    },
    {
      id: "l2",
      side: "credit",
      account: "Ticket Revenue",
      amount: salesAmount,
      currency,
    },
    {
      id: "l3",
      side: "credit",
      account: "Tax Payable",
      amount: taxAmount,
      currency,
    },
  ];
}

function createApprovalTimeline(status: TransactionStatus, at: string): ApprovalStep[] {
  const baseline: ApprovalStep[] = [
    {
      id: "s1",
      actor: "OCR Bot",
      status: status === "draft" ? "pending" : "approved",
      at,
      note: "Document parsed",
    },
    {
      id: "s2",
      actor: "Supervisor",
      status:
        status === "pending_approval" || status === "ocr_reviewed"
          ? "pending"
          : "approved",
      at,
      note: "Financial policy check",
    },
    {
      id: "s3",
      actor: "Finance Manager",
      status:
        status === "refunded" || status === "voided" ? "approved" : "pending",
      at,
      note: "High-risk action approval",
    },
  ];

  if (status === "voided") {
    baseline[2] = {
      ...baseline[2],
      status: "approved",
      note: "Voided with documented reason",
    };
  }

  return baseline;
}

function buildApprovalState(status: TransactionStatus): Transaction["approvalState"] {
  if (status === "draft" || status === "ocr_reviewed") {
    return "not_required";
  }
  if (status === "pending_approval") {
    return "pending";
  }
  if (status === "voided") {
    return "rejected";
  }
  return "approved";
}

export function generateMockTransactions(size = 2500): Transaction[] {
  const now = Date.now();

  return Array.from({ length: size }, (_, index) => {
    const status = STATUSES[index % STATUSES.length];
    const base = 800 + (index % 35) * 45;
    const tax = Math.round(base * 0.1);
    const createdAt = new Date(now - index * 13 * 60 * 1000).toISOString();
    const customer = CUSTOMERS[index % CUSTOMERS.length];
    const agent = AGENTS[index % AGENTS.length];
    const currency = "SAR";

    return {
      id: `TX-${pad(index + 1, 6)}`,
      pnr: `P${pad((index * 7) % 99999, 5)}`.slice(0, 6),
      ticketNumber: `117${pad(1000000000 + index, 10)}`.slice(0, 13),
      customerName: customer,
      customerPhone: `+9665${pad((index * 19) % 99999999, 8)}`,
      airline: AIRLINES[index % AIRLINES.length],
      branch: index % 2 === 0 ? "Riyadh HQ" : "Jeddah Branch",
      salesAmount: base,
      taxAmount: tax,
      totalAmount: base + tax,
      currency,
      paymentMethod: index % 3 === 0 ? "cash" : index % 3 === 1 ? "card" : "bank",
      status,
      approvalState: buildApprovalState(status),
      agent,
      createdAt,
      issuedAt: createdAt,
      accountingPreview: createAccountingLines(base, tax, currency),
      approvalTimeline: createApprovalTimeline(status, createdAt),
      auditMetadata: {
        createdBy: agent,
        createdAt,
        updatedBy: index % 4 === 0 ? "System Sync" : agent,
        updatedAt: createdAt,
        version: 1 + (index % 3),
      },
    };
  });
}
