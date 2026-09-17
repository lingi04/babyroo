import { getApps } from '@react-native-firebase/app';
import {
  deleteToken, getInitialNotification, getMessaging, getToken, onMessage,
  onNotificationOpenedApp, onTokenRefresh, setBackgroundMessageHandler,
} from '@react-native-firebase/messaging';
import { PermissionsAndroid, Platform } from 'react-native';
import type { PushClient } from './types';

export function getPushClient(): PushClient | null {
  if (!getApps().length) return null;
  const messaging = getMessaging();
  return {
    provider: 'fcm',
    platform: 'android',
    async requestPermission() {
      if (Number(Platform.Version) >= 33) {
        await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      }
    },
    getToken: () => getToken(messaging),
    deleteToken: () => deleteToken(messaging),
    onTokenRefresh: listener => onTokenRefresh(messaging, listener),
    onMessage: listener => onMessage(messaging, listener),
    onOpened: listener => onNotificationOpenedApp(messaging, listener),
    getInitialNotification: () => getInitialNotification(messaging),
  };
}

export function registerBackgroundPushHandler() {
  if (!getApps().length) return;
  // FCM displays the notification payload. Do not display a second alert here.
  setBackgroundMessageHandler(getMessaging(), async () => {});
}
