import {
  CreditPurchase,
  VerifyGooglePlayPurchaseInput,
} from '../../../domain/credit.entity';

export const VERIFY_GOOGLE_PLAY_PURCHASE_USE_CASE = Symbol(
  'VERIFY_GOOGLE_PLAY_PURCHASE_USE_CASE',
);

export interface VerifyGooglePlayPurchaseUseCase {
  verifyGooglePlayPurchase(
    userId: string,
    input: VerifyGooglePlayPurchaseInput,
  ): Promise<CreditPurchase>;
}
