/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Alert, BackHandler, Linking, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import App from '../App';
import { eventsNewestFirst } from '../src/data/events';
import { currentUser } from '../src/data/user';
import { loadUser, saveUser } from '../src/storage/userStorage';

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});

test('keeps bottom navigation above the phone safe area', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer | null = null;

  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<App />);
  });

  const bottomNavigation = renderer!.root.findByProps({
    accessibilityLabel: 'Bottom navigation',
  });
  const bottomNavigationStyle = StyleSheet.flatten(
    bottomNavigation.props.style,
  );

  expect(bottomNavigationStyle.height).toBe(116);
  expect(bottomNavigationStyle.paddingBottom).toBe(34);
});

test('switches adjacent tabs with horizontal swipes', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer | null = null;

  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<App />);
  });

  expect(renderer!.root.findByProps({ children: '행사 탐색' })).toBeTruthy();

  await swipeTabs(renderer!, -96);
  expect(renderer!.root.findByProps({ children: '저장한 행사' })).toBeTruthy();

  await swipeTabs(renderer!, 96);
  expect(renderer!.root.findByProps({ children: '행사 탐색' })).toBeTruthy();

  await swipeTabs(renderer!, 96);
  expect(
    renderer!.root.findByProps({ children: '이번 주말 추천' }),
  ).toBeTruthy();

  await swipeTabs(renderer!, 96);
  expect(
    renderer!.root.findByProps({ children: '이번 주말 추천' }),
  ).toBeTruthy();
});

test('switches tabs when swiping from an event card area', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer | null = null;

  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<App />);
  });

  expect(
    renderer!.root.findByProps({
      accessibilityLabel: `Open ${eventsNewestFirst[0].title}`,
    }),
  ).toBeTruthy();

  await swipeEventCard(renderer!, -96);

  expect(renderer!.root.findByProps({ children: '저장한 행사' })).toBeTruthy();
});

test('moves the tab strip while a card swipe is in progress', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer | null = null;

  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<App />);
  });

  const eventCard = renderer!.root.findByProps({
    accessibilityLabel: `Open ${eventsNewestFirst[0].title}`,
  });
  const tabStrip = renderer!.root.findByProps({
    accessibilityLabel: 'Tab strip',
  });
  const translateX = StyleSheet.flatten(tabStrip.props.style).transform[0]
    .translateX;
  const initialOffset = translateX.__getValue();

  await ReactTestRenderer.act(() => {
    eventCard.props.onTouchStart({
      nativeEvent: { pageX: 200, pageY: 200 },
    });
    eventCard.props.onTouchMove({
      nativeEvent: { pageX: 140, pageY: 202 },
    });
  });

  expect(translateX.__getValue()).toBe(initialOffset - 60);
});

test('does not open event detail when an event card gesture is a tab swipe', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer | null = null;

  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<App />);
  });

  await swipeEventCard(renderer!, -96);

  expect(
    renderer!.root.findAllByProps({
      accessibilityLabel: 'Open source or reservation page',
    }),
  ).toHaveLength(0);
  expect(renderer!.root.findByProps({ children: '저장한 행사' })).toBeTruthy();
});

test('opens the source URL from the event detail CTA', async () => {
  const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  let renderer: ReactTestRenderer.ReactTestRenderer | null = null;

  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<App />);
  });

  await ReactTestRenderer.act(() => {
    renderer!.root
      .findByProps({ accessibilityLabel: `Open ${eventsNewestFirst[0].title}` })
      .props.onPress();
  });

  expect(
    renderer!.root.findAllByProps({
      accessibilityLabel: `Open ${eventsNewestFirst[0].title}`,
    }),
  ).not.toHaveLength(0);

  await ReactTestRenderer.act(() => {
    renderer!.root
      .findByProps({ accessibilityLabel: 'Open source or reservation page' })
      .props.onPress();
  });

  expect(openURL).toHaveBeenCalledWith(eventsNewestFirst[0].sourceUrl);
});

test('hardware back closes the event detail screen before exiting the app', async () => {
  let hardwareBackPress: (() => boolean) | undefined;
  jest
    .spyOn(BackHandler, 'addEventListener')
    .mockImplementation((event, handler) => {
      if (event === 'hardwareBackPress') {
        hardwareBackPress = () => handler({} as never) === true;
      }

      return { remove: jest.fn() };
    });

  let renderer: ReactTestRenderer.ReactTestRenderer | null = null;

  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<App />);
  });

  await ReactTestRenderer.act(() => {
    renderer!.root
      .findByProps({ accessibilityLabel: `Open ${eventsNewestFirst[0].title}` })
      .props.onPress();
  });

  expect(
    renderer!.root.findByProps({
      accessibilityLabel: 'Open source or reservation page',
    }),
  ).toBeTruthy();

  await ReactTestRenderer.act(() => {
    expect(hardwareBackPress?.()).toBe(true);
  });

  expect(
    renderer!.root.findAllByProps({
      accessibilityLabel: 'Open source or reservation page',
    }),
  ).toHaveLength(0);
});

test('resets locally saved user information from settings', async () => {
  await saveUser({
    ...currentUser,
    displayName: 'Edited parent',
    children: [
      ...currentUser.children,
      {
        id: 'child-added',
        nickname: '셋째',
        birthDate: '2026-01-10',
        gender: 'female',
      },
    ],
    activeChildIds: ['child-added'],
  });

  const alert = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
  let renderer: ReactTestRenderer.ReactTestRenderer | null = null;

  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<App />);
  });

  await ReactTestRenderer.act(() => {
    renderer!.root
      .findAllByProps({ accessibilityLabel: 'Open user settings' })
      .filter(node => typeof node.props.onPress === 'function')[0]
      .props.onPress();
  });

  expect(
    renderer!.root.findAllByProps({ defaultValue: 'Edited parent' }),
  ).not.toHaveLength(0);

  await ReactTestRenderer.act(() => {
    renderer!.root
      .findByProps({ accessibilityLabel: 'Reset user information' })
      .props.onPress();
  });

  const alertButtons = alert.mock.calls[0][2];
  const resetButton = alertButtons?.find(button => button.text === '초기화');

  await ReactTestRenderer.act(async () => {
    resetButton?.onPress?.();
  });

  await expect(loadUser()).resolves.toEqual(currentUser);
  await expect(AsyncStorage.getItem('@babyroo/user')).resolves.toBeNull();
  expect(
    renderer!.root.findAllByProps({ defaultValue: 'Edited parent' }),
  ).toHaveLength(0);
  expect(
    renderer!.root.findAllByProps({
      accessibilityLabel: 'Reset user information',
    }),
  ).toHaveLength(0);
});

test('shows residence choices in user settings', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer | null = null;

  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<App />);
  });

  await ReactTestRenderer.act(() => {
    renderer!.root
      .findAllByProps({ accessibilityLabel: 'Open user settings' })
      .filter(node => typeof node.props.onPress === 'function')[0]
      .props.onPress();
  });

  expect(renderer!.root.findByProps({ children: '거주지' })).toBeTruthy();
  expect(renderer!.root.findAllByProps({ children: '서울' }).length).toBeGreaterThan(
    0,
  );
  expect(renderer!.root.findAllByProps({ children: '경기' }).length).toBeGreaterThan(
    0,
  );
  expect(
    renderer!.root.findAllByProps({ children: '기타 지역' }).length,
  ).toBeGreaterThan(0);
  expect(renderer!.root.findAllByProps({ children: '서울/경기' })).toHaveLength(
    0,
  );
  expect(
    renderer!.root.findAllByProps({ children: '자주 보는 동네' }),
  ).toHaveLength(0);
});

test('shows simplified filters for schedule, region, and reservation', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer | null = null;

  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<App />);
  });

  await ReactTestRenderer.act(() => {
    renderer!.root.findByProps({ accessibilityLabel: 'Open filters' }).props
      .onPress();
  });

  expect(renderer!.root.findByProps({ children: '예정' })).toBeTruthy();
  expect(renderer!.root.findByProps({ children: '진행중' })).toBeTruthy();
  expect(
    renderer!.root.findAllByProps({ children: '서울' }).length,
  ).toBeGreaterThan(0);
  expect(
    renderer!.root.findAllByProps({ children: '경기' }).length,
  ).toBeGreaterThan(0);
  expect(
    renderer!.root.findAllByProps({ children: '기타 지역' }).length,
  ).toBeGreaterThan(0);
  expect(
    renderer!.root.findByProps({ children: '예약 필요' }),
  ).toBeTruthy();
  expect(
    renderer!.root.findByProps({ children: '예약 불필요' }),
  ).toBeTruthy();
  expect(renderer!.root.findAllByProps({ children: '종료됨' })).toHaveLength(0);
  expect(
    renderer!.root.findAllByProps({ children: '신청 가능' }),
  ).toHaveLength(0);
  expect(renderer!.root.findAllByProps({ children: '종로구' })).toHaveLength(0);
});

test('filters schedule by scheduled and ongoing states separately', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer | null = null;

  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<App />);
  });

  await ReactTestRenderer.act(() => {
    renderer!.root.findByProps({ accessibilityLabel: 'Open filters' }).props
      .onPress();
  });

  await ReactTestRenderer.act(() => {
    renderer!.root.findByProps({ accessibilityLabel: 'Filter schedule 예정' })
      .props.onPress();
  });

  await ReactTestRenderer.act(() => {
    renderer!.root.findByProps({ accessibilityLabel: 'Apply filters' }).props
      .onPress();
  });

  expect(renderer!.root.findByProps({ children: '필터 1' })).toBeTruthy();
  expect(renderer!.root.findByProps({ children: '예정' })).toBeTruthy();
});

async function swipeTabs(
  renderer: ReactTestRenderer.ReactTestRenderer,
  dx: number,
) {
  const swipeArea = renderer.root.findByProps({
    accessibilityLabel: 'Tab swipe area',
  });
  const event = {
    start: { nativeEvent: { pageX: 200, pageY: 200 } },
    move: { nativeEvent: { pageX: 200 + dx / 2, pageY: 202 } },
    end: { nativeEvent: { pageX: 200 + dx, pageY: 204 } },
  };

  await ReactTestRenderer.act(() => {
    swipeArea.props.onTouchStart(event.start);
    swipeArea.props.onTouchMove(event.move);
    swipeArea.props.onTouchEnd(event.end);
  });
}

async function swipeEventCard(
  renderer: ReactTestRenderer.ReactTestRenderer,
  dx: number,
) {
  const eventCard = renderer.root.findByProps({
    accessibilityLabel: `Open ${eventsNewestFirst[0].title}`,
  });
  const event = {
    start: { nativeEvent: { pageX: 200, pageY: 200 } },
    move: { nativeEvent: { pageX: 200 + dx / 2, pageY: 202 } },
    end: { nativeEvent: { pageX: 200 + dx, pageY: 204 } },
  };

  await ReactTestRenderer.act(() => {
    eventCard.props.onTouchStart(event.start);
    eventCard.props.onTouchMove(event.move);
    eventCard.props.onTouchEnd(event.end);
    eventCard.props.onPress();
  });
}
