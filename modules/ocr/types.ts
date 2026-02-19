export interface OcrBoundingBox {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type OcrFieldType =
  | "text"
  | "number"
  | "date"
  | "currency"
  | "phone";

export interface OcrField {
  id: string;
  key: string;
  label: string;
  value: string;
  confidence: number;
  type: OcrFieldType;
  bbox: OcrBoundingBox;
  accepted: boolean;
}

export interface OcrDocument {
  id: string;
  sourceName: string;
  transactionId: string;
  createdAt: string;
  branch: string;
  averageConfidence: number;
  fields: OcrField[];
}

export interface OcrDataset {
  documents: OcrDocument[];
}
