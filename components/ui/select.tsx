"use client";

import { forwardRef } from "react";
import type { SelectHTMLAttributes } from "react";
import { cn } from "@/utils/cn";

const baseSelectClass =
  "w-full rounded-lg border border-border bg-white px-3 pe-9 text-sm text-foreground shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/70 disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-slate-50 appearance-none bg-no-repeat bg-[position:right_0.5rem_center] bg-[length:1rem] [background-image:url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%20fill%3D%22none%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22M2%204l4%204%204-4%22%2F%3E%3C%2Fsvg%3E')]";

const sizeClasses = {
  sm: "h-8 text-xs",
  md: "h-10 text-sm",
  lg: "h-12 text-base px-4",
};

const variantClasses = {
  default: "border-border bg-white",
  error: "border-danger focus:border-danger focus:ring-danger/30",
};

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  size?: keyof typeof sizeClasses;
  variant?: keyof typeof variantClasses;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, size = "md", variant = "default", ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(baseSelectClass, sizeClasses[size], variantClasses[variant], className)}
        aria-invalid={variant === "error"}
        {...props}
      />
    );
  },
);

Select.displayName = "Select";
