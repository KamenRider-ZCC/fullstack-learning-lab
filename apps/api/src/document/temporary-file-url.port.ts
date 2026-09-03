export const TEMPORARY_FILE_URL = Symbol('TEMPORARY_FILE_URL');

export interface TemporaryReadUrlOptions {
  expiresInSeconds: number;
  originalName: string;
  mimeType: string;
}

export interface TemporaryFileUrlPort {
  createTemporaryReadUrl(
    storageKey: string,
    options: TemporaryReadUrlOptions,
  ): Promise<string>;
}
