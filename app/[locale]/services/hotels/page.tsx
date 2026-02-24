import { requirePermission } from "@/services/auth/server-guards";
import { listBookings } from "@/modules/services/services-store";
import { ServiceListPage } from "@/modules/services/components/service-list-page";

export const dynamic = "force-dynamic";

interface PageProps { params: Promise<{ locale: string }> }

export default async function HotelsPage({ params }: PageProps) {
  const { locale } = await params;
  await requirePermission(locale, "dashboard.view", `/${locale}`);
  const bookings = listBookings("hotel");
  return <ServiceListPage category="hotel" bookings={bookings} />;
}
