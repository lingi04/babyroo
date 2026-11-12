import { Module } from '@nestjs/common';
import { AppPolicyController } from './app-policy.controller';
import { AppPolicyService } from './app-policy.service';

@Module({ controllers: [AppPolicyController], providers: [AppPolicyService], exports: [AppPolicyService] })
export class AppPolicyModule {}
