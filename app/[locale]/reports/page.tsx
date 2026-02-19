import { ReportsConsole } from "@/modules/reports/components/reports-console";
import { buildReportingDataset } from "@/modules/reports/services/reporting-dataset";
import { transactionService } from "@/services/transaction-service";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const transactions = await transactionService.list();
  const dataset = buildReportingDataset(transactions);

  return <ReportsConsole dataset={dataset} />;
}
