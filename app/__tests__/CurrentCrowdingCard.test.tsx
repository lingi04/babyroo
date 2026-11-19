import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text } from 'react-native';
import { CurrentCrowdingCard } from '../src/crowding/CurrentCrowdingCard';
import { getCurrentCrowdingFromBabyrooApi } from '../src/api/babyrooApi';
import type { CurrentCrowding } from '../src/crowding/types';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

jest.mock('../src/api/babyrooApi', () => ({
  getCurrentCrowdingFromBabyrooApi: jest.fn(),
}));
const read = jest.mocked(getCurrentCrowdingFromBabyrooApi);
const area = { id: 'POI001', name: '광화문·덕수궁', revision: 'mapping-1' };
const observation: CurrentCrowding = {
  supported: true,
  area,
  serverNow: '2026-11-18T05:35:00Z',
  level: '여유',
  observedAt: '2026-11-18T05:30:00Z',
  lastSuccessAt: '2026-11-18T05:35:00Z',
  state: 'current',
  refreshFailed: false,
  quality: 'N',
  attribution: {
    name: '서울특별시 공공데이터',
    url: 'https://data.seoul.go.kr/',
  },
};
const props = { eventId: 'event-1', area, onSignIn: jest.fn(async () => {}) };
const labels = (renderer: ReactTestRenderer.ReactTestRenderer) =>
  renderer.root
    .findAllByType(Text)
    .map(node => node.props.children)
    .flat()
    .join(' ');
function capture(name: string, renderer: ReactTestRenderer.ReactTestRenderer) {
  const dir = process.env.BABYROO_CROWDING_PREVIEW_DIR;
  if (dir)
    writeFileSync(join(dir, name + '.json'), JSON.stringify(renderer.toJSON()));
}
beforeEach(() => {
  read.mockReset();
  props.onSignIn.mockClear();
});

test('guest sees login entry without fetching or showing crowding data', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<CurrentCrowdingCard {...props} />);
  });
  expect(read).not.toHaveBeenCalled();
  capture('guest', renderer!);
  expect(labels(renderer!)).not.toContain('여유');
  await ReactTestRenderer.act(async () => {
    await renderer!.root
      .findByProps({ accessibilityLabel: '로그인하고 주변 혼잡도 확인' })
      .props.onPress();
  });
  expect(props.onSignIn).toHaveBeenCalledTimes(1);
  await ReactTestRenderer.act(() => renderer!.unmount());
});

test('signed-in user sees current condition directly without unlock/history/payment controls', async () => {
  read.mockResolvedValue(observation);
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <CurrentCrowdingCard {...props} accessToken="user-1" />,
    );
  });
  expect(read).toHaveBeenCalledWith('event-1', 'user-1');
  const content = labels(renderer!);
  capture('current', renderer!);
  expect(content).toContain('현재 혼잡도');
  expect(content).toContain('여유');
  expect(content).not.toMatch(/크레딧|24시간|기록 보기|어제/);
  await ReactTestRenderer.act(() => renderer!.unmount());
});

test('logout clears visible readings immediately and ignores the prior request', async () => {
  let resolve!: (value: CurrentCrowding) => void;
  read.mockReturnValue(
    new Promise(done => {
      resolve = done;
    }),
  );
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <CurrentCrowdingCard {...props} accessToken="user-1" />,
    );
  });
  await ReactTestRenderer.act(() => {
    renderer!.update(<CurrentCrowdingCard {...props} />);
  });
  await ReactTestRenderer.act(async () => {
    resolve(observation);
  });
  expect(labels(renderer!)).not.toContain('여유');
  expect(labels(renderer!)).toContain('로그인하고 확인');
  await ReactTestRenderer.act(() => renderer!.unmount());
});

test('expired authentication clears the reading and offers login again', async () => {
  read.mockResolvedValueOnce(observation);
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <CurrentCrowdingCard {...props} accessToken="expired" />,
    );
  });
  read.mockRejectedValueOnce({ statusCode: 401 });
  await ReactTestRenderer.act(async () => {
    renderer!.root
      .findByProps({ accessibilityLabel: '주변 혼잡도 새로고침' })
      .props.onPress();
  });
  expect(labels(renderer!)).not.toContain('여유');
  expect(labels(renderer!)).toContain('로그인하고 확인');
  await ReactTestRenderer.act(() => renderer!.unmount());
});

test('old venue responses cannot overwrite the newly selected venue', async () => {
  let resolveOld!: (value: CurrentCrowding) => void;
  read.mockReturnValueOnce(
    new Promise(done => {
      resolveOld = done;
    }),
  );
  const nextArea = { id: 'POI002', name: '경복궁', revision: 'mapping-2' };
  read.mockResolvedValueOnce({ ...observation, area: nextArea, level: '붐빔' });
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <CurrentCrowdingCard {...props} accessToken="user-1" />,
    );
  });
  await ReactTestRenderer.act(async () => {
    renderer!.update(
      <CurrentCrowdingCard
        {...props}
        eventId="event-2"
        area={nextArea}
        accessToken="user-1"
      />,
    );
  });
  await ReactTestRenderer.act(async () => {
    resolveOld(observation);
  });
  expect(labels(renderer!)).toContain('경복궁');
  expect(labels(renderer!)).toContain('붐빔');
  expect(labels(renderer!)).not.toContain('여유');
  await ReactTestRenderer.act(() => renderer!.unmount());
});

test('failed refresh retains dated data, and unsupported mapping removes the card', async () => {
  read.mockResolvedValueOnce({
    ...observation,
    state: 'last_known',
    observedAt: '2026-11-17T05:30:00Z',
  });
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <CurrentCrowdingCard {...props} accessToken="user-1" />,
    );
  });
  read.mockRejectedValueOnce(new Error('network'));
  await ReactTestRenderer.act(async () => {
    renderer!.root
      .findByProps({ accessibilityLabel: '주변 혼잡도 새로고침' })
      .props.onPress();
  });
  expect(labels(renderer!)).toContain('여유');
  expect(labels(renderer!)).toContain('마지막 관측');
  expect(labels(renderer!)).toContain('갱신하지 못했어요');
  capture('last-known', renderer!);
  read.mockResolvedValueOnce({ supported: false });
  await ReactTestRenderer.act(async () => {
    renderer!.root
      .findByProps({ accessibilityLabel: '주변 혼잡도 새로고침' })
      .props.onPress();
  });
  expect(renderer!.toJSON()).toBeNull();
  await ReactTestRenderer.act(() => renderer!.unmount());
});

test('no valid source reading shows unavailable without inventing a level', async () => {
  read.mockResolvedValueOnce({
    ...observation,
    observedAt: null,
    level: null,
    state: 'unavailable',
    refreshFailed: true,
  });
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <CurrentCrowdingCard {...props} accessToken="user-1" />,
    );
  });
  expect(labels(renderer!)).toContain('현재 정보 없음');
  expect(labels(renderer!)).not.toContain('여유');
  capture('unavailable', renderer!);
  await ReactTestRenderer.act(() => renderer!.unmount());
});

test('source replacement average is labeled as a reference, not current observation', async () => {
  read.mockResolvedValueOnce({ ...observation, quality: 'Y' });
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <CurrentCrowdingCard {...props} accessToken="user-1" />,
    );
  });
  expect(labels(renderer!)).toContain('참고 혼잡도');
  expect(labels(renderer!)).toContain('최근 4주 같은 요일·시간 평균');
  capture('replacement', renderer!);
  await ReactTestRenderer.act(() => renderer!.unmount());
});
