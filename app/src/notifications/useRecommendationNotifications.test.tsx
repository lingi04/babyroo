import React from 'react';
import { Alert, AppState } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { deleteJson, postJson } from '../api/babyrooApi';
import { getPushClient } from './pushClient';
import { useRecommendationNotifications } from './useRecommendationNotifications';
import type { PushClient, PushMessage } from './types';

jest.mock('../api/babyrooApi', () => ({ postJson: jest.fn(), deleteJson: jest.fn() }));
jest.mock('./pushClient', () => ({ getPushClient: jest.fn() }));

const session = {
  provider: 'google' as const, providerUserId: 'google-1', email: 'a@example.com',
  displayName: 'Parent', apiAccessToken: 'access-1', apiUserId: 'user-1',
};
const message = (status = 'success', userId = 'user-1'): PushMessage => ({
  data: { type: 'recommendation_completed', sessionId: 'rec-1', userId, status },
});

let foreground: (value: PushMessage) => void;
let opened: (value: PushMessage) => void;
let refreshed: (value: string) => void;
let client: PushClient;
let root: ReactTestRenderer | undefined;
let unregister: () => Promise<void>;
const onOpen = jest.fn(async () => {});

function Harness() {
  unregister = useRecommendationNotifications(session, onOpen);
  return null;
}

async function mount() {
  await act(async () => { root = create(<Harness />); });
}

beforeEach(() => {
  jest.clearAllMocks();
  AppState.currentState = 'active';
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest.mocked(postJson).mockResolvedValue({});
  jest.mocked(deleteJson).mockResolvedValue(undefined);
  client = {
    provider: 'fcm',
    platform: 'android',
    requestPermission: jest.fn(async () => {}),
    getToken: jest.fn(async () => 'push-token'),
    deleteToken: jest.fn(async () => {}),
    onMessage: listener => { foreground = listener; return jest.fn(); },
    onOpened: listener => { opened = listener; return jest.fn(); },
    onTokenRefresh: listener => { refreshed = listener; return jest.fn(); },
    getInitialNotification: jest.fn(async () => null),
  };
  jest.mocked(getPushClient).mockReturnValue(client);
});

afterEach(async () => {
  await act(async () => root?.unmount());
  root = undefined;
  jest.restoreAllMocks();
});

test.each(['success', 'failed', 'timeout'])('foreground %s alerts once and opens saved outcome', async status => {
  await mount();
  foreground(message(status));
  foreground(message(status));
  foreground(message(status, 'different-user'));
  expect(Alert.alert).toHaveBeenCalledTimes(1);
  const buttons = jest.mocked(Alert.alert).mock.calls[0][2];
  await act(async () => { buttons?.[1].onPress?.(); });
  expect(onOpen).toHaveBeenCalledWith('rec-1');
});

test('background receipt produces no in-app alert; notification tap opens the result', async () => {
  await mount();
  AppState.currentState = 'background';
  foreground(message());
  expect(Alert.alert).not.toHaveBeenCalled();
  await act(async () => { opened(message()); });
  expect(onOpen).toHaveBeenCalledWith('rec-1');
});

test('cold-start notification opens after authenticated subscription', async () => {
  jest.mocked(client.getInitialNotification).mockResolvedValue(message('failed'));
  await mount();
  expect(onOpen).toHaveBeenCalledWith('rec-1');
});

test('registers device and refreshed token; logout revokes token and stops callbacks', async () => {
  await mount();
  expect(postJson).toHaveBeenCalledWith(expect.objectContaining({
    accessToken: 'access-1', body: expect.objectContaining({ token: 'push-token', platform: 'android' }),
  }));
  await act(async () => { refreshed('rotated-token'); });
  expect(postJson).toHaveBeenLastCalledWith(expect.objectContaining({
    body: expect.objectContaining({ token: 'rotated-token' }),
  }));
  await act(async () => { await unregister(); });
  expect(deleteJson).toHaveBeenCalledWith(expect.objectContaining({ accessToken: 'access-1' }));
  expect(client.deleteToken).toHaveBeenCalled();
  foreground(message());
  opened(message());
  expect(Alert.alert).not.toHaveBeenCalled();
  expect(onOpen).not.toHaveBeenCalled();
});

test('foreground registration still runs if the permission request fails', async () => {
  jest.mocked(client.requestPermission).mockRejectedValue(new Error('permission unavailable'));
  await mount();
  expect(postJson).toHaveBeenCalled();
});

test('unconfigured platforms do not register a device', async () => {
  jest.mocked(getPushClient).mockReturnValue(null);
  await mount();
  expect(postJson).not.toHaveBeenCalled();
});


test('replacement client registers its provider and uses the same foreground flow', async () => {
  jest.mocked(getPushClient).mockReturnValue({ ...client, provider: 'other' });
  await mount();
  expect(postJson).toHaveBeenCalledWith(expect.objectContaining({
    body: expect.objectContaining({ provider: 'other' }),
  }));
  foreground(message('failed'));
  expect(Alert.alert).toHaveBeenCalledTimes(1);
});
