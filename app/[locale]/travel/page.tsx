import { redirect } from "next/navigation";
import { requirePermission } from "@/services/auth/server-guards";

interface TravelPageProps {
  params: Promise<{ locale: string }>;
}

export default async function TravelPage({ params }: TravelPageProps) {
  const { locale } = await params;
  await requirePermission(locale, "travel.view", `/${locale}/travel`);
  redirect(`/${locale}/operations?type=travel`);
}
