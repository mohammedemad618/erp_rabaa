import { getTranslations } from "next-intl/server";
import { ErpPageLayout, ErpPageHeader } from "@/components/layout/erp-page-layout";
import { TravelCreateFormWrapper } from "@/modules/travel/components/travel-create-form-wrapper";
import { listCustomers } from "@/modules/customers/customer-store";
import { listBookings } from "@/modules/services/services-store";
import { requirePermission } from "@/services/auth/server-guards";

export const dynamic = "force-dynamic";

interface TravelCreatePageProps {
  params: Promise<{ locale: string }>;
}

export default async function TravelCreatePage({ params }: TravelCreatePageProps) {
  const { locale } = await params;
  await requirePermission(locale, "travel.create", `/${locale}/travel/create`);
  const t = await getTranslations("operations");
  const [customers, serviceBookings] = await Promise.all([
    listCustomers(),
    Promise.resolve(listBookings()),
  ]);
  return (
    <ErpPageLayout>
      <ErpPageHeader
        title={t("createTravel")}
        description={t("createPageDescription")}
      />
      <div className="col-span-12">
        <TravelCreateFormWrapper
          customers={customers}
          allServiceBookings={serviceBookings}
        />
      </div>
    </ErpPageLayout>
  );
}
