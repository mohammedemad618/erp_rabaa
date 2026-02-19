import { TemplatesConsole } from "@/modules/templates/components/templates-console";
import { buildTemplateDataset } from "@/modules/templates/services/template-dataset";
import { transactionService } from "@/services/transaction-service";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const transactions = await transactionService.list();
  const dataset = buildTemplateDataset(transactions);

  return <TemplatesConsole dataset={dataset} />;
}
