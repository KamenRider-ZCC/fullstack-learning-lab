import { describe, expect, it } from 'vitest';
import {
  addPublicPathPrefix,
  normalizePublicPathPrefix,
} from './minio.config.js';

describe('MinIO public path helpers', () => {
  it('没有代理前缀时保持签名 URL 不变', () => {
    const url = 'http://127.0.0.1:9000/bucket/document.pdf?signature=test';

    expect(addPublicPathPrefix(url, '')).toBe(url);
  });

  it('把代理前缀加入路径，同时保留签名查询参数', () => {
    const result = addPublicPathPrefix(
      'https://localhost:8443/bucket/document.pdf?credential=a%2Fb&signature=test',
      '/storage',
    );

    expect(result).toBe(
      'https://localhost:8443/storage/bucket/document.pdf?credential=a%2Fb&signature=test',
    );
  });

  it.each([
    ['/storage', '/storage'],
    ['  /storage  ', '/storage'],
    ['', ''],
  ])('规范化合法路径 %s', (value, expected) => {
    expect(normalizePublicPathPrefix(value)).toBe(expected);
  });

  it.each(['storage', '/storage/', '/storage//file', '/../secret', '/storage?x=1'])(
    '拒绝不安全路径 %s',
    (value) => {
      expect(() => normalizePublicPathPrefix(value)).toThrow(
        'MINIO_PUBLIC_PATH_PREFIX 必须是以 / 开头、不以 / 结尾的安全路径',
      );
    },
  );
});
