"use client";

import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";
import { cn } from "@/utils/cn";

const baseInputClass =
  "w-full rounded-lg border border-border bg-white px-3 text-sm text-foreground shadow-sm transition placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/70 disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-slate-50";

const sizeClasses = {
  sm: "h-8 text-xs",
  md: "h-10 text-sm",
  lg: "h-12 text-base px-4",
};

const variantClasses = {
  default: "border-border bg-white",
  error: "border-danger focus:border-danger focus:ring-danger/30",
};

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  size?: keyof typeof sizeClasses;
  variant?: keyof typeof variantClasses;
  /** Add padding for leading icon (uses ps-10 for RTL support) */
  hasLeadingIcon?: boolean;
  /** Add padding for trailing icon (uses pe-10 for RTL support) */
  hasTrailingIcon?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      size = "md",
      variant = "default",
      hasLeadingIcon = false,
      hasTrailingIcon = false,
      ...props
    },
    ref,
  ) => {
    return (
      <input
        ref={ref}
        className={cn(
          baseInputClass,
          sizeClasses[size],
          variantClasses[variant],
          hasLeadingIcon && "ps-10",
          hasTrailingIcon && "pe-10",
          className,
        )}
        {...props}
      />
    );
  },
);

Input.displayName = "Input";
