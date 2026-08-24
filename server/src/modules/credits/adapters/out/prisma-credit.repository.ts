import { Injectable } from '@nestjs/common';
import { PrismaNeon } from '@prisma/adapter-neon';
import { ApplicationError } from '../../../../common/application-error';
import { getDatabaseUrl } from '../../../../common/database-url';
import { createId } from '../../../../common/id';
import {
  CreditLedgerEntry as PrismaCreditLedgerEntry,
  Prisma,
  PrismaClient,
} from '../../../../generated/prisma/client';
import { CreditRepositoryPort } from '../../application/ports/out/credit-repository.port';
import { CreditBalance, CreditLedgerEntry } from '../../domain/credit.entity';

@Injectable()
export class PrismaCreditRepository implements CreditRepositoryPort {
  private readonly prisma = new PrismaClient({
    adapter: new PrismaNeon({
      connectionString: getDatabaseUrl() ?? '',
    }),
  });

  private readonly defaultStartingCredits = Number(
    process.env.DEFAULT_RECOMMENDATION_CREDITS ?? 3,
  );

  async getBalance(userId: string): Promise<CreditBalance> {
    const account = await this.ensureAccount(userId);

    return {
      userId,
      available: account.available,
    };
  }

  async grant(
    userId: string,
    amount: number,
    reason: string,
    metadata?: Record<string, unknown>,
  ): Promise<{ balance: CreditBalance; ledgerEntry: CreditLedgerEntry }> {
    return this.prisma.$transaction(async tx => {
      await this.ensureAccount(userId, tx);
      const [account, ledgerEntry] = await Promise.all([
        tx.creditAccount.update({
          where: { userId },
          data: {
            available: {
              increment: amount,
            },
          },
        }),
        tx.creditLedgerEntry.create({
          data: {
            id: createId('credit'),
            userId,
            amount,
            reason,
            metadata: metadata as Prisma.InputJsonValue,
          },
        }),
      ]);

      return {
        balance: {
          userId,
          available: account.available,
        },
        ledgerEntry: this.toDomainLedgerEntry(ledgerEntry),
      };
    });
  }

  async consume(
    userId: string,
    amount: number,
    reason: string,
  ): Promise<CreditBalance> {
    return this.prisma.$transaction(async tx => {
      const account = await this.ensureAccount(userId, tx);

      if (account.available < amount) {
        throw new ApplicationError(
          'INSUFFICIENT_CREDITS',
          'Not enough recommendation credits',
          402,
        );
      }

      const updatedAccount = await tx.creditAccount.update({
        where: { userId },
        data: {
          available: {
            decrement: amount,
          },
        },
      });
      await tx.creditLedgerEntry.create({
        data: {
          id: createId('credit'),
          userId,
          amount: -amount,
          reason,
        },
      });

      return {
        userId,
        available: updatedAccount.available,
      };
    });
  }

  async listLedger(userId: string): Promise<CreditLedgerEntry[]> {
    await this.ensureAccount(userId);
    const entries = await this.prisma.creditLedgerEntry.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return entries.map(entry => this.toDomainLedgerEntry(entry));
  }

  private async ensureAccount(
    userId: string,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    const existingAccount = await tx.creditAccount.findUnique({
      where: { userId },
    });

    if (existingAccount) {
      return existingAccount;
    }

    const account = await tx.creditAccount.create({
      data: {
        userId,
        available: this.defaultStartingCredits,
      },
    });

    if (this.defaultStartingCredits > 0) {
      await tx.creditLedgerEntry.create({
        data: {
          id: createId('credit'),
          userId,
          amount: this.defaultStartingCredits,
          reason: 'starting_credits',
        },
      });
    }

    return account;
  }

  private toDomainLedgerEntry(
    entry: PrismaCreditLedgerEntry,
  ): CreditLedgerEntry {
    return {
      id: entry.id,
      userId: entry.userId,
      amount: entry.amount,
      reason: entry.reason,
      metadata: entry.metadata as Record<string, unknown> | undefined,
      createdAt: entry.createdAt.toISOString(),
    };
  }
}
