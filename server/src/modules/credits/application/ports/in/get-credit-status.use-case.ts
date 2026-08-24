import { CreditStatus } from '../../../domain/credit.entity';

export const GET_CREDIT_STATUS_USE_CASE = Symbol('GET_CREDIT_STATUS_USE_CASE');

export interface GetCreditStatusUseCase {
  getStatus(userId: string): Promise<CreditStatus>;
}
