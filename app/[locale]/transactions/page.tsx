import { ErpPageLayout } from "@/components/layout/erp-page-layout";
import { TransactionWorkbench } from "@/modules/transactions/components/transaction-workbench";
import { requirePermission } from "@/services/auth/server-guards";
import { transactionService } from "@/services/transaction-service";

export const dynamic = "force-dynamic";

interface TransactionsPageProps {
  params: Promise<{ locale: string }>;
}

export default async function TransactionsPage({ params }: TransactionsPageProps) {
  const { locale } = await params;
  await requirePermission(locale, "transactions.view", `/${locale}/transactions`);
  const transactions = await transactionService.list();
  return (
    <ErpPageLayout>
      <div className="col-span-12">
        <TransactionWorkbench initialTransactions={transactions} />
      </div>
    </ErpPageLayout>
  );
}
