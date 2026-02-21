import { ErpPageLayout } from "@/components/layout/erp-page-layout";
import { BspConsole } from "@/modules/bsp/components/bsp-console";
import { buildBspDataset } from "@/modules/bsp/services/bsp-dataset";
import { requirePermission } from "@/services/auth/server-guards";
import { transactionService } from "@/services/transaction-service";

export const dynamic = "force-dynamic";

interface BspPageProps {
  params: Promise<{ locale: string }>;
}

export default async function BspPage({ params }: BspPageProps) {
  const { locale } = await params;
  await requirePermission(locale, "bsp.view", `/${locale}/bsp`);
  const transactions = await transactionService.list();
  const dataset = buildBspDataset(transactions);

  return (
    <ErpPageLayout>
      <div className="col-span-12">
        <BspConsole dataset={dataset} />
      </div>
    </ErpPageLayout>
  );
}
