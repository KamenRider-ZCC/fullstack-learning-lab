import { useCallback, useEffect, useState } from 'react';
import { fetchReviewDetail, saveExpertScore } from '../api/reviews';
import type { ReviewDetail } from '../api/reviews';

type MessageTone = 'success' | 'error';

export function ReviewScoreCard() {
  const [detail, setDetail] = useState<ReviewDetail | null>(null);
  const [score, setScore] = useState('');
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<MessageTone>('success');

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const data = await fetchReviewDetail();
      setDetail(data);
      setScore(data.score ? String(data.score.score) : '');
      setFeedback(data.score?.feedback || '');
    } catch (error) {
      setMessageTone('error');
      setMessage(error instanceof Error ? error.message : '读取失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  async function handleSave() {
    const numericScore = Number(score);
    if (!score.trim() || Number.isNaN(numericScore)) {
      setMessageTone('error');
      setMessage('请输入有效分数');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const data = await saveExpertScore(numericScore, feedback.trim());
      setDetail(data);
      setMessageTone('success');
      setMessage('保存成功。现在刷新页面，分数仍会从数据库读取。');
    } catch (error) {
      setMessageTone('error');
      setMessage(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-6 text-slate-400">正在从 PostgreSQL 读取评审数据……</section>;
  }

  if (!detail) {
    return (
      <section className="mt-6 rounded-2xl border border-rose-900 bg-rose-950/40 p-6">
        <p className="text-rose-300">{message || '没有读取到评审数据'}</p>
        <button className="mt-4 rounded bg-rose-500 px-4 py-2" type="button" onClick={() => void loadDetail()}>重新读取</button>
      </section>
    );
  }

  return (
    <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-violet-300">第 3 课 · 参数校验与错误处理</p>
          <h2 className="mt-2 text-2xl font-semibold">{detail.reviewItem.title}</h2>
          <p className="mt-2 max-w-3xl leading-7 text-slate-400">{detail.reviewItem.description}</p>
        </div>
        <div className="rounded-lg bg-sky-500/10 px-4 py-3 text-sky-200">
          AI 建议：<strong>{detail.reviewItem.aiScore}</strong> / {detail.reviewItem.maxScore} 分
        </div>
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <label className="grid gap-2 text-sm text-slate-300">
          专家评分
          <input
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 outline-none focus:border-sky-500"
            max={detail.reviewItem.maxScore}
            min="0"
            step="0.5"
            type="number"
            value={score}
            onChange={(event) => setScore(event.target.value)}
          />
        </label>
        <label className="grid gap-2 text-sm text-slate-300">
          评分说明
          <input
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 outline-none focus:border-sky-500"
            placeholder="可选"
            value={feedback}
            onChange={(event) => setFeedback(event.target.value)}
          />
        </label>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-4">
        <button
          className="rounded-lg bg-violet-500 px-4 py-2 font-semibold transition hover:bg-violet-400 disabled:cursor-wait disabled:opacity-60"
          disabled={saving}
          type="button"
          onClick={() => void handleSave()}
        >
          {saving ? '保存中……' : '保存到数据库'}
        </button>
        {detail.score && (
          <span className="text-xs text-slate-500">
            数据库最后更新时间：{new Date(detail.score.updatedAt).toLocaleString()}
          </span>
        )}
      </div>
      {message && (
        <p className={`mt-4 text-sm ${messageTone === 'success' ? 'text-emerald-300' : 'text-rose-300'}`}>
          {message}
        </p>
      )}
    </section>
  );
}
