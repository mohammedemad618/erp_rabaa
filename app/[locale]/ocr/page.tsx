import { OcrConsole } from "@/modules/ocr/components/ocr-console";
import { buildOcrDataset } from "@/modules/ocr/services/ocr-dataset";
import { transactionService } from "@/services/transaction-service";

export const dynamic = "force-dynamic";

export default async function OcrPage() {
  const transactions = await transactionService.list();
  const dataset = buildOcrDataset(transactions);

  return <OcrConsole dataset={dataset} />;
}
