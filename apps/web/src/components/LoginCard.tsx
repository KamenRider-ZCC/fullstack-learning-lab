import { FormEvent, useState } from 'react';
import { login } from '../api/auth';
import type { AuthUser } from '../api/auth';

interface LoginCardProps {
  onLogin(user: AuthUser): void;
}

export function LoginCard({ onLogin }: LoginCardProps) {
  const [username, setUsername] = useState('expert');
  const [password, setPassword] = useState('demo123456');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      onLogin(await login(username.trim(), password));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '登录失败');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-sky-800 bg-slate-900 p-6">
      <p className="text-sm font-semibold text-sky-300">第 4 课 · 登录与鉴权</p>
      <h2 className="mt-2 text-2xl font-semibold">登录后才能查看评审数据</h2>
      <p className="mt-2 text-sm leading-6 text-slate-400">
        专家账号可以评分，查看账号只能读取。两个演示账号的密码都是 demo123456。
      </p>

      <div className="mt-5 flex gap-3">
        {['expert', 'viewer'].map((account) => (
          <button
            className={`rounded-lg border px-3 py-2 text-sm ${
              username === account
                ? 'border-sky-400 bg-sky-500/15 text-sky-200'
                : 'border-slate-700 text-slate-400'
            }`}
            key={account}
            type="button"
            onClick={() => setUsername(account)}
          >
            {account === 'expert' ? '专家账号' : '查看账号'}
          </button>
        ))}
      </div>

      <form className="mt-5 grid gap-4 md:grid-cols-2" onSubmit={(event) => void handleSubmit(event)}>
        <label className="grid gap-2 text-sm text-slate-300">
          用户名
          <input
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </label>
        <label className="grid gap-2 text-sm text-slate-300">
          密码
          <input
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <div className="md:col-span-2">
          <button
            className="rounded-lg bg-sky-500 px-4 py-2 font-semibold hover:bg-sky-400 disabled:opacity-60"
            disabled={submitting}
            type="submit"
          >
            {submitting ? '登录中……' : '登录并获取 Token'}
          </button>
          {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
        </div>
      </form>
    </section>
  );
}
