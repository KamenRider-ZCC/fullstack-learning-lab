export interface ReviewDetailResponse {
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

export interface SaveScoreBody {
  bidderId?: unknown;
  expertId?: unknown;
  score?: unknown;
  feedback?: unknown;
}
