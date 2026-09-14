export interface ReviewDetailResponse {
  reviewItem: {
    id: string;
    title: string;
    description: string;
    maxScore: number;
    aiScore: number;
    feedbackMaxLength: number;
  };
  score: {
    score: number;
    feedback: string;
    updatedAt: string;
  } | null;
}
