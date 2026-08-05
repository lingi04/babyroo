/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Alert, BackHandler, Linking, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import App from '../App';
import { BabyrooEvent, eventsNewestFirst } from '../src/data/events';
import { currentUser, User } from '../src/data/user';
import { clearAuthSession, saveAuthSession } from '../src/storage/authStorage';
import { loadUser, saveUser } from '../src/storage/userStorage';

const testAuthSession = {
  provider: 'google' as const,
  providerUserId: 'google-user-001',
  email: 'parent@example.com',
  displayName: 'Google Parent',
  idToken: 'mock-id-token',
};

const completeUser: User = {
  ...currentUser,
  id: 'google-google-user-001',
  displayName: '테스트 보호자',
  children: [
    {
      id: 'child-001',
      nickname: '첫째',
      birthDate: '2024-06-17',
      gender: 'unknown',
    },
  ],
  activeChildIds: ['child-001'],
};

beforeEach(async () => {
  await AsyncStorage.clear();
  await saveAuthSession(testAuthSession);
  await saveUser(completeUser);
});

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});

test('starts Google sign in when signed out', async () => {
  await clearAuthSession();
  await saveUser(currentUser);
  let renderer: ReactTestRenderer.ReactTestRenderer | null = null;

  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<App />);
  });

  expect(
    renderer!.root.findByProps({ accessibilityLabel: 'Continue with Google' }),
  ).toBeTruthy();

  await ReactTestRenderer.act(async () => {
    renderer!.root
      .findByProps({ accessibilityLabel: 'Continue with Google' })
      .props.onPress();
  });

  expect(renderer!.root.findByProps({ children: '회원가입' })).toBeTruthy();
});

test('allows browsing explore without login and gates personalization', async () => {
  await clearAuthSession();
  await saveUser(currentUser);
  let renderer: ReactTestRenderer.ReactTestRenderer | null = null;

  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<App />);
  });

  await ReactTestRenderer.act(() => {
    renderer!.root
      .findByProps({ accessibilityLabel: 'Browse without login' })
      .props.onPress();
  });

  expect(renderer!.root.findByProps({ children: '행사 탐색' })).toBeTruthy();

  await swipeTabs(renderer!, 96);

  expect(
    renderer!.root.findAllByProps({ children: '로그인이 필요해요' }).length,
  ).toBeGreaterThan(0);
  expect(
    renderer!.root.findAllByProps({
      accessibilityLabel: 'Sign in for personalization',
    }).length,
  ).toBeGreaterThan(0);
});

test('collects profile information during onboarding', async () => {
  await saveUser({
    ...currentUser,
    id: 'google-google-user-001',
  });
  let renderer: ReactTestRenderer.ReactTestRenderer | null = null;

  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<App />);
  });

  expect(renderer!.root.findByProps({ children: '회원가입' })).toBeTruthy();

  await ReactTestRenderer.act(() => {
    renderer!.root
      .findAllByProps({ placeholder: '예: 로아 아빠' })[0]
      .props.onChangeText('로아 아빠');
  });

  await ReactTestRenderer.act(() => {
    renderer!.root
      .findByProps({ accessibilityLabel: 'Continue onboarding' })
      .props.onPress();
  });

  await ReactTestRenderer.act(() => {
    renderer!.root
      .findAllByProps({ placeholder: '아이 이름 또는 별명' })[0]
      .props.onChangeText('로아');
  });

  await ReactTestRenderer.act(() => {
    renderer!.root
      .findByProps({ accessibilityLabel: 'Continue onboarding' })
      .props.onPress();
  });

  await ReactTestRenderer.act(async () => {
    renderer!.root
      .findByProps({ accessibilityLabel: 'Continue onboarding' })
      .props.onPress();
  });

  expect(renderer!.root.findByProps({ children: '행사 탐색' })).toBeTruthy();
  await expect(loadUser()).resolves.toMatchObject({
    displayName: '로아 아빠',
    children: [{ nickname: '로아' }],
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
  expect(renderer!.root.findByProps({ children: '맞춤 추천' })).toBeTruthy();

  await swipeTabs(renderer!, 96);
  expect(renderer!.root.findByProps({ children: '맞춤 추천' })).toBeTruthy();
});

test('answers recommendation questions before requesting results', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer | null = null;

  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<App />);
  });

  await swipeTabs(renderer!, 96);

  expect(renderer!.root.findByProps({ children: '오늘의 추천' })).toBeTruthy();
  expect(renderer!.root.findAllByProps({ children: '질문' })).toHaveLength(0);
  expect(renderer!.root.findAllByProps({ children: '출발 지역' })).toHaveLength(
    0,
  );
  expect(renderer!.root.findAllByProps({ children: '이동 방식' })).toHaveLength(
    0,
  );
  expect(renderer!.root.findAllByProps({ children: '실내 선호' })).toHaveLength(
    0,
  );

  await ReactTestRenderer.act(() => {
    renderer!.root
      .findByProps({ accessibilityLabel: 'Request recommendation' })
      .props.onPress();
  });

  expect(
    renderer!.root.findByProps({
      children: '오늘 어디에서 출발하세요?',
    }),
  ).toBeTruthy();

  await ReactTestRenderer.act(() => {
    renderer!.root
      .findByProps({ accessibilityLabel: 'Answer recommendation 서울' })
      .props.onPress();
  });

  expect(renderer!.root.findByProps({ children: '선택한 답변' })).toBeTruthy();
  expect(
    renderer!.root.findAllByProps({ children: '출발 지역' }).length,
  ).toBeGreaterThan(0);
  expect(
    renderer!.root.findAllByProps({ children: '서울' }).length,
  ).toBeGreaterThan(0);

  for (const answer of [
    '1-2일 안에',
    '날씨 괜찮으면 야외도 좋아요',
    '가능해요',
    '한적한 곳',
    '무료 위주',
    '예약 없이 가고 싶어요',
    '직접 체험',
  ]) {
    await ReactTestRenderer.act(() => {
      renderer!.root
        .findByProps({
          accessibilityLabel: `Answer recommendation ${answer}`,
        })
        .props.onPress();
    });
  }

  expect(
    renderer!.root.findByProps({ children: '이 조건으로 추천 받을까요?' }),
  ).toBeTruthy();

  await ReactTestRenderer.act(async () => {
    renderer!.root
      .findByProps({ accessibilityLabel: 'Confirm recommendation request' })
      .props.onPress();
  });

  expect(
    renderer!.root.findAllByProps({ children: '추천 결과' }).length,
  ).toBeGreaterThan(0);
  expect(renderer!.root.findByProps({ children: '선택한 답변' })).toBeTruthy();
  expect(
    renderer!.root.findAllByProps({ children: '예약 없이 가고 싶어요' }).length,
  ).toBeGreaterThan(0);
  expect(
    renderer!.root.findByProps({ children: 'Recommendation Debug' }),
  ).toBeTruthy();

  await ReactTestRenderer.act(() => {
    renderer!.root
      .findByProps({ accessibilityLabel: 'Toggle recommendation debug' })
      .props.onPress();
  });

  expect(renderer!.root.findByProps({ children: 'DEBUG PROMPT' })).toBeTruthy();
  expect(
    renderer!.root.findAll(
      node =>
        typeof node.props.children === 'string' &&
        node.props.children.includes(
          'Rank the candidate events and explain why each one fits this family.',
        ),
    ).length,
  ).toBeGreaterThan(0);
  expect(
    renderer!.root.findAll(
      node =>
        typeof node.props.children === 'string' &&
        node.props.children.includes('- reservation: no_reservation'),
    ).length,
  ).toBeGreaterThan(0);
  expect(
    renderer!.root.findAll(
      node =>
        typeof node.props.children === 'string' &&
        node.props.children.includes('- weatherPlan: outdoor_if_suitable'),
    ).length,
  ).toBeGreaterThan(0);
});

test('moves backward in the recommendation question flow', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer | null = null;

  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<App />);
  });

  await swipeTabs(renderer!, 96);

  await ReactTestRenderer.act(() => {
    renderer!.root
      .findByProps({ accessibilityLabel: 'Request recommendation' })
      .props.onPress();
  });

  await ReactTestRenderer.act(() => {
    renderer!.root
      .findByProps({ accessibilityLabel: 'Answer recommendation 서울' })
      .props.onPress();
  });

  expect(
    renderer!.root.findByProps({ children: '언제쯤 갈 생각인가요?' }),
  ).toBeTruthy();

  await ReactTestRenderer.act(() => {
    renderer!.root
      .findByProps({ accessibilityLabel: 'Previous recommendation question' })
      .props.onPress();
  });

  expect(
    renderer!.root.findByProps({
      children: '오늘 어디에서 출발하세요?',
    }),
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
  expect(
    renderer!.root.findAllByProps({ children: '서울' }).length,
  ).toBeGreaterThan(0);
  expect(
    renderer!.root.findAllByProps({ children: '경기' }).length,
  ).toBeGreaterThan(0);
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
    renderer!.root
      .findByProps({ accessibilityLabel: 'Toggle exploration controls' })
      .props.onPress();
  });

  await ReactTestRenderer.act(() => {
    renderer!.root
      .findByProps({ accessibilityLabel: 'Open filters' })
      .props.onPress();
  });

  expect(
    renderer!.root.findAllByProps({ children: '예정' }).length,
  ).toBeGreaterThan(0);
  expect(
    renderer!.root.findAllByProps({ children: '진행중' }).length,
  ).toBeGreaterThan(0);
  expect(
    renderer!.root.findAllByProps({ children: '서울' }).length,
  ).toBeGreaterThan(0);
  expect(
    renderer!.root.findAllByProps({ children: '경기' }).length,
  ).toBeGreaterThan(0);
  expect(
    renderer!.root.findAllByProps({ children: '기타 지역' }).length,
  ).toBeGreaterThan(0);
  expect(renderer!.root.findByProps({ children: '예약 필요' })).toBeTruthy();
  expect(renderer!.root.findByProps({ children: '예약 불필요' })).toBeTruthy();
  expect(renderer!.root.findAllByProps({ children: '종료됨' })).toHaveLength(0);
  expect(renderer!.root.findAllByProps({ children: '신청 가능' })).toHaveLength(
    0,
  );
  expect(renderer!.root.findAllByProps({ children: '종로구' })).toHaveLength(0);
});

test('filters schedule by scheduled and ongoing states separately', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer | null = null;

  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<App />);
  });

  await ReactTestRenderer.act(() => {
    renderer!.root
      .findByProps({ accessibilityLabel: 'Toggle exploration controls' })
      .props.onPress();
  });

  await ReactTestRenderer.act(() => {
    renderer!.root
      .findByProps({ accessibilityLabel: 'Open filters' })
      .props.onPress();
  });

  await ReactTestRenderer.act(() => {
    renderer!.root
      .findByProps({ accessibilityLabel: 'Filter schedule 예정' })
      .props.onPress();
  });

  await ReactTestRenderer.act(() => {
    renderer!.root
      .findByProps({ accessibilityLabel: 'Apply filters' })
      .props.onPress();
  });

  expect(renderer!.root.findByProps({ children: '필터 1' })).toBeTruthy();
  expect(
    renderer!.root.findAllByProps({ children: '예정' }).length,
  ).toBeGreaterThan(0);
});

test('uses explore content types to combine events, permanent venues, and Seoul kids cafes', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer | null = null;
  const isSeoulKidsCafeEvent = (event: BabyrooEvent) => {
    const searchableText = [
      event.title,
      event.venueName,
      event.summary,
      ...event.tags,
    ].join(' ');

    return (
      event.source === 'seoul_kids_cafe' ||
      searchableText.includes('서울형 키즈카페') ||
      searchableText.includes('서울형키즈카페')
    );
  };
  const isPermanentVenueEvent = (event: BabyrooEvent) => {
    const searchableText = [
      event.title,
      event.venueName,
      event.summary,
      event.sourceUrl,
    ].join(' ');

    return (
      event.title.endsWith('관람') ||
      event.title.endsWith('입장') ||
      event.category === 'museum' ||
      searchableText.includes('아쿠아리움 관람') ||
      searchableText.includes('어린이박물관 관람') ||
      searchableText.includes('체험관 관람')
    );
  };
  const limitedEvent = eventsNewestFirst.find(event => {
    return !isSeoulKidsCafeEvent(event) && !isPermanentVenueEvent(event);
  });
  const permanentVenueEvent = eventsNewestFirst.find(event => {
    return !isSeoulKidsCafeEvent(event) && isPermanentVenueEvent(event);
  });
  const seoulKidsCafeEvent = eventsNewestFirst.find(isSeoulKidsCafeEvent);

  expect(limitedEvent).toBeTruthy();
  expect(permanentVenueEvent).toBeTruthy();
  expect(seoulKidsCafeEvent).toBeTruthy();

  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<App />);
  });

  expect(
    renderer!.root.findAllByProps({ children: limitedEvent!.title }).length,
  ).toBeGreaterThan(0);
  expect(
    renderer!.root.findAllByProps({ children: permanentVenueEvent!.title }),
  ).toHaveLength(0);
  expect(
    renderer!.root.findAllByProps({ children: seoulKidsCafeEvent!.title }),
  ).toHaveLength(0);

  await ReactTestRenderer.act(() => {
    renderer!.root
      .findByProps({
        accessibilityLabel: 'Toggle explore content type 상설 전시',
      })
      .props.onPress();
  });

  expect(
    renderer!.root.findAllByProps({ children: permanentVenueEvent!.title })
      .length,
  ).toBeGreaterThan(0);
  expect(
    renderer!.root.findAllByProps({ children: limitedEvent!.title }).length,
  ).toBeGreaterThan(0);

  await ReactTestRenderer.act(() => {
    renderer!.root
      .findByProps({
        accessibilityLabel: 'Toggle explore content type 서울형 키즈카페',
      })
      .props.onPress();
  });

  expect(
    renderer!.root.findAllByProps({ children: seoulKidsCafeEvent!.title })
      .length,
  ).toBeGreaterThan(0);
  expect(
    renderer!.root.findAllByProps({ children: permanentVenueEvent!.title })
      .length,
  ).toBeGreaterThan(0);
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
