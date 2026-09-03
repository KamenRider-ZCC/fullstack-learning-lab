import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password.js';

describe('password helpers', () => {
  it('正确密码可以通过验证，错误密码不能', async () => {
    const encoded = await hashPassword('demo123456');

    expect(encoded).toMatch(/^scrypt:[a-f0-9]+:[a-f0-9]+$/);
    expect(encoded).not.toContain('demo123456');
    await expect(verifyPassword('demo123456', encoded)).resolves.toBe(true);
    await expect(verifyPassword('wrong-password', encoded)).resolves.toBe(false);
  });

  it('相同密码因为随机盐而得到不同摘要', async () => {
    const first = await hashPassword('same-password');
    const second = await hashPassword('same-password');

    expect(first).not.toBe(second);
  });

  it('拒绝不完整或不支持的摘要格式', async () => {
    await expect(verifyPassword('demo123456', 'plain:abc:def')).resolves.toBe(false);
    await expect(verifyPassword('demo123456', 'scrypt::')).resolves.toBe(false);
  });
});
