export type GoogleLoginInput = {
  idToken: string;
  displayName?: string;
};

export type LoginWithGoogleResult = {
  accessToken: string;
  tokenType: 'Bearer';
  user: unknown;
  capabilities?: {
    admin: boolean;
  };
};

export const LOGIN_WITH_GOOGLE_USE_CASE = Symbol('LOGIN_WITH_GOOGLE_USE_CASE');

export interface LoginWithGoogleUseCase {
  loginWithGoogle(input: GoogleLoginInput): Promise<LoginWithGoogleResult>;
}
