import { describe, expect, it } from 'vitest';
import { normalizeMultipartFilename } from './document-filename.js';

describe('normalizeMultipartFilename', () => {
  it('保留普通 ASCII 文件名', () => {
    expect(normalizeMultipartFilename('proposal.pdf')).toBe('proposal.pdf');
  });

  it('修复被错误当成 Latin-1 的 UTF-8 中文文件名', () => {
    const mojibake = Buffer.from('投标文件.pdf', 'utf8').toString('latin1');

    expect(normalizeMultipartFilename(mojibake)).toBe('投标文件.pdf');
  });

  it('保留本来就是 Unicode 的文件名', () => {
    expect(normalizeMultipartFilename('评审说明.pdf')).toBe('评审说明.pdf');
  });

  it('无法安全还原时保留原名称', () => {
    expect(normalizeMultipartFilename('café.pdf')).toBe('café.pdf');
  });
});
