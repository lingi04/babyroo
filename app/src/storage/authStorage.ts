import AsyncStorage from '@react-native-async-storage/async-storage';

import { AuthSession } from '../auth/types';

const AUTH_SESSION_STORAGE_KEY = '@babyroo/auth-session';

export async function loadAuthSession(): Promise<AuthSession | null> {
  const rawSession = await AsyncStorage.getItem(AUTH_SESSION_STORAGE_KEY);

  if (!rawSession) {
    return null;
  }

  try {
    return normalizeAuthSession(JSON.parse(rawSession) as AuthSession);
  } catch {
    return null;
  }
}

export async function saveAuthSession(session: AuthSession): Promise<void> {
  await AsyncStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
}

export async function clearAuthSession(): Promise<void> {
  await AsyncStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
}

function normalizeAuthSession(session: AuthSession): AuthSession {
  return {
    provider: session.provider,
    providerUserId: session.providerUserId,
    email: session.email,
    displayName: session.displayName ?? '',
    photoUrl: session.photoUrl,
    idToken: session.idToken,
  };
}
