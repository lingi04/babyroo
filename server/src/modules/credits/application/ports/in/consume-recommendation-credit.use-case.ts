import { CreditBalance } from '../../../domain/credit.entity';

export const CONSUME_RECOMMENDATION_CREDIT_USE_CASE = Symbol(
  'CONSUME_RECOMMENDATION_CREDIT_USE_CASE',
);

export interface ConsumeRecommendationCreditUseCase {
  consumeRecommendationCredit(userId: string): Promise<CreditBalance>;
}

