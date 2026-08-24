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
  status: 'credited';
  package: CreditPackage;
  balance: CreditBalance;
  ledgerEntry: CreditLedgerEntry;
};
