"use client";

import { forwardRef } from "react";
import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/utils/cn";

const baseTextareaClass =
  "w-full min-h-[80px] rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground shadow-sm transition placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/70 disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-slate-50 resize-y";

const variantClasses = {
  default: "border-border bg-white",
  error: "border-danger focus:border-danger focus:ring-danger/30",
};

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  variant?: keyof typeof variantClasses;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, variant = "default", ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(baseTextareaClass, variantClasses[variant], className)}
        aria-invalid={variant === "error"}
        {...props}
      />
    );
  },
);

Textarea.displayName = "Textarea";
