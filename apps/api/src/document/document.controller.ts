import {
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { MAX_UPLOAD_BYTES } from './document.constants.js';
import { DocumentService } from './document.service.js';

@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentController {
  constructor(
    @Inject(DocumentService) private readonly documentService: DocumentService,
  ) {}

  @Get()
  list() {
    return this.documentService.list();
  }

  @Post()
  @Roles('EXPERT')
  @UseGuards(RolesGuard)
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  }))
  upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documentService.upload(file, user.id);
  }

  @Get(':documentId/content')
  async preview(
    @Param('documentId') documentId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const document = await this.documentService.getContent(documentId);
    const encodedName = encodeURIComponent(document.originalName);
    response.setHeader('Content-Type', document.mimeType);
    response.setHeader('Content-Length', document.size);
    response.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodedName}`);
    response.setHeader('Cache-Control', 'private, no-store');
    // MinIO 返回可读流，后端无需把整个 PDF 再加载进内存。
    return new StreamableFile(document.stream);
  }
}
