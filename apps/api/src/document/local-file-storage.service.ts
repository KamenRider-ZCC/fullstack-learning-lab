import { Injectable, OnModuleInit } from '@nestjs/common';
import { access, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

@Injectable()
export class LocalFileStorageService implements OnModuleInit {
  private readonly uploadDirectory = resolve(
    process.env.UPLOAD_DIR || 'storage/uploads',
  );

  async onModuleInit() {
    await mkdir(this.uploadDirectory, { recursive: true });
  }

  async savePdf(content: Buffer) {
    const storageKey = `${randomUUID()}.pdf`;
    await writeFile(this.resolveStorageKey(storageKey), content, { flag: 'wx' });
    return storageKey;
  }

  async getFilePath(storageKey: string) {
    const filePath = this.resolveStorageKey(storageKey);
    await access(filePath);
    return filePath;
  }

  async remove(storageKey: string) {
    await rm(this.resolveStorageKey(storageKey), { force: true });
  }

  private resolveStorageKey(storageKey: string) {
    const filePath = resolve(this.uploadDirectory, storageKey);
    // 即使未来 storageKey 来自外部，也不能允许 ../ 逃离上传目录。
    if (dirname(filePath) !== this.uploadDirectory) {
      throw new Error('非法存储路径');
    }
    return filePath;
  }
}
