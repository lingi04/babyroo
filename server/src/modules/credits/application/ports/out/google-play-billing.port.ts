export const GOOGLE_PLAY_BILLING_PORT = Symbol('GOOGLE_PLAY_BILLING_PORT');

export type GooglePlayProductPurchase = {
  orderId?: string;
  purchaseState?: number;
  consumptionState?: number;
  acknowledgementState?: number;
  rawResponse: Record<string, unknown>;
};

export type GooglePlayProductPurchaseRequest = {
  packageName: string;
  productId: string;
  purchaseToken: string;
};

export interface GooglePlayBillingPort {
  getProductPurchase(
    request: GooglePlayProductPurchaseRequest,
  ): Promise<GooglePlayProductPurchase>;
  consumeProductPurchase(
    request: GooglePlayProductPurchaseRequest,
  ): Promise<void>;
}
