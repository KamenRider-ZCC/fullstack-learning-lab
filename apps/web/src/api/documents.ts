import { requestBlob, requestJson } from './http';

export interface DocumentSummary {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
  uploadedBy: {
    id: string;
    displayName: string;
  };
}

export function fetchDocuments() {
  return requestJson<DocumentSummary[]>('/api/documents');
}

export function uploadDocument(file: File) {
  const form = new FormData();
  form.append('file', file);
  return requestJson<DocumentSummary>('/api/documents', {
    method: 'POST',
    body: form,
  });
}

export function fetchDocumentContent(documentId: string) {
  return requestBlob(`/api/documents/${documentId}/content`);
}
