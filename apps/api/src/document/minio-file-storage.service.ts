import { Injectable, OnModuleInit } from '@nestjs/common';
import { Client } from 'minio';
import { randomUUID } from 'node:crypto';
import { PDF_MIME_TYPE } from './document.constants.js';
import type { FileStoragePort } from './file-storage.port.js';
import { readMinioConfig } from './minio.config.js';

@Injectable()
export class MinioFileStorageService implements OnModuleInit, FileStoragePort {
  private readonly config = readMinioConfig();
  private readonly client = new Client({
    endPoint: this.config.endPoint,
    port: this.config.port,
    useSSL: this.config.useSSL,
    accessKey: this.config.accessKey,
    secretKey: this.config.secretKey,
  });

  async onModuleInit() {
    await this.ensureBucket();
  }

  async savePdf(content: Buffer) {
    const year = new Date().getUTCFullYear();
    const storageKey = `documents/${year}/${randomUUID()}.pdf`;
    await this.client.putObject(
      this.config.bucket,
      storageKey,
      content,
      content.length,
      { 'Content-Type': PDF_MIME_TYPE },
    );
    return storageKey;
  }

  async getObject(storageKey: string) {
    return this.client.getObject(this.config.bucket, storageKey);
  }

  async remove(storageKey: string) {
    await this.client.removeObject(this.config.bucket, storageKey);
  }

  private async ensureBucket() {
    if (await this.client.bucketExists(this.config.bucket)) return;
    try {
      await this.client.makeBucket(this.config.bucket, 'us-east-1');
    } catch (error) {
      // 多个后端实例可能同时创建存储桶；再次确认存在即可视为成功。
      if (!(await this.client.bucketExists(this.config.bucket))) throw error;
    }
  }
}
