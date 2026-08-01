import {
  clearAuthSession,
  loadAuthSession,
  saveAuthSession,
} from './authStorage';
import { AuthSession } from '../auth/types';

const authSession: AuthSession = {
  provider: 'google',
  providerUserId: 'google-user-001',
  email: 'parent@example.com',
  displayName: 'Google Parent',
  photoUrl: 'https://example.com/avatar.png',
  idToken: 'id-token',
};

afterEach(async () => {
  await clearAuthSession();
});

test('loads a previously saved auth session', async () => {
  await saveAuthSession(authSession);

  await expect(loadAuthSession()).resolves.toEqual(authSession);
});

test('returns null when auth session is cleared', async () => {
  await saveAuthSession(authSession);
  await clearAuthSession();

  await expect(loadAuthSession()).resolves.toBeNull();
});
