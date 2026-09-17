import { useEffect, useRef } from 'react';
import { Alert, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { deleteJson, postJson } from '../api/babyrooApi';
import type { AuthSession } from '../auth/types';
import { getPushClient } from './pushClient';
import { recommendationFromPush, type PushMessage } from './types';

const INSTALLATION_KEY = 'babyroo.pushInstallationId';
let registrationQueue: Promise<unknown> = Promise.resolve();

function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const next = registrationQueue.then(operation, operation);
  registrationQueue = next.catch(() => undefined);
  return next;
}

async function installationId(): Promise<string> {
  const existing = await AsyncStorage.getItem(INSTALLATION_KEY);
  if (existing) return existing;
  const id = `push_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
  await AsyncStorage.setItem(INSTALLATION_KEY, id);
  return id;
}

export function useRecommendationNotifications(
  session: AuthSession | null,
  onOpen: (sessionId: string) => Promise<void>,
) {
  const openRef = useRef(onOpen);
  openRef.current = onOpen;
  const stopRef = useRef<() => void>(() => {});
  const accessToken = session?.apiAccessToken;
  const userId = session?.apiUserId;

  useEffect(() => {
    if (!accessToken || !userId) return;
    const client = getPushClient();
    if (!client) return;
    let active = true;
    const seen = new Set<string>();
    const open = (message: PushMessage) => {
      const completion = recommendationFromPush(message, userId);
      if (!active || !completion) return;
      openRef.current(completion.sessionId).catch(() => {
        if (active) Alert.alert('결과를 불러오지 못했어요', '잠시 후 홈에서 다시 확인해 주세요.');
      });
    };
    const register = (token?: string) => enqueue(async () => {
      if (!active) return;
      const pushToken = token ?? await client.getToken();
      const id = await installationId();
      if (!active) return;
      await postJson({ accessToken, path: '/users/me/push-devices', body: {
        installationId: id, token: pushToken, platform: client.platform, provider: client.provider,
      } });
    }).catch(() => console.warn('[Babyroo] Push registration failed; will retry on app resume.'));

    const unsubscribeMessage = client.onMessage(message => {
      const completion = recommendationFromPush(message, userId);
      if (!active || AppState.currentState !== 'active' || !completion || seen.has(completion.sessionId)) return;
      seen.add(completion.sessionId);
      if (seen.size > 100) seen.delete(seen.values().next().value!);
      Alert.alert(
        message.notification?.title ?? '추천 요청이 완료됐어요',
        message.notification?.body ?? '앱에서 처리 결과를 확인해 주세요.',
        [{ text: '닫기', style: 'cancel' }, { text: '결과 보기', onPress: () => open(message) }],
      );
    });
    const unsubscribeOpened = client.onOpened(open);
    const unsubscribeToken = client.onTokenRefresh(token => { register(token); });
    const appState = AppState.addEventListener('change', state => {
      if (state === 'active') register();
    });
    // Permission denial prevents system banners, but foreground messages still work.
    client.requestPermission().catch(() => undefined).then(() => register());
    client.getInitialNotification().then(message => {
      if (message) open(message);
    }).catch(() => undefined);

    const stop = () => {
      active = false;
      unsubscribeMessage();
      unsubscribeOpened();
      unsubscribeToken();
      appState.remove();
    };
    stopRef.current = stop;
    return stop;
  }, [accessToken, userId]);

  return async function unregisterNotifications() {
    stopRef.current();
    await enqueue(async () => {
      const id = await AsyncStorage.getItem(INSTALLATION_KEY);
      // Revoke the provider token too, so a failed API call cannot keep sending
      // notifications to this installation after logout.
      const results = await Promise.allSettled([
        accessToken && id ? deleteJson({ accessToken, path: `/users/me/push-devices/${encodeURIComponent(id)}` }) : Promise.resolve(),
        getPushClient()?.deleteToken() ?? Promise.resolve(),
      ]);
      if (results.some(result => result.status === 'rejected')) {
        console.warn('[Babyroo] Push cleanup could not be fully completed.');
      }
    });
  };
}
