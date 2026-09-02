import { requestJson } from './http';

export const DEMO_REVIEW_ITEM_ID = 'review-progress-plan';

const bidderId = 'demo-bidder';

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

export async function fetchReviewDetail(): Promise<ReviewDetail> {
  const query = new URLSearchParams({ bidderId });
  return requestJson<ReviewDetail>(`/api/review-items/${DEMO_REVIEW_ITEM_ID}?${query}`);
}

export async function saveExpertScore(score: number, feedback: string): Promise<ReviewDetail> {
  return requestJson<ReviewDetail>(`/api/review-items/${DEMO_REVIEW_ITEM_ID}/score`, {
    method: 'PUT',
    body: JSON.stringify({ bidderId, score, feedback }),
  });
}
