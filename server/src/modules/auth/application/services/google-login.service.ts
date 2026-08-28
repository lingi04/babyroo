import {
  UPSERT_USER_FROM_AUTH_USE_CASE,
  UpsertUserFromAuthUseCase,
} from '../../../users/application/ports/in/upsert-user-from-auth.use-case';
import { issueAuthToken } from '../../../../common/auth-token';
import { debugLog } from '../../../../common/debug-log';
import { verifyGoogleIdToken } from '../../../../common/google-id-token';
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
    const googleIdentity = await verifyGoogleIdToken(input.idToken);
    const userId = this.toUserId(googleIdentity.sub);
    debugLog('auth.google.login.start', {
      userId,
      email: googleIdentity.email,
      hasDisplayName: Boolean(input.displayName ?? googleIdentity.displayName),
    });
    const user = await this.upsertUserFromAuthUseCase.upsertFromAuth(
      userId,
      input.displayName ?? googleIdentity.displayName,
    );
    debugLog('auth.google.login.success', {
      userId: user.id,
    });

    return {
      accessToken: issueAuthToken({
        sub: user.id,
        kind: 'user',
        email: googleIdentity.email,
      }),
      tokenType: 'Bearer',
      user,
      capabilities: {
        admin: false,
      },
    };
  }

  private toUserId(googleSub: string): string {
    return `google_${googleSub}`;
  }
}
