import type { ReactNode } from "react";
import { cn } from "@/utils/cn";

interface ErpPageLayoutProps {
  children: ReactNode;
  className?: string;
}

interface ErpPageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  meta?: ReactNode;
  className?: string;
}

interface ErpSectionProps {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

interface ErpKpiGridProps {
  children: ReactNode;
  className?: string;
}

interface ErpMainSplitProps {
  primary: ReactNode;
  secondary: ReactNode;
  className?: string;
  asideFirst?: boolean;
}

export function ErpPageLayout({ children, className }: ErpPageLayoutProps) {
  return <section className={cn("grid grid-cols-12 gap-4 lg:gap-6", className)}>{children}</section>;
}

export function ErpPageHeader({
  title,
  description,
  actions,
  meta,
  className,
}: ErpPageHeaderProps) {
  return (
    <header className={cn("surface-card col-span-12 p-6 lg:p-8 bg-gradient-to-br from-white to-slate-50/50 mb-2 relative overflow-hidden", className)}>
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-50" />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-finance tracking-tight">{title}</h1>
          {description ? (
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground/90">{description}</p>
          ) : null}
          {meta ? <div className="mt-4 text-xs font-medium text-muted-foreground">{meta}</div> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-3">{actions}</div> : null}
      </div>
    </header>
  );
}

export function ErpSection({
  title,
  description,
  actions,
  children,
  className,
}: ErpSectionProps) {
  return (
    <section className={cn("surface-card p-5 lg:p-6 transition-all", className)}>
      {title || description || actions ? (
        <div className="mb-5 flex items-start justify-between gap-4 border-b border-border/40 pb-4">
          <div>
            {title ? <h2 className="text-base font-bold text-finance tracking-tight">{title}</h2> : null}
            {description ? <p className="mt-1 text-xs text-muted-foreground/80">{description}</p> : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className="mt-2">
        {children}
      </div>
    </section>
  );
}

export function ErpKpiGrid({ children, className }: ErpKpiGridProps) {
  return <div className={cn("col-span-12 grid gap-5 sm:grid-cols-2 xl:grid-cols-4", className)}>{children}</div>;
}

export function ErpMainSplit({
  primary,
  secondary,
  className,
  asideFirst = false,
}: ErpMainSplitProps) {
  const primaryPane = <div className="space-y-4">{primary}</div>;
  const secondaryPane = <aside className="space-y-4">{secondary}</aside>;

  return (
    <div className={cn("col-span-12 grid items-start gap-4 xl:grid-cols-[2fr_1fr]", className)}>
      {asideFirst ? (
        <>
          {secondaryPane}
          {primaryPane}
        </>
      ) : (
        <>
          {primaryPane}
          {secondaryPane}
        </>
      )}
    </div>
  );
}
