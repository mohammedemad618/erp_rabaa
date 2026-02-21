import type { TravelRequest } from "@/modules/travel/types";
import { listTravelRequests } from "@/services/travel-request-store";

export const travelRequestService = {
  async list(): Promise<TravelRequest[]> {
    return listTravelRequests();
  },
};
