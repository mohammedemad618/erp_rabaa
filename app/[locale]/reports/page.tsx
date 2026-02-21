import { ErpPageLayout } from "@/components/layout/erp-page-layout";
import { ReportsConsole } from "@/modules/reports/components/reports-console";
import { buildReportingDataset } from "@/modules/reports/services/reporting-dataset";
import { requirePermission } from "@/services/auth/server-guards";
import { transactionService } from "@/services/transaction-service";

export const dynamic = "force-dynamic";

interface ReportsPageProps {
  params: Promise<{ locale: string }>;
}

export default async function ReportsPage({ params }: ReportsPageProps) {
  const { locale } = await params;
  await requirePermission(locale, "reports.view", `/${locale}/reports`);
  const transactions = await transactionService.list();
  const dataset = buildReportingDataset(transactions);

  return (
    <ErpPageLayout>
      <div className="col-span-12">
        <ReportsConsole dataset={dataset} />
      </div>
    </ErpPageLayout>
  );
}
