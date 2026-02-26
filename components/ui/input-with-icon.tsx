"use client";

import { forwardRef } from "react";
import { cn } from "@/utils/cn";
import { Input } from "./input";
import type { InputProps } from "./input";

export interface InputWithIconProps extends InputProps {
  icon: React.ReactNode;
  /** Icon position: start (LTR left, RTL right) or end */
  iconPosition?: "start" | "end";
}

export const InputWithIcon = forwardRef<HTMLInputElement, InputWithIconProps>(
  ({ icon, iconPosition = "start", className, ...props }, ref) => {
    const isStart = iconPosition === "start";
    return (
      <div className="relative w-full">
        <div
          className={cn(
            "pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground",
            isStart ? "start-3" : "end-3",
          )}
        >
          {icon}
        </div>
        <Input
          ref={ref}
          hasLeadingIcon={isStart}
          hasTrailingIcon={!isStart}
          className={className}
          {...props}
        />
      </div>
    );
  },
);

InputWithIcon.displayName = "InputWithIcon";
