import { listTransactions } from "@/services/transaction-store";
import type { Transaction } from "@/modules/transactions/types";

export const transactionService = {
  async list(): Promise<Transaction[]> {
    return await listTransactions();
  },
};
