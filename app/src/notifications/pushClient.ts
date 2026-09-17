import type { PushClient } from './types';

// Add pushClient.ios.ts when the iOS app has Firebase/APNs configuration.
export function getPushClient(): PushClient | null {
  return null;
}

export function registerBackgroundPushHandler(): void {}
