import { Body, Controller, Inject, Post } from '@nestjs/common';
import {
  GoogleLoginInput,
  LOGIN_WITH_GOOGLE_USE_CASE,
  LoginWithGoogleUseCase,
} from '../../application/ports/in/login-with-google.use-case';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(LOGIN_WITH_GOOGLE_USE_CASE)
    private readonly loginWithGoogleUseCase: LoginWithGoogleUseCase,
  ) {}

  @Post('google')
  loginWithGoogle(@Body() body: GoogleLoginInput) {
    return this.loginWithGoogleUseCase.loginWithGoogle(body);
  }
}
