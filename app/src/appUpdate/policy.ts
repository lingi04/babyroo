import AsyncStorage from '@react-native-async-storage/async-storage';
import { BABYROO_API_BASE_URL } from '../api/babyrooApi';

export type AppPlatform = 'android' | 'ios';
export type AppPolicy = {
  minimumBuild: number;
  latestBuild: number;
  storeUrl: string;
  message: string;
};

export function parsePolicy(value: unknown, platform: AppPlatform): AppPolicy {
  const policy = value as Partial<AppPolicy> | null;
  if (
    !policy ||
    !Number.isSafeInteger(policy.minimumBuild) ||
    !Number.isSafeInteger(policy.latestBuild) ||
    policy.minimumBuild! < 0 ||
    policy.latestBuild! < policy.minimumBuild! ||
    typeof policy.storeUrl !== 'string' ||
    typeof policy.message !== 'string'
  ) {
    throw new Error('Invalid app policy');
  }
  const validStore =
    platform === 'android'
      ? /^https:\/\/play\.google\.com\/store\/apps\/details\?/.test(
          policy.storeUrl,
        )
      : /^https:\/\/apps\.apple\.com\/[^\s]+/.test(policy.storeUrl);
  if (policy.minimumBuild! > 0 && !validStore)
    throw new Error('Invalid store URL');
  return policy as AppPolicy;
}

const cacheKey = (platform: AppPlatform) =>
  `@babyroo/app-policy/v1/${platform}`;

export async function readCachedPolicy(
  platform: AppPlatform,
): Promise<AppPolicy | null> {
  try {
    const value = await AsyncStorage.getItem(cacheKey(platform));
    return value ? parsePolicy(JSON.parse(value), platform) : null;
  } catch {
    return null;
  }
}

export async function fetchPolicy(platform: AppPlatform): Promise<AppPolicy> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const policy = await Promise.race([
      (async () => {
        const response = await fetch(
          `${BABYROO_API_BASE_URL}/app-policy?platform=${platform}`,
          {
            signal: controller.signal,
            headers: { 'Cache-Control': 'no-cache' },
          },
        );
        if (!response.ok) throw new Error('App policy unavailable');
        return parsePolicy(await response.json(), platform);
      })(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error('App policy request timed out'));
          controller.abort();
        }, 5000);
      }),
    ]);
    // A storage failure must not discard a valid server policy.
    await AsyncStorage.setItem(
      cacheKey(platform),
      JSON.stringify(policy),
    ).catch(() => {});
    return policy;
  } finally {
    clearTimeout(timer);
  }
}
