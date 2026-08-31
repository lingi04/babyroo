import { UnauthorizedException } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';

const DEFAULT_GOOGLE_WEB_CLIENT_ID =
  '384711875273-t4j7j84mogouapmqkicp4ucqdvcv0pau.apps.googleusercontent.com';

export type VerifiedGoogleIdentity = {
  sub: string;
  email: string;
  emailVerified: boolean;
  displayName?: string;
};

const googleClient = new OAuth2Client();

export async function verifyGoogleIdToken(
  idToken: string,
): Promise<VerifiedGoogleIdentity> {
  const audience =
    process.env.GOOGLE_WEB_CLIENT_ID ??
    process.env.GOOGLE_CLIENT_ID ??
    DEFAULT_GOOGLE_WEB_CLIENT_ID;

  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience,
  });
  const payload = ticket.getPayload();

  if (!payload?.sub || !payload.email) {
    throw new UnauthorizedException('Invalid Google identity');
  }
  if (payload.email_verified !== true) {
    throw new UnauthorizedException('Google email is not verified');
  }

  return {
    sub: payload.sub,
    email: payload.email.toLowerCase(),
    emailVerified: payload.email_verified === true,
    displayName: payload.name,
  };
}
