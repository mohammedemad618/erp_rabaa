import { ErpPageLayout } from "@/components/layout/erp-page-layout";
import { OcrConsole } from "@/modules/ocr/components/ocr-console";
import { buildOcrDataset } from "@/modules/ocr/services/ocr-dataset";
import { requirePermission } from "@/services/auth/server-guards";
import { transactionService } from "@/services/transaction-service";

export const dynamic = "force-dynamic";

interface OcrPageProps {
  params: Promise<{ locale: string }>;
}

export default async function OcrPage({ params }: OcrPageProps) {
  const { locale } = await params;
  await requirePermission(locale, "ocr.view", `/${locale}/ocr`);
  const transactions = await transactionService.list();
  const dataset = buildOcrDataset(transactions);

  return (
    <ErpPageLayout>
      <div className="col-span-12">
        <OcrConsole dataset={dataset} />
      </div>
    </ErpPageLayout>
  );
}
