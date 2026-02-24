import { requirePermission } from "@/services/auth/server-guards";
import { listBookings, getServiceStats } from "@/modules/services/services-store";
import { ServicesHub } from "@/modules/services/components/services-hub";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function ServicesPage({ params }: PageProps) {
  const { locale } = await params;
  await requirePermission(locale, "dashboard.view", `/${locale}`);
  const bookings = listBookings();
  const stats = getServiceStats();
  return <ServicesHub bookings={bookings} stats={stats} />;
}
