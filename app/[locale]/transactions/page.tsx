import { TransactionWorkbench } from "@/modules/transactions/components/transaction-workbench";
import { transactionService } from "@/services/transaction-service";

export const dynamic = "force-dynamic";

export default async function TransactionsPage() {
  const transactions = await transactionService.list();
  return <TransactionWorkbench initialTransactions={transactions} />;
}
