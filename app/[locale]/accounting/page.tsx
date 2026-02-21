import { ErpPageLayout } from "@/components/layout/erp-page-layout";
import { AccountingConsole } from "@/modules/accounting/components/accounting-console";
import { buildAccountingDataset } from "@/modules/accounting/services/accounting-dataset";
import { requirePermission } from "@/services/auth/server-guards";
import { transactionService } from "@/services/transaction-service";

export const dynamic = "force-dynamic";

interface AccountingPageProps {
  params: Promise<{ locale: string }>;
}

export default async function AccountingPage({ params }: AccountingPageProps) {
  const { locale } = await params;
  await requirePermission(locale, "accounting.view", `/${locale}/accounting`);
  const transactions = await transactionService.list();
  const dataset = buildAccountingDataset(transactions);

  return (
    <ErpPageLayout>
      <div className="col-span-12">
        <AccountingConsole dataset={dataset} />
      </div>
    </ErpPageLayout>
  );
}
