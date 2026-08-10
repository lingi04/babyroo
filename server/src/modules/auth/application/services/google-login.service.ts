import {
  UPSERT_USER_FROM_AUTH_USE_CASE,
  UpsertUserFromAuthUseCase,
} from '../../../users/application/ports/in/upsert-user-from-auth.use-case';
import {
  GoogleLoginInput,
  LoginWithGoogleUseCase,
  LoginWithGoogleResult,
} from '../ports/in/login-with-google.use-case';

export class GoogleLoginService implements LoginWithGoogleUseCase {
  constructor(
    private readonly upsertUserFromAuthUseCase: UpsertUserFromAuthUseCase,
  ) {}

  async loginWithGoogle(input: GoogleLoginInput): Promise<LoginWithGoogleResult> {
    const userId = this.toDevelopmentUserId(input.idToken);
    const user = await this.upsertUserFromAuthUseCase.upsertFromAuth(
      userId,
      input.displayName,
    );

    return {
      accessToken: `dev.${user.id}`,
      tokenType: 'Bearer',
      user,
    };
  }

  private toDevelopmentUserId(idToken: string): string {
    return `google_${Buffer.from(idToken).toString('base64url').slice(0, 24)}`;
  }
}
