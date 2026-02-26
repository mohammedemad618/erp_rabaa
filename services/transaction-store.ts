import prisma from "@/lib/prisma";
import { runMongoCommand, toMongoDate } from "@/lib/mongo-helper";
import { logger } from "@/lib/logger";
import { getCustomer } from "@/modules/customers/customer-store";
import { getServiceTransactions } from "@/modules/services/services-transaction-bridge";
import type { TravelRequest } from "@/modules/travel/types";
import type { Transaction } from "@/modules/transactions/types";
import {
  getSalesTransitionOption,
  type SalesTransitionId,
} from "@/modules/sales/workflow/sales-state-machine";
import { applyTransactionWorkflowTransition } from "@/modules/transactions/utils/workflow-transition";

interface ApplySalesTransitionInput {
  orderId: string;
  transitionId: SalesTransitionId;
  pinToken?: string;
}

interface ApplySalesTransitionSuccess {
  ok: true;
  result: {
    orderId: string;
    fromState: Transaction["status"];
    toState: Transaction["status"];
    approvalState: Transaction["approvalState"];
    requiresPin: boolean;
    at: string;
    transaction: Transaction;
  };
}

interface ApplySalesTransitionFailure {
  ok: false;
  error: {
    code:
      | "order_not_found"
      | "transition_not_allowed"
      | "pin_required"
      | "invalid_pin";
    message: string;
  };
}

export type ApplySalesTransitionResult =
  | ApplySalesTransitionSuccess
  | ApplySalesTransitionFailure;

let legacySalesTransactionDataNormalized = false;

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * MongoDB helper to map Prisma model to Domain type
 */
function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function toIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value.trim().length > 0) return value;
  return new Date().toISOString();
}

function mapAccountingPreviewLine(
  line: any,
  fallbackCurrency: string,
  index: number,
): Transaction["accountingPreview"][number] {
  const debit =
    typeof line.debit === "number"
      ? line.debit
      : line.side === "debit" && typeof line.amount === "number"
        ? line.amount
        : 0;
  const credit =
    typeof line.credit === "number"
      ? line.credit
      : line.side === "credit" && typeof line.amount === "number"
        ? line.amount
        : 0;
  const side: "debit" | "credit" = debit > 0 || credit === 0 ? "debit" : "credit";
  const amount = side === "debit" ? debit : credit;
  return {
    id: typeof line.id === "string" ? line.id : `line-${index + 1}`,
    side,
    account:
      line.account ??
      line.accountCode ??
      line.description ??
      "General Ledger",
    amount: roundMoney(amount),
    currency:
      (typeof line.currency === "string" && line.currency.trim().length > 0
        ? line.currency
        : fallbackCurrency),
  };
}

function toPersistedAccountingPreview(
  lines: Transaction["accountingPreview"],
): Array<{
  id: string;
  accountCode: string;
  description: string;
  debit: number;
  credit: number;
  currency: string;
}> {
  return lines.map((line) => ({
    id: line.id,
    accountCode: line.account,
    description: line.account,
    debit: line.side === "debit" ? roundMoney(line.amount) : 0,
    credit: line.side === "credit" ? roundMoney(line.amount) : 0,
    currency: line.currency,
  }));
}

function inferPaymentMethodFromAccount(account: string): Transaction["paymentMethod"] {
  if (account === "POS Receivable") return "card";
  if (account === "Bank Clearing") return "bank";
  return "cash";
}

function mapPrismaToTransaction(data: any): Transaction {
  const currency =
    typeof data.currency === "string" && data.currency.trim().length > 0
      ? data.currency
      : "SAR";
  const accountingPreview: Transaction["accountingPreview"] = Array.isArray(data.accountingPreview)
    ? data.accountingPreview.map((line: any, index: number) =>
      mapAccountingPreviewLine(line, currency, index),
    )
    : [];
  const settlementLine = accountingPreview.find((line) => line.side === "debit");
  const inferredTotalAmount = roundMoney(
    accountingPreview
      .filter((line) => line.side === "debit")
      .reduce((sum, line) => sum + line.amount, 0),
  );
  const totalAmount =
    typeof data.totalAmount === "number" ? data.totalAmount : inferredTotalAmount;
  const taxAmountFromLedger = roundMoney(
    accountingPreview
      .filter((line) => line.side === "credit" && line.account === "Tax Payable")
      .reduce((sum, line) => sum + line.amount, 0),
  );
  const salesAmount =
    typeof data.salesAmount === "number"
      ? data.salesAmount
      : roundMoney(Math.max(totalAmount - taxAmountFromLedger, 0));
  const taxAmount =
    typeof data.taxAmount === "number" ? data.taxAmount : taxAmountFromLedger;
  const paymentMethod =
    data.paymentMethod ??
    inferPaymentMethodFromAccount(settlementLine?.account ?? "Cash");
  const createdAt = toIsoString(data.createdAt);
  const approvalTimeline = Array.isArray(data.approvalTimeline)
    ? data.approvalTimeline.map((step: any, index: number) => ({
      id: step.id ?? step.step ?? `step-${index + 1}`,
      actor: step.actor ?? step.by ?? "System",
      status: step.status as any,
      at: step.at ?? undefined,
      note: step.note ?? undefined,
    }))
    : [];
  const auditMetadata = data.auditMetadata
    ? {
      createdBy: data.auditMetadata.createdBy ?? "System",
      createdAt: toIsoString(data.auditMetadata.createdAt ?? createdAt),
      updatedBy: data.auditMetadata.updatedBy ?? data.auditMetadata.createdBy ?? "System",
      updatedAt: toIsoString(data.auditMetadata.updatedAt ?? createdAt),
      version:
        typeof data.auditMetadata.version === "number" &&
        Number.isFinite(data.auditMetadata.version)
          ? data.auditMetadata.version
          : 1,
    }
    : {
      createdBy: "System",
      createdAt,
      updatedBy: "System",
      updatedAt: toIsoString(data.updatedAt ?? createdAt),
      version: 1,
    };

  return {
    id: data.id,
    pnr: data.pnr ?? data.id,
    ticketNumber: data.ticketNumber ?? data.id,
    customerName: data.customerName ?? "Unknown Customer",
    customerPhone: data.customerPhone ?? "0000000000",
    airline: data.airline ?? "Travel Operations",
    branch: data.branch ?? "Riyadh HQ",
    salesAmount,
    taxAmount,
    totalAmount,
    currency,
    paymentMethod,
    status: data.status,
    approvalState: data.approvalState,
    agent: data.agent ?? auditMetadata.updatedBy,
    createdAt,
    issuedAt: data.issuedAt ?? createdAt,
    accountingPreview,
    approvalTimeline,
    auditMetadata,
  };
}

/* eslint-enable @typescript-eslint/no-explicit-any */

async function ensureSalesTransactionDataCompatibility(): Promise<void> {
  if (legacySalesTransactionDataNormalized) {
    return;
  }

  await runMongoCommand("sales_transactions", "update", {
    updates: [
      {
        q: { "accountingPreview.accountCode": null },
        u: { $set: { accountingPreview: [] } },
        multi: true,
      },
      {
        q: { "approvalTimeline.step": null },
        u: { $set: { approvalTimeline: [] } },
        multi: true,
      },
    ],
  });

  legacySalesTransactionDataNormalized = true;
}

async function ensureInitialTransactions(): Promise<void> {
  const count = await prisma.salesTransaction.count();
  if (count === 0) {
    const initialData = getServiceTransactions();
    logger.info("[Transactions] Seeding initial transactions...");
    for (const item of initialData) {
      try {
        await runMongoCommand("sales_transactions", "insert", {
          documents: [
            {
              _id: item.id,
              customerId: (item as any).customerId, // eslint-disable-line @typescript-eslint/no-explicit-any
              customerName: item.customerName,
              totalAmount: item.totalAmount,
              currency: item.currency,
              status: item.status,
              approvalState: item.approvalState,
              branch: item.branch,
              type: (item as any).type, // eslint-disable-line @typescript-eslint/no-explicit-any
              accountingPreview: toPersistedAccountingPreview(item.accountingPreview),
              approvalTimeline: item.approvalTimeline.map((step) => ({
                step: step.id,
                by: step.actor,
                status: step.status,
                at: step.at || "",
                note: step.note || null,
              })),
              auditMetadata: item.auditMetadata,
              pnr: item.pnr,
              ticketNumber: item.ticketNumber,
              customerPhone: item.customerPhone,
              airline: item.airline,
              salesAmount: item.salesAmount,
              taxAmount: item.taxAmount,
              paymentMethod: item.paymentMethod,
              agent: item.agent,
              issuedAt: item.issuedAt,
              createdAt: toMongoDate(item.auditMetadata.createdAt),
              updatedAt: toMongoDate(new Date()),
            },
          ],
        });
        logger.info(`[Transactions] Seeded transaction: ${item.id}`);
      } catch (e) {
        logger.error(`[Transactions] Failed to seed transaction ${item.id}:`, { error: e });
      }
    }
  }
}

/**
 * Public Data Access
 */

export async function listTransactions(): Promise<Transaction[]> {
  await ensureSalesTransactionDataCompatibility();
  await ensureInitialTransactions();
  const records = await prisma.salesTransaction.findMany({
    orderBy: { updatedAt: "desc" },
  });
  return records.map(mapPrismaToTransaction);
}

interface UpsertTravelSettlementTransactionInput {
  request: TravelRequest;
  actorName: string;
  at?: string;
}

export async function upsertTravelSettlementTransaction(
  input: UpsertTravelSettlementTransactionInput,
): Promise<void> {
  if (input.request.status !== "booked") {
    return;
  }

  const at = input.at ?? new Date().toISOString();
  const transactionId = `TRVTX-${input.request.id}`;
  const customer = input.request.customerId
    ? await getCustomer(input.request.customerId)
    : undefined;
  const customerName = customer?.name ?? input.request.employeeName;
  const customerPhone = customer?.phone ?? "0000000000";
  const customerId = input.request.customerId ?? `TRV-CUST-${input.request.id}`;
  const branch = /jeddah/i.test(input.request.department)
    ? "Jeddah Branch"
    : "Riyadh HQ";
  const totalAmount = roundMoney(
    input.request.booking?.totalBookedCost && input.request.booking.totalBookedCost > 0
      ? input.request.booking.totalBookedCost
      : input.request.estimatedCost,
  );
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    return;
  }
  const salesAmount = roundMoney(totalAmount / 1.15);
  const taxAmount = roundMoney(totalAmount - salesAmount);
  const currency =
    input.request.booking?.currency || input.request.currency || "SAR";

  const accountingPreview = [
    {
      id: `${transactionId}-L1`,
      accountCode: "Bank Clearing",
      description: `Travel receivable ${input.request.id}`,
      debit: totalAmount,
      credit: 0,
      currency,
    },
    {
      id: `${transactionId}-L2`,
      accountCode: "Travel Revenue",
      description: `Travel revenue ${input.request.id}`,
      debit: 0,
      credit: salesAmount,
      currency,
    },
    {
      id: `${transactionId}-L3`,
      accountCode: "Tax Payable",
      description: `Output tax ${input.request.id}`,
      debit: 0,
      credit: taxAmount,
      currency,
    },
  ];

  const approvalTimeline = [
    {
      step: "travel_booked",
      by: input.actorName,
      status: "approved",
      at,
      note: input.request.booking
        ? `Auto-created from travel request ${input.request.id}`
        : `Auto-created from booked travel request ${input.request.id} (booking details pending).`,
    },
    {
      step: "queue_payment",
      by: "Finance Automation",
      status: "pending",
      at,
      note: "Awaiting settlement.",
    },
  ];

  await runMongoCommand("sales_transactions", "update", {
    updates: [
      {
        q: { _id: transactionId },
        u: {
          $set: {
            customerId,
            customerName,
            customerPhone,
            pnr: input.request.booking?.bookingReference || input.request.id,
            ticketNumber: input.request.booking?.ticketNumber || input.request.id,
            airline: "Travel Operations",
            salesAmount,
            taxAmount,
            totalAmount,
            currency,
            paymentMethod: "bank",
            status: "pending_payment",
            approvalState: "approved",
            agent: input.actorName,
            issuedAt: at,
            branch,
            type: "travel_request",
            accountingPreview,
            approvalTimeline,
            auditMetadata: {
              createdBy: input.actorName,
              createdAt: at,
              updatedBy: input.actorName,
              updatedAt: at,
              version: 1,
            },
            updatedAt: toMongoDate(new Date(at)),
          },
          $setOnInsert: {
            createdAt: toMongoDate(new Date(at)),
          },
        },
        upsert: true,
        multi: false,
      },
    ],
  });
}

export async function applySalesTransition(
  input: ApplySalesTransitionInput,
): Promise<ApplySalesTransitionResult> {
  const record = await prisma.salesTransaction.findUnique({ where: { id: input.orderId } });
  if (!record) return { ok: false, error: { code: "order_not_found", message: "Not found." } };

  const current = mapPrismaToTransaction(record);
  const transition = getSalesTransitionOption(input.transitionId, {
    state: current.status,
    approvalState: current.approvalState,
  });

  if (!transition.allowed) {
    return { ok: false, error: { code: "transition_not_allowed", message: "Action not allowed." } };
  }

  if (transition.requiresPin && (!input.pinToken || input.pinToken !== "1234")) {
    return {
      ok: false,
      error: {
        code: input.pinToken ? "invalid_pin" : "pin_required",
        message: input.pinToken ? "Invalid PIN." : "PIN required.",
      },
    };
  }

  const at = new Date().toISOString();
  const updatedData = applyTransactionWorkflowTransition(current, {
    transitionId: input.transitionId,
    toStatus: transition.to,
    at,
  });

  await runMongoCommand("sales_transactions", "update", {
    updates: [
      {
        q: { _id: input.orderId },
        u: {
          $set: {
            status: updatedData.status,
            approvalState: updatedData.approvalState,
            approvalTimeline: updatedData.approvalTimeline.map((step) => ({
              step: step.id,
              by: step.actor,
              status: step.status,
              at: step.at || "",
              note: step.note || null,
            })),
            auditMetadata: updatedData.auditMetadata,
            updatedAt: toMongoDate(new Date()),
          },
        },
        multi: false,
      },
    ],
  });
  const updated = await prisma.salesTransaction.findUniqueOrThrow({ where: { id: input.orderId } });

  return {
    ok: true,
    result: {
      orderId: updated.id,
      fromState: current.status,
      toState: updated.status as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      approvalState: updated.approvalState as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      requiresPin: transition.requiresPin,
      at,
      transaction: mapPrismaToTransaction(updated),
    },
  };
}
