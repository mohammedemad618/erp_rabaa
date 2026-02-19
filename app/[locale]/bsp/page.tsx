import { BspConsole } from "@/modules/bsp/components/bsp-console";
import { buildBspDataset } from "@/modules/bsp/services/bsp-dataset";
import { transactionService } from "@/services/transaction-service";

export const dynamic = "force-dynamic";

export default async function BspPage() {
  const transactions = await transactionService.list();
  const dataset = buildBspDataset(transactions);

  return <BspConsole dataset={dataset} />;
}
