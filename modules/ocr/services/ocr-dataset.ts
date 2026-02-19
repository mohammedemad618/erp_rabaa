import type { Transaction } from "@/modules/transactions/types";
import type { OcrDataset, OcrDocument, OcrField } from "../types";

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function confidence(seed: number, offset: number): number {
  const raw = 0.62 + ((seed + offset * 17) % 36) / 100;
  return round(Math.min(0.98, raw));
}

function acceptedByConfidence(value: number): boolean {
  return value >= 0.91;
}

function buildField(
  seed: number,
  id: string,
  key: string,
  label: string,
  value: string,
  type: OcrField["type"],
  bbox: OcrField["bbox"],
  offset: number,
): OcrField {
  const conf = confidence(seed, offset);
  return {
    id,
    key,
    label,
    value,
    confidence: conf,
    type,
    bbox,
    accepted: acceptedByConfidence(conf),
  };
}

function buildDocument(transaction: Transaction, index: number): OcrDocument {
  const seed = hashString(`${transaction.id}-${transaction.customerName}-${index}`);
  const issueDate = transaction.createdAt.slice(0, 10);

  const fields: OcrField[] = [
    buildField(
      seed,
      `f-${transaction.id}-1`,
      "passenger_name",
      "Passenger Name",
      transaction.customerName,
      "text",
      { page: 1, x: 8, y: 12, width: 40, height: 8 },
      1,
    ),
    buildField(
      seed,
      `f-${transaction.id}-2`,
      "ticket_number",
      "Ticket Number",
      transaction.ticketNumber,
      "number",
      { page: 1, x: 56, y: 12, width: 34, height: 7 },
      2,
    ),
    buildField(
      seed,
      `f-${transaction.id}-3`,
      "pnr",
      "PNR",
      transaction.pnr,
      "text",
      { page: 1, x: 8, y: 24, width: 24, height: 7 },
      3,
    ),
    buildField(
      seed,
      `f-${transaction.id}-4`,
      "issue_date",
      "Issue Date",
      issueDate,
      "date",
      { page: 1, x: 56, y: 24, width: 26, height: 7 },
      4,
    ),
    buildField(
      seed,
      `f-${transaction.id}-5`,
      "base_fare",
      "Base Fare",
      transaction.salesAmount.toFixed(2),
      "currency",
      { page: 1, x: 8, y: 42, width: 26, height: 7 },
      5,
    ),
    buildField(
      seed,
      `f-${transaction.id}-6`,
      "tax",
      "Tax",
      transaction.taxAmount.toFixed(2),
      "currency",
      { page: 1, x: 37, y: 42, width: 22, height: 7 },
      6,
    ),
    buildField(
      seed,
      `f-${transaction.id}-7`,
      "total",
      "Total",
      transaction.totalAmount.toFixed(2),
      "currency",
      { page: 1, x: 62, y: 42, width: 28, height: 7 },
      7,
    ),
    buildField(
      seed,
      `f-${transaction.id}-8`,
      "airline",
      "Airline",
      transaction.airline,
      "text",
      { page: 1, x: 8, y: 58, width: 38, height: 7 },
      8,
    ),
    buildField(
      seed,
      `f-${transaction.id}-9`,
      "customer_phone",
      "Customer Phone",
      transaction.customerPhone,
      "phone",
      { page: 1, x: 56, y: 58, width: 34, height: 7 },
      9,
    ),
  ];

  const averageConfidence = round(
    fields.reduce((sum, field) => sum + field.confidence, 0) / fields.length,
  );

  return {
    id: `OCR-${(index + 1).toString().padStart(4, "0")}`,
    sourceName: `ticket-${transaction.ticketNumber}.pdf`,
    transactionId: transaction.id,
    createdAt: transaction.createdAt,
    branch: transaction.branch,
    averageConfidence,
    fields,
  };
}

export function buildOcrDataset(transactions: Transaction[]): OcrDataset {
  const candidates = transactions
    .filter((transaction) => transaction.status !== "draft")
    .slice(0, 160);

  return {
    documents: candidates.map((transaction, index) => buildDocument(transaction, index)),
  };
}
