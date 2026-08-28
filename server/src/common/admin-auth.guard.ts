import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { verifyAuthToken } from './auth-token';

@Injectable()
export class AdminAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: { id: string; kind: 'admin'; email?: string };
    }>();
    const header = request.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;

    if (!token) {
      throw new UnauthorizedException('Missing or invalid bearer token');
    }

    const payload = verifyAuthToken(token);
    if (payload.kind !== 'admin') {
      throw new UnauthorizedException('Admin bearer token required');
    }

    request.user = {
      id: payload.sub,
      kind: payload.kind,
      email: payload.email,
    };
    return true;
  }
}
