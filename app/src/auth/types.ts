export type AuthProvider = 'google';

export type AuthSession = {
  provider: AuthProvider;
  providerUserId: string;
  email: string;
  displayName: string;
  photoUrl?: string;
  idToken?: string;
};

export type AuthErrorCode =
  | 'cancelled'
  | 'play_services_unavailable'
  | 'in_progress'
  | 'unknown';

export type AuthResult =
  | {
      status: 'success';
      session: AuthSession;
    }
  | {
      status: 'cancelled';
    }
  | {
      status: 'failed';
      code: AuthErrorCode;
      message: string;
    };
