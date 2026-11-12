import { Controller, Get, Header, Query } from '@nestjs/common';
import { AppPolicyService } from './app-policy.service';

@Controller('app-policy')
export class AppPolicyController {
  constructor(private readonly policies: AppPolicyService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  getPolicy(@Query('platform') platform: string) {
    return this.policies.getPolicy(platform);
  }
}
