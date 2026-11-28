import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Alert, Image, Linking, StyleSheet, Text } from 'react-native';
import { EventDetail } from '../App';
import { BabyrooEvent } from '../src/data/events';
import { getEventFromBabyrooApi } from '../src/api/babyrooApi';

jest.mock('../src/api/babyrooApi', () => ({
  ...jest.requireActual('../src/api/babyrooApi'),
  getEventFromBabyrooApi: jest.fn(),
}));

beforeEach(() => {
  jest.mocked(getEventFromBabyrooApi).mockReset();
  jest.mocked(getEventFromBabyrooApi).mockRejectedValue(new Error('offline'));
});

jest.mock('react-native-iap', () => ({
  useIAP: () => ({ connected: false, products: [] }),
}));

const event: BabyrooEvent = {
  id: 'detail-test',
  csvSequence: 1,
  title: '아이와 함께하는 문화 체험',
  venueName: '국립민속박물관 어린이박물관',
  venueDetail: '어린이 체험실',
  locality: '종로구',
  region: '서울',
  category: 'experience',
  source: 'manual',
  startsAt: '2026-11-01',
  endsAt: '2026-11-30',
  priceType: 'unknown',
  reservationStatus: 'unknown',
  tags: ['문화 체험'],
  summary: 'API에서 받은 행사 설명',
  sourceUrl: 'https://example.com/reservation',
};

async function renderEvent(overrides: Partial<BabyrooEvent> = {}) {
  const onBack = jest.fn();
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <EventDetail
        event={{ ...event, ...overrides }}
        bottomInset={24}
        topInset={32}
        onBack={onBack}
      />,
    );
  });
  return { renderer: renderer!, onBack };
}

test.each([
  ['1970-01-01', '9999-12-31', '서울 종로구'],
  ['2026-11-01', '2026-11-30', '서울 종로구 · 2026-11-01 – 2026-11-30'],
  ['1970-01-01', '2026-11-30', '서울 종로구 · 1970-01-01 – 2026-11-30'],
  ['2026-11-01', '9999-12-31', '서울 종로구 · 2026-11-01 – 9999-12-31'],
])('formats the event detail dates %s to %s', async (startsAt, endsAt, expected) => {
  const { renderer } = await renderEvent({ startsAt, endsAt });
  try {
    expect(renderer.root.findAllByType(Text).some(({ props }) => props.children === expected)).toBe(true);
  } finally {
    await ReactTestRenderer.act(() => renderer.unmount());
  }
});

test('shows a newly mapped area even when the Explore event has no crowding metadata', async () => {
  jest.mocked(getEventFromBabyrooApi).mockResolvedValue({
    ...event,
    crowdingArea: { id: 'POI008', name: '경복궁', revision: 'new-mapping' },
  });
  const { renderer } = await renderEvent();
  expect(getEventFromBabyrooApi).toHaveBeenCalledWith(event.id);
  expect(renderer.root.findByProps({ children: '주변 혼잡도' })).toBeTruthy();
  expect(renderer.root.findByProps({ children: '경복궁' })).toBeTruthy();
  await ReactTestRenderer.act(() => renderer.unmount());
  const reopened = await renderEvent();
  expect(getEventFromBabyrooApi).toHaveBeenCalledTimes(2);
  await ReactTestRenderer.act(() => reopened.renderer.unmount());
});

test.each(['removed', 'offline', 'not_found'] as const)(
  'handles a stale mapped event when fresh lookup is %s',
  async outcome => {
    const crowdingArea = { id: 'POI008', name: '경복궁', revision: 'old' };
    if (outcome === 'removed') {
      jest.mocked(getEventFromBabyrooApi).mockResolvedValue(event);
    } else {
      jest.mocked(getEventFromBabyrooApi).mockRejectedValue(
        Object.assign(new Error(outcome), {
          statusCode: outcome === 'not_found' ? 404 : 503,
        }),
      );
    }
    const { renderer } = await renderEvent({ crowdingArea });
    expect(
      renderer.root.findAllByProps({ children: '주변 혼잡도' }).length > 0,
    ).toBe(outcome === 'offline');
    expect(renderer.root.findByProps({ children: event.summary })).toBeTruthy();
    await ReactTestRenderer.act(() => renderer.unmount());
  },
);

test('late detail responses cannot show a previous venue’s crowding area', async () => {
  let resolveFirst!: (value: BabyrooEvent) => void;
  jest
    .mocked(getEventFromBabyrooApi)
    .mockImplementationOnce(
      () =>
        new Promise(resolve => {
          resolveFirst = resolve;
        }),
    )
    .mockResolvedValueOnce({
      ...event,
      id: 'second',
      crowdingArea: { id: 'POI101', name: '서울숲공원', revision: 'second' },
    });
  const { renderer } = await renderEvent();
  await ReactTestRenderer.act(() =>
    renderer.update(
      <EventDetail
        event={{ ...event, id: 'second' }}
        bottomInset={24}
        topInset={32}
        onBack={() => {}}
      />,
    ),
  );
  await ReactTestRenderer.act(() =>
    resolveFirst({
      ...event,
      crowdingArea: { id: 'POI008', name: '경복궁', revision: 'first' },
    }),
  );
  expect(renderer.root.findByProps({ children: '서울숲공원' })).toBeTruthy();
  expect(renderer.root.findAllByProps({ children: '경복궁' })).toHaveLength(0);
  await ReactTestRenderer.act(() => renderer.unmount());
});

test('missing facts stay blank without inventing hours, age or reservation requirements', async () => {
  const { renderer } = await renderEvent({ startsAt: '', endsAt: '' });
  const labels = renderer.root
    .findAllByType(Text)
    .map(node => node.props.children);
  expect(labels).toContain(event.summary);
  expect(labels).toContain(event.venueDetail);
  expect(labels).toContain('문화 체험');
  expect(labels).not.toContain('예약 불필요');
  expect(labels).not.toContain('월령 확인필요');
  expect(labels).not.toContain('보호자 동반');
  expect(labels).not.toContain('10:00–17:00');
  expect(labels).not.toContain('주변 혼잡도');
  expect(labels).toContain('서울 종로구');
  const age = renderer.root.findByProps({ children: '월령' }).parent!;
  const reservation = renderer.root.findByProps({ children: '예약' }).parent!;
  expect(age.findAllByType(Text)[1].props.children).toBe('');
  expect(reservation.findAllByType(Text)[1].props.children).toBe('');
  await ReactTestRenderer.act(() => renderer.unmount());
});

test('shows an explicit guardian requirement and preserves long venue text without truncation', async () => {
  const venueName = event.venueName.repeat(4);
  const { renderer } = await renderEvent({ guardianRequired: true, venueName });
  expect(renderer.root.findByProps({ children: '보호자 동반' })).toBeTruthy();
  expect(renderer.root.findByProps({ children: '필수' })).toBeTruthy();
  expect(
    renderer.root.findByProps({ children: venueName }).props.numberOfLines,
  ).toBeUndefined();
  await ReactTestRenderer.act(() => renderer.unmount());
});

test('failed hero image falls back to the category thumbnail', async () => {
  const imageUrl = 'https://example.com/image.jpg';
  const { renderer } = await renderEvent({ imageUrl });
  const remoteImages = () =>
    renderer.root
      .findAllByType(Image)
      .filter(node => node.props.source?.uri === imageUrl);
  expect(remoteImages()).toHaveLength(1);
  await ReactTestRenderer.act(() => remoteImages()[0].props.onError());
  expect(remoteImages()).toHaveLength(0);
  await ReactTestRenderer.act(() => renderer.unmount());
});

test('detail overlay respects the top safe area and hero fills its frame', async () => {
  const imageUrl = 'https://example.com/small-image.jpg';
  const { renderer } = await renderEvent({ imageUrl });
  const tree = renderer.toJSON();
  if (!tree || Array.isArray(tree)) {
    throw new Error('Expected a single detail screen root');
  }
  expect(StyleSheet.flatten(tree.props.style).paddingTop).toBe(32);
  await ReactTestRenderer.act(() => {
    tree.props.onLayout({ nativeEvent: { layout: { width: 360 } } });
  });
  const heroImage = renderer.root
    .findAllByType(Image)
    .find(node => node.props.source?.uri === imageUrl)!;
  expect(StyleSheet.flatten(heroImage.props.style)).toMatchObject({
    width: 320,
    height: 320 / 2.3,
    alignSelf: 'center',
  });
  expect(heroImage.props.resizeMode).toBe('cover');
  await ReactTestRenderer.act(() => renderer.unmount());
});

test('usage information has decorative icons alongside its text labels', async () => {
  const { renderer } = await renderEvent({ guardianRequired: true });
  for (const label of ['운영 시간', '보호자 동반']) {
    const heading = renderer.root.findByProps({ children: label }).parent!;
    expect(heading.findAllByType(Image)).toHaveLength(1);
    expect(heading.findByType(Image).props.accessible).toBe(false);
  }
  await ReactTestRenderer.act(() => renderer.unmount());
});

test('retains back navigation, source navigation and its failure alert', async () => {
  const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  const alert = jest.spyOn(Alert, 'alert');
  const { renderer, onBack } = await renderEvent();
  await ReactTestRenderer.act(() => {
    renderer.root
      .findByProps({ accessibilityLabel: 'Go back' })
      .props.onPress();
  });
  expect(onBack).toHaveBeenCalledTimes(1);
  const source = renderer.root.findByProps({
    accessibilityLabel: 'Open source or reservation page',
  });
  await ReactTestRenderer.act(() => source.props.onPress());
  expect(openURL).toHaveBeenCalledWith(event.sourceUrl);
  openURL.mockRejectedValueOnce(new Error('unavailable'));
  await ReactTestRenderer.act(() => source.props.onPress());
  expect(alert).toHaveBeenCalledWith(
    '페이지를 열 수 없어요',
    '잠시 후 다시 시도해 주세요.',
  );
  await ReactTestRenderer.act(() => renderer.unmount());
  openURL.mockRestore();
  alert.mockRestore();
});
