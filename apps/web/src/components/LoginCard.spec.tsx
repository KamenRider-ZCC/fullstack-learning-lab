import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { login } from '../api/auth';
import type { AuthUser } from '../api/auth';
import { LoginCard } from './LoginCard';

vi.mock('../api/auth', () => ({ login: vi.fn() }));

const viewer: AuthUser = {
  id: 'viewer-1',
  username: 'viewer',
  displayName: '演示查看用户',
  role: 'VIEWER',
};
const mockedLogin = vi.mocked(login);

describe('LoginCard', () => {
  beforeEach(() => {
    mockedLogin.mockReset();
  });

  it('点击查看账号后，使用表单值登录并通知父组件', async () => {
    const user = userEvent.setup();
    const onLogin = vi.fn();
    mockedLogin.mockResolvedValue(viewer);
    render(<LoginCard onLogin={onLogin} />);

    await user.click(screen.getByRole('button', { name: '查看账号' }));
    expect(screen.getByLabelText('用户名')).toHaveValue('viewer');
    await user.click(screen.getByRole('button', { name: '登录并获取 Token' }));

    await waitFor(() => {
      expect(mockedLogin).toHaveBeenCalledWith('viewer', 'demo123456');
      expect(onLogin).toHaveBeenCalledWith(viewer);
    });
  });

  it('请求未完成时禁用提交按钮，避免重复登录', async () => {
    const user = userEvent.setup();
    let resolveLogin: (value: AuthUser) => void = () => undefined;
    mockedLogin.mockReturnValue(new Promise((resolve) => {
      resolveLogin = resolve;
    }));
    render(<LoginCard onLogin={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: '登录并获取 Token' }));

    const pendingButton = screen.getByRole('button', { name: '登录中……' });
    expect(pendingButton).toBeDisabled();
    resolveLogin(viewer);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '登录并获取 Token' })).toBeEnabled();
    });
  });

  it('登录失败时显示可读错误，不通知父组件', async () => {
    const user = userEvent.setup();
    const onLogin = vi.fn();
    mockedLogin.mockRejectedValue(new Error('[INVALID_CREDENTIALS] 用户名或密码错误'));
    render(<LoginCard onLogin={onLogin} />);

    await user.click(screen.getByRole('button', { name: '登录并获取 Token' }));

    expect(await screen.findByText('[INVALID_CREDENTIALS] 用户名或密码错误'))
      .toBeInTheDocument();
    expect(onLogin).not.toHaveBeenCalled();
  });
});
