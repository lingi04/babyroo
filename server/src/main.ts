import './common/load-env';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ApplicationErrorFilter } from './common/application-error.filter';
import { AppModule } from './app.module';
import { debugLog } from './common/debug-log';
import { requestLogger } from './common/request-logger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.use(requestLogger);
  app.useGlobalFilters(new ApplicationErrorFilter());
  app.setGlobalPrefix('api');
  const port = process.env.PORT ?? 3000;
  const host = process.env.HOST ?? '127.0.0.1';

  await app.listen(port, host);
  debugLog('server.started', {
    host,
    port,
    debugLogs: process.env.BABYROO_DEBUG_LOGS ?? 'default-on',
  });
}

void bootstrap();
