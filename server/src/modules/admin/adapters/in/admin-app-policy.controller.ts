import { Body, Controller, Get, Header, Param, Put, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from '../../../../common/admin-auth.guard';
import { AppPolicyInput, AppPolicyService } from '../../../app-policy/app-policy.service';

@Controller('admin/app-policies')
@UseGuards(AdminAuthGuard)
export class AdminAppPolicyController {
  constructor(private readonly policies: AppPolicyService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  list() { return this.policies.list(); }

  @Put(':platform')
  update(@Param('platform') platform: string, @Body() input: AppPolicyInput) {
    return this.policies.update(platform, input);
  }
}
