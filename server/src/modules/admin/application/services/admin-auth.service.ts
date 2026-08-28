import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaNeon } from '@prisma/adapter-neon';
import { issueAuthToken } from '../../../../common/auth-token';
import { getDatabaseUrl } from '../../../../common/database-url';
import { debugLog } from '../../../../common/debug-log';
import { verifyGoogleIdToken } from '../../../../common/google-id-token';
import { PrismaClient } from '../../../../generated/prisma/client';
import type { AdminGoogleLoginInput } from '../../adapters/in/admin-auth.controller';

@Injectable()
export class AdminAuthService {
  private readonly prisma = new PrismaClient({
    adapter: new PrismaNeon({
      connectionString: getDatabaseUrl() ?? '',
    }),
  });

  async loginWithGoogle(input: AdminGoogleLoginInput) {
    const googleIdentity = await verifyGoogleIdToken(input.idToken);
    debugLog('admin.auth.google.login.start', {
      email: googleIdentity.email,
    });

    const adminUser = await this.prisma.adminUser.findUnique({
      where: { email: googleIdentity.email },
    });

    if (!adminUser || !adminUser.active) {
      debugLog('admin.auth.google.login.forbidden', {
        email: googleIdentity.email,
        reason: adminUser ? 'inactive' : 'missing_admin_user',
      });
      throw new ForbiddenException('Admin access denied');
    }

    if (adminUser.googleSub && adminUser.googleSub !== googleIdentity.sub) {
      debugLog('admin.auth.google.login.googleSubMismatch', {
        adminUserId: adminUser.id,
        email: googleIdentity.email,
      });
      throw new ForbiddenException('Admin access denied');
    }

    const updatedAdminUser = await this.prisma.adminUser.update({
      where: { id: adminUser.id },
      data: {
        googleSub: adminUser.googleSub ?? googleIdentity.sub,
        displayName: googleIdentity.displayName ?? adminUser.displayName,
      },
    });

    debugLog('admin.auth.google.login.success', {
      adminUserId: updatedAdminUser.id,
      email: updatedAdminUser.email,
    });

    return {
      accessToken: issueAuthToken({
        sub: updatedAdminUser.id,
        kind: 'admin',
        email: updatedAdminUser.email,
      }),
      tokenType: 'Bearer' as const,
      adminUser: {
        id: updatedAdminUser.id,
        email: updatedAdminUser.email,
        displayName: updatedAdminUser.displayName,
      },
    };
  }
}
