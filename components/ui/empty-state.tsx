import { Search, Inbox, FileX } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type EmptyStateVariant = "no-results" | "no-data" | "error";

interface EmptyStateProps {
  variant?: EmptyStateVariant;
  title?: string;
  description?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
}

const DEFAULTS: Record<EmptyStateVariant, { icon: LucideIcon; titleEn: string; descEn: string }> = {
  "no-results": {
    icon: Search,
    titleEn: "No results found",
    descEn: "Try adjusting your search or filter criteria.",
  },
  "no-data": {
    icon: Inbox,
    titleEn: "No data yet",
    descEn: "Data will appear here once records are created.",
  },
  error: {
    icon: FileX,
    titleEn: "Something went wrong",
    descEn: "Please try again or contact support.",
  },
};

export function EmptyState({
  variant = "no-results",
  title,
  description,
  icon,
  action,
}: EmptyStateProps) {
  const defaults = DEFAULTS[variant];
  const Icon = icon ?? defaults.icon;

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
        <Icon className="h-6 w-6 text-slate-400" />
      </div>
      <h3 className="text-sm font-semibold text-finance">{title ?? defaults.titleEn}</h3>
      <p className="mt-1 max-w-xs text-xs text-muted-foreground">{description ?? defaults.descEn}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
