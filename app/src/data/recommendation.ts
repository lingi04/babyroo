export type RecommendationSession = {
  id: string;
  createdAt: string;
  userId: string;
  childIds: string[];
  resultEventIds: string[];
  creditCost: number;
};

