import { CreditLedgerEntry } from '../../../domain/credit.entity';

export const LIST_CREDIT_LEDGER_USE_CASE = Symbol('LIST_CREDIT_LEDGER_USE_CASE');

export interface ListCreditLedgerUseCase {
  listLedger(userId: string): Promise<CreditLedgerEntry[]>;
}

