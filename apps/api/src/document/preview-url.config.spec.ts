import { afterEach, describe, expect, it, vi } from 'vitest';
import { readPreviewUrlTtlSeconds } from './preview-url.config.js';

describe('readPreviewUrlTtlSeconds', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('读取有效的整数秒数', () => {
    vi.stubEnv('PREVIEW_URL_TTL_SECONDS', '300');

    expect(readPreviewUrlTtlSeconds()).toBe(300);
  });

  it.each(['', '9', '60.5', '3601', 'not-a-number'])(
    '拒绝无效配置：%s',
    (value) => {
      vi.stubEnv('PREVIEW_URL_TTL_SECONDS', value);

      expect(() => readPreviewUrlTtlSeconds()).toThrow(
        'PREVIEW_URL_TTL_SECONDS 必须是 10 到 3600 之间的整数',
      );
    },
  );
});
