import { ExpensesConsole } from "@/modules/expenses/components/expenses-console";
import { buildExpenseDataset } from "@/modules/expenses/services/expense-dataset";
import { transactionService } from "@/services/transaction-service";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const transactions = await transactionService.list();
  const dataset = buildExpenseDataset(transactions);

  return <ExpensesConsole dataset={dataset} />;
}
