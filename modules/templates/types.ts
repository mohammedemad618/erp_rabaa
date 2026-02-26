export type TemplateVersionState = "draft" | "active";

export type PreviewMode = "a4" | "mobile";

export type TemplateScope = "travel" | "operations" | "finance" | "shared";

export type TemplateOutputKind = "print" | "pdf" | "email";

export type TemplateVersionStatus = "draft" | "active" | "retired";

export type TemplateAuditAction =
  | "create_template"
  | "update_template"
  | "create_version"
  | "activate_version";

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

export interface TemplateDesignTokens {
  primaryColor: string;
  accentColor: string;
  paperTint: string;
  cornerRadius: number;
  logoUrl?: string | null;
}

export interface TemplateContentModel {
  headerText: string;
  footerText: string;
}

export interface TemplateLayoutModel {
  previewMode: PreviewMode;
}

export interface TemplateVersionPayload {
  tokens: TemplateDesignTokens;
  content: TemplateContentModel;
  layout: TemplateLayoutModel;
}

export interface TemplateDefinitionRecord {
  templateId: string;
  slug: string;
  scope: TemplateScope;
  name: string;
  description?: string;
  outputKind: TemplateOutputKind;
  tags: string[];
  activeVersionId?: string;
  archivedAt?: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export interface TemplateVersionRecord {
  versionId: string;
  templateId: string;
  status: TemplateVersionStatus;
  schemaVersion: number;
  title: string;
  payload: TemplateVersionPayload;
  createdAt: string;
  createdBy: string;
  activatedAt?: string;
  activatedBy?: string;
  note?: string;
}

export interface TemplateAuditEvent {
  id: string;
  templateId: string;
  versionId?: string;
  actorName: string;
  action: TemplateAuditAction;
  at: string;
  note?: string;
  metadata?: Record<string, unknown>;
}
