import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { MAX_UPLOAD_BYTES, PDF_MIME_TYPE } from './document.constants.js';
import type { DocumentContent, DocumentSummary } from './document.types.js';
import { LocalFileStorageService } from './local-file-storage.service.js';

const documentInclude = {
  uploadedBy: { select: { id: true, displayName: true } },
} as const;

@Injectable()
export class DocumentService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LocalFileStorageService)
    private readonly storage: LocalFileStorageService,
  ) {}

  async list(): Promise<DocumentSummary[]> {
    const documents = await this.prisma.document.findMany({
      include: documentInclude,
      orderBy: { createdAt: 'desc' },
    });
    return documents.map((document) => this.toSummary(document));
  }

  async upload(
    file: Express.Multer.File | undefined,
    uploadedById: string,
  ): Promise<DocumentSummary> {
    this.validatePdf(file);
    const storageKey = await this.storage.savePdf(file.buffer);

    try {
      const document = await this.prisma.document.create({
        data: {
          originalName: file.originalname,
          storageKey,
          mimeType: PDF_MIME_TYPE,
          size: file.size,
          uploadedById,
        },
        include: documentInclude,
      });
      return this.toSummary(document);
    } catch (error) {
      // 数据库没有元数据时，删除已写入的文件，避免产生无法访问的孤儿文件。
      await this.storage.remove(storageKey);
      throw error;
    }
  }

  async getContent(documentId: string): Promise<DocumentContent> {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
    });
    if (!document) {
      throw new NotFoundException({
        code: 'DOCUMENT_NOT_FOUND',
        message: '文件记录不存在',
      });
    }

    return {
      filePath: await this.storage.getFilePath(document.storageKey),
      originalName: document.originalName,
      mimeType: document.mimeType,
      size: document.size,
    };
  }

  private validatePdf(file?: Express.Multer.File): asserts file is Express.Multer.File {
    if (!file) {
      throw new BadRequestException({
        code: 'FILE_REQUIRED',
        message: '请选择要上传的 PDF 文件',
      });
    }
    if (file.size === 0 || file.size > MAX_UPLOAD_BYTES) {
      throw new BadRequestException({
        code: 'FILE_SIZE_INVALID',
        message: '文件大小必须在 1 字节到 10 MB 之间',
      });
    }
    const hasPdfSignature = file.buffer.subarray(0, 5).toString() === '%PDF-';
    if (file.mimetype !== PDF_MIME_TYPE || !hasPdfSignature) {
      throw new BadRequestException({
        code: 'UNSUPPORTED_FILE_TYPE',
        message: '当前课程只允许上传 PDF 文件',
      });
    }
  }

  private toSummary(document: {
    id: string;
    originalName: string;
    mimeType: string;
    size: number;
    createdAt: Date;
    uploadedBy: { id: string; displayName: string };
  }): DocumentSummary {
    return {
      id: document.id,
      originalName: document.originalName,
      mimeType: document.mimeType,
      size: document.size,
      createdAt: document.createdAt.toISOString(),
      uploadedBy: document.uploadedBy,
    };
  }
}
