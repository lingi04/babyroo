const databaseUrlEnvNames = [
  'DATABASE_URL',
  'babyroo_DATABASE_URL',
  'POSTGRES_PRISMA_URL',
  'babyroo_POSTGRES_PRISMA_URL',
  'POSTGRES_URL',
  'babyroo_POSTGRES_URL',
] as const;

export function getDatabaseUrl(): string | undefined {
  return databaseUrlEnvNames
    .map(name => process.env[name])
    .find((value): value is string => Boolean(value));
}
