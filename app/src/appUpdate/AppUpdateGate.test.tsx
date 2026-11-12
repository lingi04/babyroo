import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import {
  AppState,
  AppStateStatus,
  Linking,
  Platform,
  Text,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppUpdateGate } from './AppUpdateGate';
import {
  AppPolicy,
  fetchPolicy,
  parsePolicy,
  readCachedPolicy,
} from './policy';

const policy: AppPolicy = {
  minimumBuild: 26,
  latestBuild: 28,
  storeUrl: 'https://play.google.com/store/apps/details?id=com.babyroo',
  message: 'Please update',
};
let renderer: Renderer.ReactTestRenderer;
const originalFetch = global.fetch;
let foreground: (state: AppStateStatus) => void;
beforeEach(async () => {
  await AsyncStorage.clear();
  jest.replaceProperty(Platform, 'OS', 'android');
  global.fetch = jest
    .fn()
    .mockResolvedValue({ ok: true, json: async () => policy });
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_event, listener) => {
      foreground = listener;
      return { remove: jest.fn() };
    });
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  jest.restoreAllMocks();
  jest.useRealTimers();
  global.fetch = originalFetch;
});
async function mount(build = '25') {
  await act(async () => {
    renderer = Renderer.create(
      <AppUpdateGate nativeBuild={build}>
        <Text>Main app</Text>
      </AppUpdateGate>,
    );
  });
}
it('blocks old builds without mounting app content and opens store', async () => {
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  await mount();
  expect(renderer.root.findAllByProps({ children: 'Main app' })).toHaveLength(
    0,
  );
  await act(async () =>
    renderer.root
      .findByProps({ accessibilityLabel: 'Update Babyroo' })
      .props.onPress(),
  );
  expect(open).toHaveBeenCalledWith(policy.storeUrl);
});
it.each(['26', '29'])('allows supported build %s', async build => {
  await mount(build);
  expect(renderer.root.findByProps({ children: 'Main app' })).toBeTruthy();
});
it('allows offline first launch without cached policy', async () => {
  jest.mocked(fetch).mockRejectedValue(new Error('offline'));
  await mount();
  expect(renderer.root.findByProps({ children: 'Main app' })).toBeTruthy();
});
it('preserves cached block offline and accepts rollback on foreground', async () => {
  await AsyncStorage.setItem(
    '@babyroo/app-policy/v1/android',
    JSON.stringify(policy),
  );
  jest.mocked(fetch).mockRejectedValue(new Error('offline'));
  await mount();
  expect(
    renderer.root.findByProps({ accessibilityLabel: 'Update Babyroo' }),
  ).toBeTruthy();
  jest.mocked(fetch).mockResolvedValue({
    ok: true,
    json: async () => ({ ...policy, minimumBuild: 0 }),
  } as Response);
  await act(async () => foreground('active'));
  expect(renderer.root.findByProps({ children: 'Main app' })).toBeTruthy();
});
it('blocks running app when minimum is raised', async () => {
  await mount('26');
  jest.mocked(fetch).mockResolvedValue({
    ok: true,
    json: async () => ({ ...policy, minimumBuild: 27 }),
  } as Response);
  await act(async () => foreground('active'));
  expect(renderer.root.findAllByProps({ children: 'Main app' })).toHaveLength(
    0,
  );
});
it('does not allow missing native metadata to bypass gate', async () => {
  await mount('');
  expect(renderer.root.findAllByProps({ children: 'Main app' })).toHaveLength(
    0,
  );
  expect(fetch).not.toHaveBeenCalled();
});
it('reports store errors without allowing access', async () => {
  jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('unavailable'));
  await mount();
  await act(async () =>
    renderer.root
      .findByProps({ accessibilityLabel: 'Update Babyroo' })
      .props.onPress(),
  );
  expect(
    renderer.root.findByProps({ accessibilityRole: 'alert' }),
  ).toBeTruthy();
});
it('validates cache and separates platforms', async () => {
  await AsyncStorage.setItem('@babyroo/app-policy/v1/android', 'broken');
  expect(await readCachedPolicy('android')).toBeNull();
  await AsyncStorage.setItem(
    '@babyroo/app-policy/v1/android',
    JSON.stringify(policy),
  );
  expect(await readCachedPolicy('ios')).toBeNull();
  expect(() =>
    parsePolicy(
      {
        ...policy,
        storeUrl: 'https://play.google.com.evil.test/store/apps/details?id=x',
      },
      'android',
    ),
  ).toThrow();
  expect(() =>
    parsePolicy({ ...policy, minimumBuild: '26' }, 'android'),
  ).toThrow();
});
it('bounds stalled policy request', async () => {
  jest.useFakeTimers();
  jest.mocked(fetch).mockImplementation(() => new Promise(() => {}));
  const result = fetchPolicy('android').catch((error: Error) => error);
  await jest.advanceTimersByTimeAsync(5000);
  expect(await result).toEqual(new Error('App policy request timed out'));
});

it('uses a separate iOS policy with the native iOS build', async () => {
  jest.replaceProperty(Platform, 'OS', 'ios');
  jest.mocked(fetch).mockResolvedValue({
    ok: true,
    json: async () => ({
      ...policy,
      minimumBuild: 2,
      latestBuild: 2,
      storeUrl: 'https://apps.apple.com/kr/app/id123456789',
    }),
  } as Response);
  await mount('1');
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining('platform=ios'),
    expect.anything(),
  );
  expect(
    renderer.root.findByProps({ accessibilityLabel: 'Update Babyroo' }),
  ).toBeTruthy();
});
it('keeps a valid remote block even when saving the cache fails', async () => {
  jest
    .spyOn(AsyncStorage, 'setItem')
    .mockRejectedValueOnce(new Error('storage unavailable'));
  await mount();
  expect(
    renderer.root.findByProps({ accessibilityLabel: 'Update Babyroo' }),
  ).toBeTruthy();
});
it('does not replace a cached block with an invalid server response', async () => {
  await AsyncStorage.setItem(
    '@babyroo/app-policy/v1/android',
    JSON.stringify(policy),
  );
  jest.mocked(fetch).mockResolvedValue({
    ok: true,
    json: async () => ({ minimumBuild: '0' }),
  } as Response);
  await mount();
  expect(
    renderer.root.findByProps({ accessibilityLabel: 'Update Babyroo' }),
  ).toBeTruthy();
  expect(await readCachedPolicy('android')).toEqual(policy);
});
it('manual retry accepts a newly supported policy', async () => {
  await mount();
  jest.mocked(fetch).mockResolvedValue({
    ok: true,
    json: async () => ({ ...policy, minimumBuild: 25 }),
  } as Response);
  await act(async () =>
    renderer.root
      .findByProps({ accessibilityLabel: 'Retry version check' })
      .props.onPress(),
  );
  expect(renderer.root.findByProps({ children: 'Main app' })).toBeTruthy();
});
