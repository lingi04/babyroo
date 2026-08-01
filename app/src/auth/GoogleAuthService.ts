import { Platform } from 'react-native';
import {
  GoogleSignin,
  SignInSuccessResponse,
} from '@react-native-google-signin/google-signin';

import { AuthResult, AuthSession } from './types';

const GOOGLE_WEB_CLIENT_ID =
  '95021198008-jac42r8vpe99sk0ed5dnlr3e40fj5hna.apps.googleusercontent.com';

let configured = false;

export async function signInWithGoogle(): Promise<AuthResult> {
  configureGoogleSignIn();

  try {
    if (Platform.OS === 'android') {
      await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });
    }

    const response = await GoogleSignin.signIn();

    if (response.type === 'cancelled') {
      return { status: 'cancelled' };
    }

    return {
      status: 'success',
      session: googleUserToAuthSession(response.data),
    };
  } catch (error) {
    return googleErrorToAuthResult(error);
  }
}

export async function signOutFromGoogle(): Promise<void> {
  configureGoogleSignIn();
  await GoogleSignin.signOut().catch(() => null);
}

function configureGoogleSignIn() {
  if (configured) {
    return;
  }

  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
  });
  configured = true;
}

function googleUserToAuthSession(
  googleUser: SignInSuccessResponse['data'],
): AuthSession {
  return {
    provider: 'google',
    providerUserId: googleUser.user.id,
    email: googleUser.user.email,
    displayName: googleUser.user.name ?? '',
    photoUrl: googleUser.user.photo ?? undefined,
    idToken: googleUser.idToken ?? undefined,
  };
}

function googleErrorToAuthResult(error: unknown): AuthResult {
  const code =
    typeof error === 'object' && error && 'code' in error
      ? String(error.code)
      : 'unknown';

  if (code === 'SIGN_IN_CANCELLED') {
    return { status: 'cancelled' };
  }

  if (code === 'IN_PROGRESS') {
    return {
      status: 'failed',
      code: 'in_progress',
      message: '로그인이 이미 진행 중입니다.',
    };
  }

  if (code === 'PLAY_SERVICES_NOT_AVAILABLE') {
    return {
      status: 'failed',
      code: 'play_services_unavailable',
      message: 'Google Play 서비스를 사용할 수 없습니다.',
    };
  }

  return {
    status: 'failed',
    code: 'unknown',
    message: 'Google 로그인에 실패했습니다.',
  };
}
