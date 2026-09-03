import { ChangeEvent, useCallback, useEffect, useState } from 'react';
import {
  fetchDocumentPreviewUrl,
  fetchDocuments,
  uploadDocument,
} from '../api/documents';
import type { DocumentSummary } from '../api/documents';

interface DocumentPanelProps {
  canUpload: boolean;
}

type Message = { tone: 'success' | 'error'; text: string } | null;

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function DocumentPanel({ canUpload }: DocumentPanelProps) {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [previewLoadingId, setPreviewLoadingId] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewName, setPreviewName] = useState('');
  const [previewExpiresAt, setPreviewExpiresAt] = useState('');
  const [message, setMessage] = useState<Message>(null);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    try {
      setDocuments(await fetchDocuments());
    } catch (error) {
      setMessage({
        tone: 'error',
        text: error instanceof Error ? error.message : '文件列表读取失败',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setSelectedFile(event.target.files?.[0] || null);
    setMessage(null);
  }

  async function handleUpload() {
    if (!selectedFile) {
      setMessage({ tone: 'error', text: '请先选择一个 PDF 文件' });
      return;
    }
    setUploading(true);
    setMessage(null);
    try {
      const document = await uploadDocument(selectedFile);
      setDocuments((current) => [document, ...current]);
      setSelectedFile(null);
      setFileInputKey((current) => current + 1);
      setMessage({ tone: 'success', text: 'PDF 已保存到 MinIO，元数据已保存到 PostgreSQL' });
    } catch (error) {
      setMessage({
        tone: 'error',
        text: error instanceof Error ? error.message : '上传失败',
      });
    } finally {
      setUploading(false);
    }
  }

  async function handlePreview(document: DocumentSummary) {
    setPreviewLoadingId(document.id);
    setMessage(null);
    try {
      const preview = await fetchDocumentPreviewUrl(document.id);
      setPreviewName(document.originalName);
      setPreviewUrl(preview.url);
      setPreviewExpiresAt(preview.expiresAt);
    } catch (error) {
      setMessage({
        tone: 'error',
        text: error instanceof Error ? error.message : '预览读取失败',
      });
    } finally {
      setPreviewLoadingId('');
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <p className="text-sm font-semibold text-cyan-300">第 5C 课 · 短期签名 URL</p>
      <h2 className="mt-2 text-2xl font-semibold">鉴权后直连 MinIO 预览</h2>
      <p className="mt-2 leading-7 text-slate-400">
        后端先检查 JWT，再签发 5 分钟有效的预览地址；浏览器随后直接从 MinIO 读取 PDF。
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <input
          accept="application/pdf,.pdf"
          className="max-w-full text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-700 file:px-3 file:py-2 file:text-slate-100"
          disabled={!canUpload || uploading}
          key={fileInputKey}
          type="file"
          onChange={handleFileChange}
        />
        <button
          className="rounded-lg bg-cyan-600 px-4 py-2 font-semibold hover:bg-cyan-500 disabled:opacity-50"
          disabled={!canUpload || uploading}
          type="button"
          onClick={() => void handleUpload()}
        >
          {!canUpload ? '当前角色不可上传' : uploading ? '上传中……' : '上传 PDF'}
        </button>
      </div>

      {message && (
        <p className={`mt-4 text-sm ${message.tone === 'success' ? 'text-emerald-300' : 'text-rose-300'}`}>
          {message.text}
        </p>
      )}

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-800">
        {loading ? (
          <p className="p-4 text-slate-400">正在读取文件列表……</p>
        ) : documents.length === 0 ? (
          <p className="p-4 text-slate-400">还没有文件，请使用专家账号上传第一个 PDF。</p>
        ) : (
          <ul className="divide-y divide-slate-800">
            {documents.map((document) => (
              <li className="flex flex-wrap items-center justify-between gap-3 p-4" key={document.id}>
                <div>
                  <p className="font-medium">{document.originalName}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatSize(document.size)} · {document.uploadedBy.displayName} ·{' '}
                    {new Date(document.createdAt).toLocaleString()}
                  </p>
                </div>
                <button
                  className="rounded-lg border border-cyan-700 px-3 py-2 text-sm text-cyan-200"
                  disabled={previewLoadingId === document.id}
                  type="button"
                  onClick={() => void handlePreview(document)}
                >
                  {previewLoadingId === document.id ? '生成中……' : '生成临时地址并预览'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {previewUrl && (
        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="font-semibold">正在预览：{previewName}</h3>
            <button className="text-sm text-slate-400" type="button" onClick={() => setPreviewUrl('')}>
              关闭预览
            </button>
          </div>
          <p className="mb-3 text-xs text-amber-300">
            此地址将在 {new Date(previewExpiresAt).toLocaleTimeString()} 失效；重新打开会生成新地址。
          </p>
          <iframe className="h-[600px] w-full rounded-xl bg-white" src={previewUrl} title={previewName} />
        </div>
      )}
    </section>
  );
}
