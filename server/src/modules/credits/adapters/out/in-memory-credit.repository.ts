import { Injectable } from '@nestjs/common';
import { ApplicationError } from '../../../../common/application-error';
import { createId } from '../../../../common/id';
import { CreditRepositoryPort } from '../../application/ports/out/credit-repository.port';
import { CreditBalance, CreditLedgerEntry } from '../../domain/credit.entity';

@Injectable()
export class InMemoryCreditRepository implements CreditRepositoryPort {
  private readonly balances = new Map<string, number>();
  private readonly ledger: CreditLedgerEntry[] = [];
  private readonly defaultStartingCredits = Number(process.env.DEFAULT_RECOMMENDATION_CREDITS ?? 3);

  async getBalance(userId: string): Promise<CreditBalance> {
    if (!this.balances.has(userId)) {
      this.balances.set(userId, this.defaultStartingCredits);
      this.ledger.push({
        id: createId('credit'),
        userId,
        amount: this.defaultStartingCredits,
        reason: 'starting_credits',
        createdAt: new Date().toISOString(),
      });
    }
    return { userId, available: this.balances.get(userId) ?? 0 };
  }

  async grant(
    userId: string,
    amount: number,
    reason: string,
    metadata?: Record<string, unknown>,
  ): Promise<{ balance: CreditBalance; ledgerEntry: CreditLedgerEntry }> {
    const balance = await this.getBalance(userId);
    const next = balance.available + amount;
    const ledgerEntry = {
      id: createId('credit'),
      userId,
      amount,
      reason,
      metadata,
      createdAt: new Date().toISOString(),
    };

    this.balances.set(userId, next);
    this.ledger.push(ledgerEntry);

    return {
      balance: { userId, available: next },
      ledgerEntry,
    };
  }

  async consume(userId: string, amount: number, reason: string): Promise<CreditBalance> {
    const balance = await this.getBalance(userId);
    if (balance.available < amount) {
      throw new ApplicationError(
        'INSUFFICIENT_CREDITS',
        'Not enough recommendation credits',
        402,
      );
    }
    const next = balance.available - amount;
    this.balances.set(userId, next);
    this.ledger.push({
      id: createId('credit'),
      userId,
      amount: -amount,
      reason,
      createdAt: new Date().toISOString(),
    });
    return { userId, available: next };
  }

  async listLedger(userId: string): Promise<CreditLedgerEntry[]> {
    return this.ledger
      .filter(entry => entry.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}
