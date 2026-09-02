export const DEMO_REVIEW_ITEM_ID = 'review-progress-plan';

const bidderId = 'demo-bidder';
const expertId = 'demo-expert';

export interface ReviewDetail {
  reviewItem: {
    id: string;
    title: string;
    description: string;
    maxScore: number;
    aiScore: number;
  };
  score: {
    score: number;
    feedback: string;
    updatedAt: string;
  } | null;
}

async function readJson(response: Response): Promise<ReviewDetail> {
  const data = await response.json() as ReviewDetail & { message?: string };
  if (!response.ok) throw new Error(data.message || `请求失败：${response.status}`);
  return data;
}

export async function fetchReviewDetail(): Promise<ReviewDetail> {
  const query = new URLSearchParams({ bidderId, expertId });
  const response = await fetch(`/api/review-items/${DEMO_REVIEW_ITEM_ID}?${query}`);
  return readJson(response);
}

export async function saveExpertScore(score: number, feedback: string): Promise<ReviewDetail> {
  const response = await fetch(`/api/review-items/${DEMO_REVIEW_ITEM_ID}/score`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bidderId, expertId, score, feedback }),
  });
  return readJson(response);
}
