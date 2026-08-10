import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { UPSERT_USER_FROM_AUTH_USE_CASE } from '../users/application/ports/in/upsert-user-from-auth.use-case';
import { AuthController } from './adapters/in/auth.controller';
import { LOGIN_WITH_GOOGLE_USE_CASE } from './application/ports/in/login-with-google.use-case';
import { GoogleLoginService } from './application/services/google-login.service';

@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [
    {
      provide: GoogleLoginService,
      useFactory: upsertUserFromAuthUseCase =>
        new GoogleLoginService(upsertUserFromAuthUseCase),
      inject: [UPSERT_USER_FROM_AUTH_USE_CASE],
    },
    {
      provide: LOGIN_WITH_GOOGLE_USE_CASE,
      useExisting: GoogleLoginService,
    },
  ],
})
export class AuthModule {}
