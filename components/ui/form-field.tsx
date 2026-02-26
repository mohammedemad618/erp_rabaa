"use client";

import React from "react";
import { cn } from "@/utils/cn";

const labelClass = "block text-xs font-medium text-muted-foreground";
const errorClass = "mt-1 text-[11px] text-danger";

export interface FormFieldProps {
  id?: string;
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  /** Use for grid layouts: full width by default */
  fullWidth?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function FormField({
  id: idProp,
  label,
  error,
  hint,
  required,
  fullWidth = true,
  children,
  className,
}: FormFieldProps) {
  const id = idProp ?? `field-${label.replace(/\s/g, "-").toLowerCase()}`;
  return (
    <div className={cn(fullWidth && "w-full", className)}>
      <label htmlFor={id} className={labelClass}>
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>
      <div className="mt-1">
        {React.isValidElement(children)
          ? React.cloneElement(children, {
              id,
              "aria-invalid": !!error,
              "aria-describedby": error ? `${id}-error` : hint ? `${id}-hint` : undefined,
            } as React.HTMLAttributes<HTMLElement>)
          : children}
      </div>
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1 text-[11px] text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className={errorClass} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
