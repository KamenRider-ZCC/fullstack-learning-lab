import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Client } from 'minio';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { readMinioConfig } from '../document/minio.config.js';
import { normalizeMultipartFilename } from '../document/document-filename.js';

const prisma = new PrismaClient();
const config = readMinioConfig();
const minio = new Client({
  endPoint: config.endPoint,
  port: config.port,
  useSSL: config.useSSL,
  accessKey: config.accessKey,
  secretKey: config.secretKey,
});
const localDirectory = resolve(process.env.UPLOAD_DIR || 'storage/uploads');

async function main() {
  if (!(await minio.bucketExists(config.bucket))) {
    await minio.makeBucket(config.bucket, 'us-east-1');
  }

  const documents = await prisma.document.findMany({
    select: { id: true, originalName: true, storageKey: true, mimeType: true, size: true },
  });
  let copied = 0;
  let skipped = 0;

  for (const document of documents) {
    const normalizedName = normalizeMultipartFilename(document.originalName);
    if (normalizedName !== document.originalName) {
      await prisma.document.update({
        where: { id: document.id },
        data: { originalName: normalizedName },
      });
      console.log(`已修复文件名：${normalizedName}`);
    }

    const existingSize = await readObjectSize(document.storageKey);
    if (existingSize === document.size) {
      skipped += 1;
      continue;
    }
    if (existingSize !== null) {
      throw new Error(`MinIO 对象大小冲突：${document.storageKey}`);
    }

    const filePath = resolveLocalPath(document.storageKey);
    const content = await readFile(filePath);
    if (content.length !== document.size) {
      throw new Error(`本地文件大小与数据库不一致：${normalizedName}`);
    }

    await minio.putObject(
      config.bucket,
      document.storageKey,
      content,
      content.length,
      { 'Content-Type': document.mimeType },
    );
    copied += 1;
    console.log(`已复制：${normalizedName}`);
  }

  console.log(`迁移完成：复制 ${copied} 个，跳过 ${skipped} 个。`);
  console.log('本地文件未删除，可在确认 MinIO 预览正常后自行保留或清理。');
}

async function readObjectSize(storageKey: string) {
  try {
    return (await minio.statObject(config.bucket, storageKey)).size;
  } catch (error) {
    if (isNotFoundError(error)) return null;
    throw error;
  }
}

function resolveLocalPath(storageKey: string) {
  const filePath = resolve(localDirectory, storageKey);
  if (dirname(filePath) !== localDirectory) {
    throw new Error(`本地 storageKey 不是单层文件名：${storageKey}`);
  }
  return filePath;
}

function isNotFoundError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const code = 'code' in error ? String(error.code) : '';
  return code === 'NotFound' || code === 'NoSuchKey' || code === 'NoSuchObject';
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
