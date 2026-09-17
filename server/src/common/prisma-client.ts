import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '../generated/prisma/client';
import { getDatabaseUrl } from './database-url';

const globalForPrisma = globalThis as typeof globalThis & {
  babyrooPrismaClient?: PrismaClient;
};

export function getPrismaClient() {
  if (!globalForPrisma.babyrooPrismaClient) {
    globalForPrisma.babyrooPrismaClient = new PrismaClient({
      adapter: new PrismaNeon({
        connectionString: getDatabaseUrl() ?? '',
      }),
    });
  }

  return globalForPrisma.babyrooPrismaClient;
}
