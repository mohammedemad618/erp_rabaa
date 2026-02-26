import { ErpPageLayout } from "@/components/layout/erp-page-layout";
import { CrmConsole } from "@/modules/crm/components/crm-console";
import { buildCrmDataset } from "@/modules/crm/services/crm-dataset";
import { listCustomers } from "@/modules/customers/customer-store";
import { requirePermission } from "@/services/auth/server-guards";
import { transactionService } from "@/services/transaction-service";
import { listBookings } from "@/modules/services/services-store";
import { travelRequestService } from "@/services/travel-request-service";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

interface CrmPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ mode?: string | string[] }>;
}

export default async function CrmPage({ params, searchParams }: CrmPageProps) {
  const { locale } = await params;
  const resolvedSearchParams = await searchParams;
  const modeParam = Array.isArray(resolvedSearchParams.mode)
    ? resolvedSearchParams.mode[0]
    : resolvedSearchParams.mode;

  if (modeParam === "create") {
    redirect(`/${locale}/crm/create`);
  }

  await requirePermission(locale, "crm.view", `/${locale}/crm`);
  const [transactions, serviceBookings, travelRequests, customers] = await Promise.all([
    transactionService.list(),
    Promise.resolve(listBookings()),
    travelRequestService.list(),
    listCustomers(),
  ]);
  const dataset = buildCrmDataset(transactions, serviceBookings, travelRequests, customers);

  return (
    <ErpPageLayout>
      <div className="col-span-12">
        <CrmConsole dataset={dataset} />
      </div>
    </ErpPageLayout>
  );
}
