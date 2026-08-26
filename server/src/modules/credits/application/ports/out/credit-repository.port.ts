import {
  CreditBalance,
  CreditLedgerEntry,
  GooglePlayPurchaseRecord,
  GooglePlayPurchaseRecordInput,
} from '../../../domain/credit.entity';

export const CREDIT_REPOSITORY_PORT = Symbol('CREDIT_REPOSITORY_PORT');

export interface CreditRepositoryPort {
  getBalance(userId: string): Promise<CreditBalance>;
  grant(userId: string, amount: number, reason: string, metadata?: Record<string, unknown>): Promise<{
    balance: CreditBalance;
    ledgerEntry: CreditLedgerEntry;
  }>;
  consume(userId: string, amount: number, reason: string): Promise<CreditBalance>;
  listLedger(userId: string): Promise<CreditLedgerEntry[]>;
  findGooglePlayPurchaseByToken(
    purchaseToken: string,
  ): Promise<GooglePlayPurchaseRecord | null>;
  recordGooglePlayPurchase(input: GooglePlayPurchaseRecordInput): Promise<{
    balance: CreditBalance;
    ledgerEntry: CreditLedgerEntry;
    purchase: GooglePlayPurchaseRecord;
  }>;
}
