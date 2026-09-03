import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service.js';
import { PDF_MIME_TYPE } from './document.constants.js';
import { DocumentService } from './document.service.js';
import { FILE_STORAGE } from './file-storage.port.js';
import { TEMPORARY_FILE_URL } from './temporary-file-url.port.js';

const fixedNow = new Date('2026-09-03T08:00:00.000Z');
const uploader = { id: 'user-1', displayName: '演示评审专家' };
const documentRecord = {
  id: 'document-1',
  originalName: '投标文件.pdf',
  storageKey: 'documents/2026/document-1.pdf',
  mimeType: PDF_MIME_TYPE,
  size: 24,
  uploadedById: uploader.id,
  createdAt: new Date('2026-09-03T07:00:00.000Z'),
};

function createPrismaMock() {
  return {
    document: {
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
    },
  };
}

function createStorageMock() {
  return {
    savePdf: vi.fn(),
    getObject: vi.fn(),
    remove: vi.fn(),
  };
}

function createTemporaryUrlMock() {
  return { createTemporaryReadUrl: vi.fn() };
}

function createPdfFile(originalname = 'proposal.pdf') {
  const buffer = Buffer.from('%PDF-1.4 test content');
  return {
    buffer,
    originalname,
    mimetype: PDF_MIME_TYPE,
    size: buffer.length,
  } as Express.Multer.File;
}

describe('DocumentService', () => {
  let moduleRef: TestingModule;
  let service: DocumentService;
  let prisma: ReturnType<typeof createPrismaMock>;
  let storage: ReturnType<typeof createStorageMock>;
  let temporaryUrl: ReturnType<typeof createTemporaryUrlMock>;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);
    vi.stubEnv('PREVIEW_URL_TTL_SECONDS', '300');
    prisma = createPrismaMock();
    storage = createStorageMock();
    temporaryUrl = createTemporaryUrlMock();

    // TestingModule 代替真正 AppModule，只向被测 Service 注入可观察的假依赖。
    moduleRef = await Test.createTestingModule({
      providers: [
        DocumentService,
        { provide: PrismaService, useValue: prisma },
        { provide: FILE_STORAGE, useValue: storage },
        { provide: TEMPORARY_FILE_URL, useValue: temporaryUrl },
      ],
    }).compile();
    service = moduleRef.get(DocumentService);
  });

  afterEach(async () => {
    await moduleRef.close();
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('返回文件摘要，但不向前端泄露 storageKey', async () => {
    prisma.document.findMany.mockResolvedValue([
      { ...documentRecord, uploadedBy: uploader },
    ]);

    const result = await service.list();

    expect(result).toEqual([{
      id: documentRecord.id,
      originalName: documentRecord.originalName,
      mimeType: documentRecord.mimeType,
      size: documentRecord.size,
      createdAt: documentRecord.createdAt.toISOString(),
      uploadedBy: uploader,
    }]);
    expect(result[0]).not.toHaveProperty('storageKey');
  });

  it('没有文件时在调用存储服务之前拒绝上传', async () => {
    await expect(service.upload(undefined, uploader.id))
      .rejects.toBeInstanceOf(BadRequestException);

    expect(storage.savePdf).not.toHaveBeenCalled();
    expect(prisma.document.create).not.toHaveBeenCalled();
  });

  it('只看 MIME 类型不够，伪 PDF 文件会被拒绝', async () => {
    const fakePdf = {
      ...createPdfFile(),
      buffer: Buffer.from('this is not a pdf'),
    };

    await expect(service.upload(fakePdf, uploader.id))
      .rejects.toMatchObject({
        response: { code: 'UNSUPPORTED_FILE_TYPE' },
      });
    expect(storage.savePdf).not.toHaveBeenCalled();
  });

  it('先保存 PDF，再用返回的对象键创建数据库元数据', async () => {
    const mojibakeName = Buffer.from('投标文件.pdf', 'utf8').toString('latin1');
    const file = createPdfFile(mojibakeName);
    storage.savePdf.mockResolvedValue(documentRecord.storageKey);
    prisma.document.create.mockResolvedValue({
      ...documentRecord,
      size: file.size,
      uploadedBy: uploader,
    });

    const result = await service.upload(file, uploader.id);

    expect(storage.savePdf).toHaveBeenCalledWith(file.buffer);
    expect(prisma.document.create).toHaveBeenCalledWith({
      data: {
        originalName: '投标文件.pdf',
        storageKey: documentRecord.storageKey,
        mimeType: PDF_MIME_TYPE,
        size: file.size,
        uploadedById: uploader.id,
      },
      include: { uploadedBy: { select: { id: true, displayName: true } } },
    });
    expect(result.originalName).toBe('投标文件.pdf');
  });

  it('数据库写入失败时删除刚保存的对象，避免孤儿文件', async () => {
    const databaseError = new Error('database unavailable');
    storage.savePdf.mockResolvedValue(documentRecord.storageKey);
    prisma.document.create.mockRejectedValue(databaseError);

    await expect(service.upload(createPdfFile(), uploader.id))
      .rejects.toBe(databaseError);
    expect(storage.remove).toHaveBeenCalledWith(documentRecord.storageKey);
  });

  it('为存在的文件生成 5 分钟临时预览地址', async () => {
    prisma.document.findUnique.mockResolvedValue(documentRecord);
    temporaryUrl.createTemporaryReadUrl.mockResolvedValue(
      'http://127.0.0.1:9000/signed-pdf-url',
    );

    const result = await service.createPreviewUrl(documentRecord.id);

    expect(temporaryUrl.createTemporaryReadUrl).toHaveBeenCalledWith(
      documentRecord.storageKey,
      {
        expiresInSeconds: 300,
        originalName: documentRecord.originalName,
        mimeType: PDF_MIME_TYPE,
      },
    );
    expect(result).toEqual({
      url: 'http://127.0.0.1:9000/signed-pdf-url',
      expiresInSeconds: 300,
      expiresAt: '2026-09-03T08:05:00.000Z',
    });
  });

  it('文件不存在时不调用 MinIO 签名能力', async () => {
    prisma.document.findUnique.mockResolvedValue(null);

    await expect(service.createPreviewUrl('missing-document'))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(temporaryUrl.createTemporaryReadUrl).not.toHaveBeenCalled();
  });
});
