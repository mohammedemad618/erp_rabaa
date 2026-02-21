import { ErpPageLayout } from "@/components/layout/erp-page-layout";
import { TravelRequestsConsole } from "@/modules/travel/components/travel-requests-console";
import { requirePermission } from "@/services/auth/server-guards";
import { travelRequestService } from "@/services/travel-request-service";

export const dynamic = "force-dynamic";

interface TravelRequestsPageProps {
  params: Promise<{ locale: string }>;
}

export default async function TravelRequestsPage({ params }: TravelRequestsPageProps) {
  const { locale } = await params;
  await requirePermission(locale, "travel.view", `/${locale}/travel`);
  const requests = await travelRequestService.list();
  return (
    <ErpPageLayout>
      <div className="col-span-12">
        <TravelRequestsConsole initialRequests={requests} />
      </div>
    </ErpPageLayout>
  );
}
