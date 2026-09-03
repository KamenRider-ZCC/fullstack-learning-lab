import type { Readable } from 'node:stream';

export const FILE_STORAGE = Symbol('FILE_STORAGE');

export interface FileStoragePort {
  savePdf(content: Buffer): Promise<string>;
  getObject(storageKey: string): Promise<Readable>;
  remove(storageKey: string): Promise<void>;
}
