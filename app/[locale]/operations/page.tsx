import { ErpPageLayout } from "@/components/layout/erp-page-layout";
import { OperationsHub } from "@/modules/operations/components/operations-hub";
import { listBookings } from "@/modules/services/services-store";
import { requirePermission } from "@/services/auth/server-guards";
import { transactionService } from "@/services/transaction-service";
import { travelRequestService } from "@/services/travel-request-service";

export const dynamic = "force-dynamic";

interface OperationsPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ type?: string | string[] }>;
}

export default async function OperationsPage({ params, searchParams }: OperationsPageProps) {
  const { locale } = await params;
  const resolvedSearchParams = await searchParams;
  const typeParam = Array.isArray(resolvedSearchParams.type)
    ? resolvedSearchParams.type[0]
    : resolvedSearchParams.type;

  await requirePermission(locale, "dashboard.view", `/${locale}/operations`);

  if (typeParam === "travel") {
    await requirePermission(locale, "travel.view", `/${locale}/operations?type=travel`);
  }
  if (typeParam === "transactions") {
    await requirePermission(
      locale,
      "transactions.view",
      `/${locale}/operations?type=transactions`,
    );
  }

  const [transactions, requests, serviceBookings] = await Promise.all([
    transactionService.list(),
    travelRequestService.list(),
    Promise.resolve(listBookings()),
  ]);
  return (
    <ErpPageLayout>
      <div className="col-span-12">
        <OperationsHub
          initialTransactions={transactions}
          initialRequests={requests}
          allServiceBookings={serviceBookings}
        />
      </div>
    </ErpPageLayout>
  );
}
