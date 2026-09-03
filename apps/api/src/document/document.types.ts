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

export interface DocumentContent {
  filePath: string;
  originalName: string;
  mimeType: string;
  size: number;
}
