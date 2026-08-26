import { Injectable } from '@nestjs/common';
import { PrismaNeon } from '@prisma/adapter-neon';
import { ApplicationError } from '../../../../common/application-error';
import { getDatabaseUrl } from '../../../../common/database-url';
import { createId } from '../../../../common/id';
import {
  GooglePlayPurchase as PrismaGooglePlayPurchase,
  CreditLedgerEntry as PrismaCreditLedgerEntry,
  Prisma,
  PrismaClient,
} from '../../../../generated/prisma/client';
import { CreditRepositoryPort } from '../../application/ports/out/credit-repository.port';
import {
  CreditBalance,
  CreditLedgerEntry,
  GooglePlayPurchaseRecord,
  GooglePlayPurchaseRecordInput,
} from '../../domain/credit.entity';

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

  async findGooglePlayPurchaseByToken(
    purchaseToken: string,
  ): Promise<GooglePlayPurchaseRecord | null> {
    const purchase = await this.prisma.googlePlayPurchase.findUnique({
      where: { purchaseToken },
    });

    return purchase ? this.toDomainGooglePlayPurchase(purchase) : null;
  }

  async recordGooglePlayPurchase(input: GooglePlayPurchaseRecordInput): Promise<{
    balance: CreditBalance;
    ledgerEntry: CreditLedgerEntry;
    purchase: GooglePlayPurchaseRecord;
  }> {
    return this.prisma.$transaction(async tx => {
      const existingPurchase = await tx.googlePlayPurchase.findUnique({
        where: { purchaseToken: input.purchaseToken },
      });

      if (existingPurchase) {
        const [account, ledgerEntry] = await Promise.all([
          this.ensureAccount(existingPurchase.userId, tx),
          tx.creditLedgerEntry.findUniqueOrThrow({
            where: { id: existingPurchase.creditedLedgerEntryId },
          }),
        ]);

        return {
          balance: {
            userId: existingPurchase.userId,
            available: account.available,
          },
          ledgerEntry: this.toDomainLedgerEntry(ledgerEntry),
          purchase: this.toDomainGooglePlayPurchase(existingPurchase),
        };
      }

      await this.ensureAccount(input.userId, tx);
      const ledgerEntry = await tx.creditLedgerEntry.create({
        data: {
          id: createId('credit'),
          userId: input.userId,
          amount: input.credits,
          reason: 'google_play_credit_purchase',
          metadata: input.ledgerMetadata as Prisma.InputJsonValue,
        },
      });
      const [account, purchase] = await Promise.all([
        tx.creditAccount.update({
          where: { userId: input.userId },
          data: {
            available: {
              increment: input.credits,
            },
          },
        }),
        tx.googlePlayPurchase.create({
          data: {
            id: createId('gplay'),
            userId: input.userId,
            productId: input.productId,
            packageName: input.packageName,
            purchaseToken: input.purchaseToken,
            orderId: input.orderId,
            purchaseState: input.purchaseState,
            consumptionState: input.consumptionState,
            acknowledgementState: input.acknowledgementState,
            credits: input.credits,
            creditedLedgerEntryId: ledgerEntry.id,
            rawResponse: input.rawResponse as Prisma.InputJsonValue,
          },
        }),
      ]);

      return {
        balance: {
          userId: input.userId,
          available: account.available,
        },
        ledgerEntry: this.toDomainLedgerEntry(ledgerEntry),
        purchase: this.toDomainGooglePlayPurchase(purchase),
      };
    });
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

  private toDomainGooglePlayPurchase(
    purchase: PrismaGooglePlayPurchase,
  ): GooglePlayPurchaseRecord {
    return {
      id: purchase.id,
      userId: purchase.userId,
      productId: purchase.productId,
      packageName: purchase.packageName,
      purchaseToken: purchase.purchaseToken,
      orderId: purchase.orderId ?? undefined,
      purchaseState: purchase.purchaseState ?? undefined,
      consumptionState: purchase.consumptionState ?? undefined,
      acknowledgementState: purchase.acknowledgementState ?? undefined,
      credits: purchase.credits,
      creditedLedgerEntryId: purchase.creditedLedgerEntryId,
      createdAt: purchase.createdAt.toISOString(),
    };
  }
}
