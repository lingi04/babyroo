export type CreditBalance = {
  userId: string;
  available: number;
};

export type CreditLedgerEntry = {
  id: string;
  userId: string;
  amount: number;
  reason: string;
  createdAt: string;
};

