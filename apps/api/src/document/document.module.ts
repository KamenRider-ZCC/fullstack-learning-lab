import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DocumentController } from './document.controller.js';
import { DocumentService } from './document.service.js';
import { MinioFileStorageService } from './minio-file-storage.service.js';
import { FILE_STORAGE } from './file-storage.port.js';
import { TEMPORARY_FILE_URL } from './temporary-file-url.port.js';

@Module({
  imports: [AuthModule],
  controllers: [DocumentController],
  providers: [
    DocumentService,
    MinioFileStorageService,
    { provide: FILE_STORAGE, useExisting: MinioFileStorageService },
    { provide: TEMPORARY_FILE_URL, useExisting: MinioFileStorageService },
  ],
})
export class DocumentModule {}
