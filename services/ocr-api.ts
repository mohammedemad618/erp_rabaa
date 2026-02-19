import type { OcrDocument } from "@/modules/ocr/types";

interface ExtractOcrDocumentInput {
  file: File;
  branch?: string;
  transactionId?: string;
}

interface ExtractOcrDocumentResponse {
  document: OcrDocument;
}

interface ApiErrorPayload {
  message?: string;
}

export async function extractOcrDocument(
  input: ExtractOcrDocumentInput,
): Promise<OcrDocument> {
  const formData = new FormData();
  formData.append("file", input.file);
  if (input.branch) {
    formData.append("branch", input.branch);
  }
  if (input.transactionId) {
    formData.append("transactionId", input.transactionId);
  }

  const response = await fetch("/api/ocr/extract", {
    method: "POST",
    body: formData,
  });

  const payload = (await response.json()) as
    | ExtractOcrDocumentResponse
    | ApiErrorPayload;

  if (!response.ok) {
    const fallback = "OCR extraction failed.";
    throw new Error((payload as ApiErrorPayload).message ?? fallback);
  }

  return (payload as ExtractOcrDocumentResponse).document;
}
