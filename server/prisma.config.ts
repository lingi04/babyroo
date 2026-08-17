import { config as loadEnvFile } from 'dotenv';
import { defineConfig } from 'prisma/config';

loadEnvFile({ path: '.env.development.local' });
loadEnvFile({ path: '.env.local' });
loadEnvFile({ path: '.env' });

const fallbackDatabaseUrl = 'postgresql://babyroo:babyroo@localhost:5432/babyroo_dev';
const databaseUrl =
  process.env.DATABASE_URL ??
  process.env.babyroo_DATABASE_URL ??
  process.env.POSTGRES_PRISMA_URL ??
  process.env.babyroo_POSTGRES_PRISMA_URL ??
  process.env.POSTGRES_URL ??
  process.env.babyroo_POSTGRES_URL ??
  fallbackDatabaseUrl;

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: databaseUrl,
  },
});
