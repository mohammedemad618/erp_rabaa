import { ErpPageLayout } from "@/components/layout/erp-page-layout";
import { CrmConsole } from "@/modules/crm/components/crm-console";
import { buildCrmDataset } from "@/modules/crm/services/crm-dataset";
import { requirePermission } from "@/services/auth/server-guards";
import { transactionService } from "@/services/transaction-service";

export const dynamic = "force-dynamic";

interface CrmPageProps {
  params: Promise<{ locale: string }>;
}

export default async function CrmPage({ params }: CrmPageProps) {
  const { locale } = await params;
  await requirePermission(locale, "crm.view", `/${locale}/crm`);
  const transactions = await transactionService.list();
  const dataset = buildCrmDataset(transactions);

  return (
    <ErpPageLayout>
      <div className="col-span-12">
        <CrmConsole dataset={dataset} />
      </div>
    </ErpPageLayout>
  );
}
