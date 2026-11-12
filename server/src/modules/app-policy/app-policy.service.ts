import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { getPrismaClient } from '../../common/prisma-client';

export type AppPolicyInput = {
  minimumBuild: number;
  latestBuild: number;
  storeUrl: string;
  message: string;
};

export function validatePlatform(platform: string): 'android' | 'ios' {
  if (platform !== 'android' && platform !== 'ios') {
    throw new BadRequestException('platform must be android or ios');
  }
  return platform;
}

export function validatePolicy(platform: string, input: AppPolicyInput): AppPolicyInput {
  validatePlatform(platform);
  if (!input || !Number.isInteger(input.minimumBuild) || input.minimumBuild < 0 ||
      input.minimumBuild > 2147483647 || !Number.isInteger(input.latestBuild) ||
      input.latestBuild < input.minimumBuild || input.latestBuild > 2147483647) {
    throw new BadRequestException('Builds must be nonnegative integers and latestBuild must be at least minimumBuild');
  }
  if (typeof input.storeUrl !== 'string' || typeof input.message !== 'string' ||
      !input.message.trim() || input.message.length > 2000 || input.storeUrl.length > 2048) {
    throw new BadRequestException('A store URL and nonempty message are required');
  }
  let validStore = false;
  try {
    const url = new URL(input.storeUrl);
    validStore = url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      (platform === 'android'
        ? url.hostname === 'play.google.com' && url.pathname === '/store/apps/details' && !!url.searchParams.get('id')
        : url.hostname === 'apps.apple.com' && url.pathname !== '/');
  } catch {}
  if ((input.storeUrl !== '' || input.minimumBuild > 0 || input.latestBuild > 0) && !validStore) {
    throw new BadRequestException('Use the platform HTTPS store URL before enabling updates');
  }
  return { minimumBuild: input.minimumBuild, latestBuild: input.latestBuild,
    storeUrl: input.storeUrl, message: input.message.trim() };
}

@Injectable()
export class AppPolicyService {
  async getPolicy(platform: string) {
    validatePlatform(platform);
    const policy = await getPrismaClient().appPolicy.findUnique({ where: { platform } });
    if (!policy) throw new ServiceUnavailableException('App policy is not configured');
    return { minimumBuild: policy.minimumBuild, latestBuild: policy.latestBuild,
      storeUrl: policy.storeUrl, message: policy.message };
  }

  list() {
    return getPrismaClient().appPolicy.findMany({ orderBy: { platform: 'asc' } });
  }

  update(platform: string, input: AppPolicyInput) {
    const data = validatePolicy(platform, input);
    return getPrismaClient().appPolicy.upsert({ where: { platform },
      create: { platform, ...data }, update: data });
  }
}
