export type CreditBalance = {
  userId: string;
  available: number;
};

export type CreditLedgerEntry = {
  id: string;
  userId: string;
  amount: number;
  reason: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type CreditPackage = {
  id: string;
  googlePlayProductId: string;
  credits: number;
  priceKrw: number;
  label: string;
};

export type CreditStatus = {
  balance: CreditBalance;
  ledger: CreditLedgerEntry[];
  packages: CreditPackage[];
};

export type CreateCreditPurchaseInput = {
  packageId: string;
};

export type CreditPurchase = {
  id: string;
  status: 'credited' | 'already_credited';
  package: CreditPackage;
  balance: CreditBalance;
  ledgerEntry: CreditLedgerEntry;
};

export type VerifyGooglePlayPurchaseInput = {
  productId: string;
  purchaseToken: string;
  packageName?: string;
};

export type GooglePlayPurchaseRecordInput = {
  userId: string;
  productId: string;
  packageName: string;
  purchaseToken: string;
  orderId?: string;
  purchaseState?: number;
  consumptionState?: number;
  acknowledgementState?: number;
  credits: number;
  rawResponse?: Record<string, unknown>;
  ledgerMetadata?: Record<string, unknown>;
};

export type GooglePlayPurchaseRecord = {
  id: string;
  userId: string;
  productId: string;
  packageName: string;
  purchaseToken: string;
  orderId?: string;
  purchaseState?: number;
  consumptionState?: number;
  acknowledgementState?: number;
  credits: number;
  creditedLedgerEntryId: string;
  createdAt: string;
};
