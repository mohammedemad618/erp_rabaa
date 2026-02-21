import { ErpPageLayout } from "@/components/layout/erp-page-layout";
import { TreasuryConsole } from "@/modules/treasury/components/treasury-console";
import { buildTreasuryDataset } from "@/modules/treasury/services/treasury-dataset";
import { requirePermission } from "@/services/auth/server-guards";
import { transactionService } from "@/services/transaction-service";

export const dynamic = "force-dynamic";

interface TreasuryPageProps {
  params: Promise<{ locale: string }>;
}

export default async function TreasuryPage({ params }: TreasuryPageProps) {
  const { locale } = await params;
  await requirePermission(locale, "treasury.view", `/${locale}/treasury`);
  const transactions = await transactionService.list();
  const dataset = buildTreasuryDataset(transactions);

  return (
    <ErpPageLayout>
      <div className="col-span-12">
        <TreasuryConsole dataset={dataset} />
      </div>
    </ErpPageLayout>
  );
}
