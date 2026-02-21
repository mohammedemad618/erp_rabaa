import { ErpPageLayout } from "@/components/layout/erp-page-layout";
import { TemplatesConsole } from "@/modules/templates/components/templates-console";
import { buildTemplateDataset } from "@/modules/templates/services/template-dataset";
import { requirePermission } from "@/services/auth/server-guards";
import { transactionService } from "@/services/transaction-service";

export const dynamic = "force-dynamic";

interface TemplatesPageProps {
  params: Promise<{ locale: string }>;
}

export default async function TemplatesPage({ params }: TemplatesPageProps) {
  const { locale } = await params;
  await requirePermission(locale, "templates.view", `/${locale}/templates`);
  const transactions = await transactionService.list();
  const dataset = buildTemplateDataset(transactions);

  return (
    <ErpPageLayout>
      <div className="col-span-12">
        <TemplatesConsole dataset={dataset} />
      </div>
    </ErpPageLayout>
  );
}
