import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function RootPage() {
  const cookieStore = await cookies();
  const preferredLocale = cookieStore.get("NEXT_LOCALE")?.value;
  const locale = preferredLocale === "ar" || preferredLocale === "en" ? preferredLocale : "en";

  redirect(`/${locale}`);
}
