export type CustomerSegment = "starter" | "growth" | "strategic";

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  segment: CustomerSegment;
  createdAt: string;
}
