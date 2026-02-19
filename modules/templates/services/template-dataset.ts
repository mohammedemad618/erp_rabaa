import type { Transaction } from "@/modules/transactions/types";
import type { TemplateDataset } from "../types";

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function buildTemplateDataset(transactions: Transaction[]): TemplateDataset {
  const source = transactions[0];

  if (!source) {
    return {
      snapshot: {
        templateId: "TPL-001",
        defaultName: "Corporate Itinerary",
        defaultHeader: "Travel Confirmation",
        defaultFooter: "Prepared by Enterprise Travel ERP",
        generatedAt: new Date().toISOString(),
        transactionId: "TX-000000",
        customerName: "Guest Traveler",
        branch: "Riyadh HQ",
        currency: "SAR",
        totalAmount: 0,
        items: [
          {
            id: "ITEM-01",
            label: "Base Fare",
            description: "Default placeholder line",
            amount: 0,
          },
        ],
      },
    };
  }

  const amount = roundMoney(source.salesAmount);
  const tax = roundMoney(source.taxAmount);
  const serviceFee = roundMoney(source.totalAmount * 0.03);
  const grandTotal = roundMoney(amount + tax + serviceFee);

  return {
    snapshot: {
      templateId: "TPL-001",
      defaultName: "Corporate Itinerary",
      defaultHeader: "Travel Confirmation",
      defaultFooter: "Prepared by Enterprise Travel ERP",
      generatedAt: source.createdAt,
      transactionId: source.id,
      customerName: source.customerName,
      branch: source.branch,
      currency: source.currency,
      totalAmount: grandTotal,
      items: [
        {
          id: "ITEM-01",
          label: "Base Fare",
          description: source.airline,
          amount,
        },
        {
          id: "ITEM-02",
          label: "Tax",
          description: "Government and airport tax",
          amount: tax,
        },
        {
          id: "ITEM-03",
          label: "Service Fee",
          description: "Agency processing",
          amount: serviceFee,
        },
      ],
    },
  };
}
