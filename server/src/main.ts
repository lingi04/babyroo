import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ApplicationErrorFilter } from './common/application-error.filter';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.useGlobalFilters(new ApplicationErrorFilter());
  app.setGlobalPrefix('api');
  await app.listen(process.env.PORT ?? 3000, process.env.HOST ?? '127.0.0.1');
}

void bootstrap();
