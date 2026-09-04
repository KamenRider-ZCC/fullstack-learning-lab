import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchDocumentPreviewUrl,
  fetchDocuments,
  uploadDocument,
} from '../api/documents';
import type { DocumentSummary } from '../api/documents';
import { DocumentPanel } from './DocumentPanel';

vi.mock('../api/documents', () => ({
  fetchDocuments: vi.fn(),
  fetchDocumentPreviewUrl: vi.fn(),
  uploadDocument: vi.fn(),
}));

const existingDocument: DocumentSummary = {
  id: 'document-1',
  originalName: '投标文件.pdf',
  mimeType: 'application/pdf',
  size: 2048,
  createdAt: '2026-09-03T08:00:00.000Z',
  uploadedBy: { id: 'expert-1', displayName: '演示评审专家' },
};
const mockedFetchDocuments = vi.mocked(fetchDocuments);
const mockedPreviewUrl = vi.mocked(fetchDocumentPreviewUrl);
const mockedUploadDocument = vi.mocked(uploadDocument);

describe('DocumentPanel', () => {
  beforeEach(() => {
    mockedFetchDocuments.mockReset();
    mockedPreviewUrl.mockReset();
    mockedUploadDocument.mockReset();
    mockedFetchDocuments.mockResolvedValue([existingDocument]);
  });

  it('查看角色能看到文件，但上传控件不可用', async () => {
    render(<DocumentPanel canUpload={false} />);

    expect(await screen.findByText('投标文件.pdf')).toBeInTheDocument();
    expect(screen.getByText(/2.0 KB · 演示评审专家/)).toBeInTheDocument();
    expect(screen.getByLabelText('选择 PDF 文件')).toBeDisabled();
    expect(screen.getByRole('button', { name: '当前角色不可上传' }))
      .toBeDisabled();
  });

  it('专家选择 PDF 后完成上传，并把新文件加入列表', async () => {
    const user = userEvent.setup();
    const uploadedDocument: DocumentSummary = {
      ...existingDocument,
      id: 'document-2',
      originalName: '新投标文件.pdf',
      size: 24,
    };
    mockedUploadDocument.mockResolvedValue(uploadedDocument);
    render(<DocumentPanel canUpload />);
    await screen.findByText('投标文件.pdf');
    const file = new File(['%PDF-1.4 test content'], '新投标文件.pdf', {
      type: 'application/pdf',
    });

    await user.upload(screen.getByLabelText('选择 PDF 文件'), file);
    await user.click(screen.getByRole('button', { name: '上传 PDF' }));

    expect(await screen.findByText('新投标文件.pdf')).toBeInTheDocument();
    expect(mockedUploadDocument).toHaveBeenCalledWith(file);
    expect(screen.getByText('PDF 已保存到 MinIO，元数据已保存到 PostgreSQL'))
      .toBeInTheDocument();
    expect(screen.getByLabelText('选择 PDF 文件')).toHaveValue('');
  });

  it('点击预览后把后端返回的签名 URL 放进对应 iframe', async () => {
    const user = userEvent.setup();
    const signedUrl = 'http://127.0.0.1:9000/fullstack-documents/test.pdf?signature=test';
    mockedPreviewUrl.mockResolvedValue({
      url: signedUrl,
      expiresAt: '2026-09-03T08:05:00.000Z',
      expiresInSeconds: 300,
    });
    render(<DocumentPanel canUpload />);
    await screen.findByText('投标文件.pdf');

    await user.click(screen.getByRole('button', { name: '生成临时地址并预览' }));

    const frame = await screen.findByTitle('投标文件.pdf');
    expect(mockedPreviewUrl).toHaveBeenCalledWith(existingDocument.id);
    expect(frame).toHaveAttribute('src', signedUrl);
    expect(screen.getByText(/此地址将在 .* 失效/)).toBeInTheDocument();
  });

  it('关闭预览只移除 iframe，文件列表仍保留', async () => {
    const user = userEvent.setup();
    mockedPreviewUrl.mockResolvedValue({
      url: 'http://127.0.0.1:9000/signed.pdf',
      expiresAt: '2026-09-03T08:05:00.000Z',
      expiresInSeconds: 300,
    });
    render(<DocumentPanel canUpload />);
    await screen.findByText('投标文件.pdf');
    await user.click(screen.getByRole('button', { name: '生成临时地址并预览' }));
    await screen.findByTitle('投标文件.pdf');

    await user.click(screen.getByRole('button', { name: '关闭预览' }));

    expect(screen.queryByTitle('投标文件.pdf')).not.toBeInTheDocument();
    expect(screen.getByText('投标文件.pdf')).toBeInTheDocument();
  });

  it('列表请求失败时显示 API 错误', async () => {
    mockedFetchDocuments.mockRejectedValue(
      new Error('[INTERNAL_SERVER_ERROR] 文件列表读取失败'),
    );
    render(<DocumentPanel canUpload />);

    expect(await screen.findByText('[INTERNAL_SERVER_ERROR] 文件列表读取失败'))
      .toBeInTheDocument();
    expect(screen.getByText('还没有文件，请使用专家账号上传第一个 PDF。'))
      .toBeInTheDocument();
  });

  it('每个文件的预览按钮都位于自己的列表项中', async () => {
    const secondDocument = {
      ...existingDocument,
      id: 'document-2',
      originalName: '报价文件.pdf',
    };
    mockedFetchDocuments.mockResolvedValue([existingDocument, secondDocument]);
    render(<DocumentPanel canUpload />);

    const secondName = await screen.findByText('报价文件.pdf');
    const listItem = secondName.closest('li');

    expect(listItem).not.toBeNull();
    expect(within(listItem!).getByRole('button', { name: '生成临时地址并预览' }))
      .toBeInTheDocument();
    await waitFor(() => expect(mockedFetchDocuments).toHaveBeenCalledOnce());
  });
});
