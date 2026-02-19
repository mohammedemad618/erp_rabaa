import { TreasuryConsole } from "@/modules/treasury/components/treasury-console";
import { buildTreasuryDataset } from "@/modules/treasury/services/treasury-dataset";
import { transactionService } from "@/services/transaction-service";

export const dynamic = "force-dynamic";

export default async function TreasuryPage() {
  const transactions = await transactionService.list();
  const dataset = buildTreasuryDataset(transactions);

  return <TreasuryConsole dataset={dataset} />;
}
