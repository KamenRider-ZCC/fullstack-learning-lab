export const STORAGE_HEALTH = Symbol('STORAGE_HEALTH');

export interface StorageHealthPort {
  checkHealth(): Promise<void>;
}
