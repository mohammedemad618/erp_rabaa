"use client";

import { useRouter } from "@/i18n/navigation";
import { TravelCreateForm } from "./travel-create-form";
import type { AnyServiceBooking } from "@/modules/services/types";
import type { Customer } from "@/modules/customers/types";
import type { TravelRequest } from "../types";

interface TravelCreateFormWrapperProps {
  customers: Customer[];
  allServiceBookings: AnyServiceBooking[];
}

export function TravelCreateFormWrapper({
  customers,
  allServiceBookings,
}: TravelCreateFormWrapperProps) {
  const router = useRouter();

  function handleSuccess(request: TravelRequest) {
    router.push(`/operations?type=travel&created=${encodeURIComponent(request.id)}`);
  }

  function handleCancel() {
    router.push("/operations");
  }

  return (
    <TravelCreateForm
      customers={customers}
      allServiceBookings={allServiceBookings}
      onSuccess={handleSuccess}
      onCancel={handleCancel}
    />
  );
}
