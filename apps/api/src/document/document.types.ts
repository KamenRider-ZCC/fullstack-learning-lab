import type { Readable } from 'node:stream';

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
  stream: Readable;
  originalName: string;
  mimeType: string;
  size: number;
}

export interface DocumentPreviewUrl {
  url: string;
  expiresAt: string;
  expiresInSeconds: number;
}
