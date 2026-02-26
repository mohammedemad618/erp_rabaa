import type { Transaction } from "@/modules/transactions/types";
import type { TravelRequest } from "@/modules/travel/types";

export type OperationType = "transaction" | "travel_request";

export interface OperationsListItem {
  id: string;
  type: OperationType;
  displayId: string;
  customerOrEmployee: string;
  amount: number;
  currency: string;
  status: string;
  statusDisplayKey: string;
  createdAt: string;
  raw: Transaction | TravelRequest;
}

export type OperationFilterType = "all" | "transactions" | "travel";
