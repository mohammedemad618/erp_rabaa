import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";

export default async function ForbiddenPage() {
  const tForbidden = await getTranslations("forbidden");

  return (
    <section className="surface-card p-6">
      <h2 className="text-2xl font-bold text-finance">{tForbidden("title")}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{tForbidden("description")}</p>
      <Link
        href="/"
        className="mt-4 inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-white transition hover:opacity-95"
      >
        {tForbidden("backToDashboard")}
      </Link>
    </section>
  );
}
