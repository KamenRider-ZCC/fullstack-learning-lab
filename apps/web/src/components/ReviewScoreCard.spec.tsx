import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchReviewDetail, saveExpertScore } from '../api/reviews';
import type { ReviewDetail } from '../api/reviews';
import { ReviewScoreCard } from './ReviewScoreCard';

vi.mock('../api/reviews', () => ({
  fetchReviewDetail: vi.fn(),
  saveExpertScore: vi.fn(),
}));

const emptyDetail: ReviewDetail = {
  reviewItem: {
    id: 'review-progress-plan',
    title: '进度计划',
    description: '进度计划评分标准',
    maxScore: 4,
    aiScore: 3.5,
    feedbackMaxLength: 200,
  },
  score: null,
};

const mockedFetchReviewDetail = vi.mocked(fetchReviewDetail);
const mockedSaveExpertScore = vi.mocked(saveExpertScore);

describe('ReviewScoreCard 评分说明', () => {
  beforeEach(() => {
    mockedFetchReviewDetail.mockReset();
    mockedSaveExpertScore.mockReset();
    mockedFetchReviewDetail.mockResolvedValue(emptyDetail);
  });

  it('显示后端给出的长度限制和字数', async () => {
    render(<ReviewScoreCard canScore />);

    const feedback = await screen.findByRole('textbox', { name: /评分说明/ });
    expect(feedback).toHaveAttribute('maxLength', '200');
    expect(screen.getByText('0 / 200')).toBeInTheDocument();
  });

  it('评分说明为空时在前端阻止请求', async () => {
    const user = userEvent.setup();
    render(<ReviewScoreCard canScore />);
    await screen.findByText('进度计划');

    await user.type(screen.getByLabelText('专家评分'), '3');
    await user.click(screen.getByRole('button', { name: '保存到数据库' }));

    expect(screen.getByText('请填写评分说明')).toBeInTheDocument();
    expect(mockedSaveExpertScore).not.toHaveBeenCalled();
  });

  it('从旧数据读取到超长说明时仍会阻止保存', async () => {
    const user = userEvent.setup();
    mockedFetchReviewDetail.mockResolvedValue({
      ...emptyDetail,
      score: {
        score: 3,
        feedback: '字'.repeat(201),
        updatedAt: '2026-09-14T08:00:00.000Z',
      },
    });
    render(<ReviewScoreCard canScore />);
    await screen.findByText('进度计划');

    await user.click(screen.getByRole('button', { name: '保存到数据库' }));

    expect(screen.getByText('评分说明不能超过 200 个字符')).toBeInTheDocument();
    expect(mockedSaveExpertScore).not.toHaveBeenCalled();
  });

  it('提交前去除评分说明首尾空格', async () => {
    const user = userEvent.setup();
    mockedSaveExpertScore.mockResolvedValue({
      ...emptyDetail,
      score: {
        score: 3,
        feedback: '依据充分',
        updatedAt: '2026-09-14T08:00:00.000Z',
      },
    });
    render(<ReviewScoreCard canScore />);
    await screen.findByText('进度计划');

    await user.type(screen.getByLabelText('专家评分'), '3');
    await user.type(
      screen.getByRole('textbox', { name: /评分说明/ }),
      '  依据充分  ',
    );
    await user.click(screen.getByRole('button', { name: '保存到数据库' }));

    expect(mockedSaveExpertScore).toHaveBeenCalledWith(3, '依据充分');
    expect(await screen.findByText(/保存成功/)).toBeInTheDocument();
  });
});
