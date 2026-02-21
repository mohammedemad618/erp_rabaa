import { ErpPageLayout } from "@/components/layout/erp-page-layout";
import { ExpensesConsole } from "@/modules/expenses/components/expenses-console";
import { buildExpenseDataset } from "@/modules/expenses/services/expense-dataset";
import { requirePermission } from "@/services/auth/server-guards";
import { transactionService } from "@/services/transaction-service";

export const dynamic = "force-dynamic";

interface ExpensesPageProps {
  params: Promise<{ locale: string }>;
}

export default async function ExpensesPage({ params }: ExpensesPageProps) {
  const { locale } = await params;
  await requirePermission(locale, "expenses.view", `/${locale}/expenses`);
  const transactions = await transactionService.list();
  const dataset = buildExpenseDataset(transactions);

  return (
    <ErpPageLayout>
      <div className="col-span-12">
        <ExpensesConsole dataset={dataset} />
      </div>
    </ErpPageLayout>
  );
}
