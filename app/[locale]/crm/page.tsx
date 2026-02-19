import { CrmConsole } from "@/modules/crm/components/crm-console";
import { buildCrmDataset } from "@/modules/crm/services/crm-dataset";
import { transactionService } from "@/services/transaction-service";

export const dynamic = "force-dynamic";

export default async function CrmPage() {
  const transactions = await transactionService.list();
  const dataset = buildCrmDataset(transactions);

  return <CrmConsole dataset={dataset} />;
}
