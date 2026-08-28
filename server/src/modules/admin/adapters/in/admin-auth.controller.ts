import { Body, Controller, Post } from '@nestjs/common';
import { AdminAuthService } from '../../application/services/admin-auth.service';

export type AdminGoogleLoginInput = {
  idToken: string;
};

@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  @Post('google')
  loginWithGoogle(@Body() body: AdminGoogleLoginInput) {
    return this.adminAuthService.loginWithGoogle(body);
  }
}
