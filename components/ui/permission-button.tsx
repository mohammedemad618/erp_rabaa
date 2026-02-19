"use client";

import * as Tooltip from "@radix-ui/react-tooltip";
import type { ButtonHTMLAttributes } from "react";
import { evaluatePermission } from "@/services/permission-service";
import type { Transaction } from "@/modules/transactions/types";
import type { ProtectedAction } from "@/types/permissions";
import { Button } from "./button";

interface PermissionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  action: ProtectedAction;
  transaction: Transaction;
  label: string;
  requiresPinLabel: string;
}

export function PermissionButton({
  action,
  transaction,
  label,
  requiresPinLabel,
  ...props
}: PermissionButtonProps) {
  const evaluation = evaluatePermission(action, {
    status: transaction.status,
    approvalState: transaction.approvalState,
  });

  const helperText = evaluation.allowed
    ? evaluation.requiresPin
      ? requiresPinLabel
      : undefined
    : evaluation.reason;

  return (
    <Tooltip.Provider delayDuration={150}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <span>
            <Button
              {...props}
              disabled={!evaluation.allowed || props.disabled}
              variant={action === "void" || action === "delete" ? "danger" : "secondary"}
              size="sm"
            >
              {label}
            </Button>
          </span>
        </Tooltip.Trigger>
        {helperText ? (
          <Tooltip.Portal>
            <Tooltip.Content
              sideOffset={6}
              className="rounded-md bg-finance px-2 py-1 text-xs text-white shadow-xl"
            >
              {helperText}
              <Tooltip.Arrow className="fill-finance" />
            </Tooltip.Content>
          </Tooltip.Portal>
        ) : null}
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
