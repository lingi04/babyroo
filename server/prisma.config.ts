import { config as loadEnvFile } from 'dotenv';
import { defineConfig } from 'prisma/config';

loadEnvFile({ path: '.env.development.local' });
loadEnvFile({ path: '.env.local' });
loadEnvFile({ path: '.env' });

const fallbackDatabaseUrl = 'postgresql://babyroo:babyroo@localhost:5432/babyroo_dev';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? fallbackDatabaseUrl,
  },
});
