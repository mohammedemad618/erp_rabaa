import { AccountingConsole } from "@/modules/accounting/components/accounting-console";
import { buildAccountingDataset } from "@/modules/accounting/services/accounting-dataset";
import { transactionService } from "@/services/transaction-service";

export const dynamic = "force-dynamic";

export default async function AccountingPage() {
  const transactions = await transactionService.list();
  const dataset = buildAccountingDataset(transactions);

  return <AccountingConsole dataset={dataset} />;
}
