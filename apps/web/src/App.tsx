import { useCallback, useEffect, useState } from 'react';
import { fetchCurrentUser, hasStoredSession, logout } from './api/auth';
import type { AuthUser } from './api/auth';
import { fetchHealth } from './api/health';
import type { HealthResponse } from './api/health';
import { LoginCard } from './components/LoginCard';
import { DocumentPanel } from './components/DocumentPanel';
import { ReviewScoreCard } from './components/ReviewScoreCard';

type RequestState = 'idle' | 'loading' | 'success' | 'error';

const requestSteps = [
  ['1', 'React', "调用 fetch('/api/health')"],
  ['2', 'Vite 代理', '把 /api 转发到 localhost:3000'],
  ['3', 'NestJS', 'Controller 接收，Service 产生数据'],
  ['4', 'React', '解析 JSON 并更新页面状态'],
];

export default function App() {
  const [state, setState] = useState<RequestState>('idle');
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState('');
  const [sessionLoading, setSessionLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);

  const loadHealth = useCallback(async () => {
    setState('loading');
    setError('');
    try {
      const data = await fetchHealth();
      setHealth(data);
      setState('success');
    } catch (requestError) {
      setHealth(null);
      setError(requestError instanceof Error ? requestError.message : '未知错误');
      setState('error');
    }
  }, []);

  useEffect(() => {
    void loadHealth();
  }, [loadHealth]);

  useEffect(() => {
    if (!hasStoredSession()) {
      setSessionLoading(false);
      return;
    }
    void fetchCurrentUser()
      .then(setUser)
      .catch(() => logout())
      .finally(() => setSessionLoading(false));
  }, []);

  function handleLogout() {
    logout();
    setUser(null);
  }

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-12 text-slate-100">
      <div className="mx-auto max-w-5xl">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-sky-400">
          Fullstack Learning Lab
        </p>
        <h1 className="text-3xl font-bold sm:text-4xl">从文件上传走到鉴权预览</h1>
        <p className="mt-4 max-w-3xl leading-7 text-slate-400">
          这个页面不是读取前端假数据。它会经过 Vite 开发代理，请求运行在 3000 端口的 NestJS API。
        </p>

        <section className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-slate-400">GET /api/health</p>
                <h2 className="mt-1 text-xl font-semibold">后端健康状态</h2>
              </div>
              <span className={`h-3 w-3 rounded-full ${state === 'success' ? 'bg-emerald-400' : state === 'error' ? 'bg-rose-400' : 'bg-amber-400'}`} />
            </div>

            <div className="mt-6 min-h-40 rounded-xl bg-slate-950 p-5 font-mono text-sm">
              {state === 'loading' && <p className="text-amber-300">正在请求后端……</p>}
              {state === 'error' && <p className="text-rose-300">{error}</p>}
              {state === 'success' && health && (
                <pre className="whitespace-pre-wrap text-emerald-300">
                  {JSON.stringify(health, null, 2)}
                </pre>
              )}
            </div>

            <button
              type="button"
              className="mt-5 rounded-lg bg-sky-500 px-4 py-2 font-semibold text-white transition hover:bg-sky-400 disabled:cursor-wait disabled:opacity-60"
              disabled={state === 'loading'}
              onClick={() => void loadHealth()}
            >
              重新请求
            </button>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-xl font-semibold">这次请求经过哪里？</h2>
            <ol className="mt-5 space-y-4">
              {requestSteps.map(([number, title, description]) => (
                <li className="flex gap-4" key={number}>
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sky-500/15 font-bold text-sky-300">
                    {number}
                  </span>
                  <div>
                    <h3 className="font-semibold">{title}</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {sessionLoading ? (
          <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-6 text-slate-400">
            正在检查登录状态……
          </section>
        ) : user ? (
          <>
            <section className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-emerald-800 bg-slate-900 p-5">
              <div>
                <p className="text-sm text-emerald-300">已通过 JWT 确认身份</p>
                <p className="mt-1 font-semibold">
                  {user.displayName} · {user.role === 'EXPERT' ? '专家角色' : '只读角色'}
                </p>
              </div>
              <button className="rounded-lg border border-slate-700 px-4 py-2" type="button" onClick={handleLogout}>
                退出登录
              </button>
            </section>
            <ReviewScoreCard canScore={user.role === 'EXPERT'} />
            <DocumentPanel canUpload={user.role === 'EXPERT'} />
          </>
        ) : (
          <LoginCard onLogin={setUser} />
        )}

        <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-xl font-semibold">第 5A 课练习</h2>
          <p className="mt-3 leading-7 text-slate-400">
            使用专家账号上传 PDF，观察数据库只保存元数据；再用查看账号登录并完成鉴权预览。
          </p>
        </section>
      </div>
    </main>
  );
}
