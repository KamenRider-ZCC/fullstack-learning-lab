import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../app.module.js';
import { configureHttpApp } from '../configure-http-app.js';

const pdfContent = Buffer.from(
  '%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<<>>\n%%EOF',
);

interface LoginBody {
  accessToken: string;
}

interface UploadedDocumentBody {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
}

interface PreviewUrlBody {
  url: string;
  expiresAt: string;
  expiresInSeconds: number;
}

describe('真实 HTTP + PostgreSQL + MinIO', () => {
  let moduleRef: TestingModule;
  let app: INestApplication;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    // 与 main.ts 复用相同配置，避免测试漏掉全局前缀、DTO 管道或异常过滤器。
    configureHttpApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await moduleRef.close();
  });

  it('健康检查经过真实 NestJS HTTP 管道', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/health')
      .expect(200);

    expect(response.body).toMatchObject({
      status: 'ok',
      service: 'fullstack-learning-api',
    });
  });

  it('未登录不能读取文件列表', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/documents')
      .expect(401);

    expect(response.body).toMatchObject({
      success: false,
      code: 'AUTH_REQUIRED',
      path: '/api/documents',
    });
  });

  it('查看角色不能上传文件', async () => {
    const token = await login('viewer');

    const response = await request(app.getHttpServer())
      .post('/api/documents')
      .set('Authorization', bearer(token))
      .attach('file', pdfContent, {
        filename: 'viewer-cannot-upload.pdf',
        contentType: 'application/pdf',
      })
      .expect(403);

    expect(response.body.code).toBe('INSUFFICIENT_ROLE');
  });

  it('真实 multipart 管道会拒绝伪 PDF', async () => {
    const token = await login('expert');

    const response = await request(app.getHttpServer())
      .post('/api/documents')
      .set('Authorization', bearer(token))
      .attach('file', Buffer.from('not a real pdf'), {
        filename: 'fake.pdf',
        contentType: 'application/pdf',
      })
      .expect(400);

    expect(response.body.code).toBe('UNSUPPORTED_FILE_TYPE');
  });

  it('ValidationPipe 拒绝前端伪造 expertId，合法评分可以持久化', async () => {
    const expertToken = await login('expert');
    const forgedResponse = await request(app.getHttpServer())
      .put('/api/review-items/review-progress-plan/score')
      .set('Authorization', bearer(expertToken))
      .send({
        bidderId: 'integration-bidder',
        score: 3.5,
        feedback: '集成测试评分',
        expertId: 'forged-user-id',
      })
      .expect(400);

    expect(forgedResponse.body.code).toBe('VALIDATION_ERROR');
    expect(forgedResponse.body.details.join(' ')).toContain('expertId');

    const savedResponse = await request(app.getHttpServer())
      .put('/api/review-items/review-progress-plan/score')
      .set('Authorization', bearer(expertToken))
      .send({
        bidderId: 'integration-bidder',
        score: 3.5,
        feedback: '集成测试评分',
      })
      .expect(200);

    expect(savedResponse.body.score).toMatchObject({
      score: 3.5,
      feedback: '集成测试评分',
    });

    const viewerToken = await login('viewer');
    const forbiddenResponse = await request(app.getHttpServer())
      .put('/api/review-items/review-progress-plan/score')
      .set('Authorization', bearer(viewerToken))
      .send({ bidderId: 'integration-bidder', score: 4 })
      .expect(403);

    expect(forbiddenResponse.body.code).toBe('INSUFFICIENT_ROLE');
  });

  it('专家上传到测试 MinIO，查看角色通过短期 URL 直连预览', async () => {
    const expertToken = await login('expert');
    const uploadResponse = await request(app.getHttpServer())
      .post('/api/documents')
      .set('Authorization', bearer(expertToken))
      .attach('file', pdfContent, {
        filename: 'integration-test.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);
    const uploaded = uploadResponse.body as UploadedDocumentBody;

    expect(uploaded).toMatchObject({
      originalName: 'integration-test.pdf',
      mimeType: 'application/pdf',
      size: pdfContent.length,
    });
    expect(uploaded.id).toBeTruthy();

    const viewerToken = await login('viewer');
    const listResponse = await request(app.getHttpServer())
      .get('/api/documents')
      .set('Authorization', bearer(viewerToken))
      .expect(200);

    expect(listResponse.body).toHaveLength(1);
    expect(listResponse.body[0]).not.toHaveProperty('storageKey');

    const previewResponse = await request(app.getHttpServer())
      .get(`/api/documents/${uploaded.id}/preview-url`)
      .set('Authorization', bearer(viewerToken))
      .expect(200);
    const preview = previewResponse.body as PreviewUrlBody;
    const signedUrl = new URL(preview.url);

    expect(preview.expiresInSeconds).toBe(60);
    expect(new Date(preview.expiresAt).getTime()).toBeGreaterThan(Date.now());
    expect(signedUrl.host).toBe('127.0.0.1:59000');
    expect(signedUrl.searchParams.get('X-Amz-Expires')).toBe('60');
    expect(signedUrl.searchParams.get('X-Amz-Signature')).toBeTruthy();

    const pdfResponse = await fetch(signedUrl);
    const downloaded = Buffer.from(await pdfResponse.arrayBuffer());
    expect(pdfResponse.status).toBe(200);
    expect(pdfResponse.headers.get('content-type')).toContain('application/pdf');
    expect(downloaded).toEqual(pdfContent);

    const tamperedUrl = changeOneSignatureCharacter(preview.url);
    const tamperedResponse = await fetch(tamperedUrl);
    expect(tamperedResponse.status).toBe(403);
  });

  async function login(username: 'expert' | 'viewer') {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username, password: 'demo123456' })
      .expect(201);
    return (response.body as LoginBody).accessToken;
  }
});

function bearer(token: string) {
  return `Bearer ${token}`;
}

function changeOneSignatureCharacter(url: string) {
  const signaturePattern = /(X-Amz-Signature=)([a-f0-9]+)/;
  const match = url.match(signaturePattern);
  if (!match) throw new Error('测试签名 URL 缺少 X-Amz-Signature');
  const signature = match[2];
  const replacement = signature.endsWith('0') ? '1' : '0';
  const changed = `${signature.slice(0, -1)}${replacement}`;
  return url.replace(signaturePattern, `$1${changed}`);
}
