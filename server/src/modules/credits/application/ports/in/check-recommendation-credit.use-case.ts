export const CHECK_RECOMMENDATION_CREDIT_USE_CASE = Symbol(
  'CHECK_RECOMMENDATION_CREDIT_USE_CASE',
);

export interface CheckRecommendationCreditUseCase {
  checkRecommendationCredit(userId: string): Promise<void>;
}
