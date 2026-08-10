import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: { id: string };
    }>();
    const header = request.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;

    if (!token?.startsWith('dev.')) {
      throw new UnauthorizedException('Missing or invalid bearer token');
    }

    const userId = token.slice(4);
    if (!userId) {
      throw new UnauthorizedException('Missing user id');
    }

    request.user = { id: userId };
    return true;
  }
}

