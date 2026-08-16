import { config as loadEnvFile } from 'dotenv';

loadEnvFile({ path: '.env.development.local' });
loadEnvFile({ path: '.env.local' });
loadEnvFile({ path: '.env' });
