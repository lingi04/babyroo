import {
  CreateCreditPurchaseInput,
  CreditPurchase,
} from '../../../domain/credit.entity';

export const CREATE_CREDIT_PURCHASE_USE_CASE = Symbol(
  'CREATE_CREDIT_PURCHASE_USE_CASE',
);

export interface CreateCreditPurchaseUseCase {
  createPurchase(
    userId: string,
    input: CreateCreditPurchaseInput,
  ): Promise<CreditPurchase>;
}
