import { createHmac, timingSafeEqual } from 'crypto';
import { UnauthorizedException } from '@nestjs/common';

export type AuthTokenKind = 'user' | 'admin';

export type AuthTokenPayload = {
  sub: string;
  kind: AuthTokenKind;
  email?: string;
  exp: number;
  iat: number;
};

const DEFAULT_EXPIRES_IN = '7d';

export function issueAuthToken(input: {
  sub: string;
  kind: AuthTokenKind;
  email?: string;
}): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: AuthTokenPayload = {
    sub: input.sub,
    kind: input.kind,
    email: input.email,
    iat: now,
    exp: now + parseExpiresIn(process.env.AUTH_JWT_EXPIRES_IN ?? DEFAULT_EXPIRES_IN),
  };

  return signJwt(payload);
}

export function verifyAuthToken(token: string): AuthTokenPayload {
  const [encodedHeader, encodedPayload, signature] = token.split('.');
  if (!encodedHeader || !encodedPayload || !signature) {
    throw new UnauthorizedException('Invalid bearer token');
  }

  const expectedSignature = sign(`${encodedHeader}.${encodedPayload}`);
  if (!timingSafeEqualString(signature, expectedSignature)) {
    throw new UnauthorizedException('Invalid bearer token');
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload)) as Partial<AuthTokenPayload>;
  if (!payload.sub || !payload.kind || !payload.exp || !payload.iat) {
    throw new UnauthorizedException('Invalid bearer token');
  }
  if (payload.kind !== 'user' && payload.kind !== 'admin') {
    throw new UnauthorizedException('Invalid bearer token');
  }
  if (payload.exp <= Math.floor(Date.now() / 1000)) {
    throw new UnauthorizedException('Expired bearer token');
  }

  return payload as AuthTokenPayload;
}

function signJwt(payload: AuthTokenPayload): string {
  const encodedHeader = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(`${encodedHeader}.${encodedPayload}`);

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function sign(value: string): string {
  const secret = process.env.AUTH_JWT_SECRET;
  if (!secret) {
    throw new Error('AUTH_JWT_SECRET is required');
  }

  return createHmac('sha256', secret).update(value).digest('base64url');
}

function timingSafeEqualString(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value).toString('base64url');
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function parseExpiresIn(value: string): number {
  const match = /^(\d+)([dhms])?$/.exec(value.trim());
  if (!match) {
    throw new Error('AUTH_JWT_EXPIRES_IN must look like 7d, 12h, 30m, or 60s');
  }

  const amount = Number(match[1]);
  const unit = match[2] ?? 's';
  const multipliers = {
    d: 24 * 60 * 60,
    h: 60 * 60,
    m: 60,
    s: 1,
  };

  return amount * multipliers[unit as keyof typeof multipliers];
}
