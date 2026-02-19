export type TemplateVersionState = "draft" | "active";

export type PreviewMode = "a4" | "mobile";

export interface PrintLineItem {
  id: string;
  label: string;
  description: string;
  amount: number;
}

export interface TemplateSnapshot {
  templateId: string;
  defaultName: string;
  defaultHeader: string;
  defaultFooter: string;
  generatedAt: string;
  transactionId: string;
  customerName: string;
  branch: string;
  currency: string;
  totalAmount: number;
  items: PrintLineItem[];
}

export interface TemplateDataset {
  snapshot: TemplateSnapshot;
}
