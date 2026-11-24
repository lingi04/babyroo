/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { AccessibilityInfo, Alert, BackHandler, Linking, ScrollView, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import App from '../App';
import { RemoteRecommendationService } from '../src/recommendation/RemoteRecommendationService';
import * as recommendationNotifications from '../src/notifications/useRecommendationNotifications';
import type { RecommendationSession } from '../src/recommendation/types';
import * as babyrooApi from '../src/api/babyrooApi';
import { BabyrooEvent, eventsNewestFirst } from '../src/data/events';
import { currentUser, User } from '../src/data/user';
import { clearAuthSession, saveAuthSession } from '../src/storage/authStorage';
import { loadUser, saveUser } from '../src/storage/userStorage';

// The version gate is tested independently from the main app.
jest.mock('../src/appUpdate/AppUpdateGate', () => ({
  AppUpdateGate: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('react-native-iap', () => ({
  useIAP: () => ({ connected: false, products: [] }),
}));

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

const failedRecommendation: RecommendationSession = {
  id: 'failed-record', userId: completeUser.id,
  selectedChildIds: ['original-child'],
  selectedChildrenSnapshot: [{...completeUser.children[0], id:'original-child', nickname:'원래 아이'}],
  createdAt: '2026-11-21T10:02:00Z',
  preferences: {visitWindow:'soon', price:'free', weatherPlan:'prefer_indoor',
    departureAddress:'서울 성동구 원래 주소'},
  status:'failed', results:[], credit:{policy:'on_success_with_results',cost:0,consumed:false},
  error:{code:'llm_unavailable',message:'provider unavailable',retryable:true},
};

test.each([
  [{ duration: 'duration_short' }, '짧은 코스가 좋아요'],
  [{ activityStyle: 'activity_exhibition' }, '전시 관람'],
  [{ place: 'place_outdoor', vibe: 'vibe_quiet' }, '야외도 좋아요'],
] as const)('restores saved recommendation answers and visit-date ages %j', async (finalAnswers, finalLabel) => {
  await saveAuthSession({ ...testAuthSession, apiAccessToken: 'history-test-token' });
  const listedEvent = eventsNewestFirst[0];
  const ageReason = '11월 29일에 방문한다면 원래 아이(24개월)도 참여할 수 있어요.';
  const session: RecommendationSession = {
    ...failedRecommendation,
    status: 'success',
    error: undefined,
    answers: { startRegion: 'departure_input', interest: 'interest_animals', ...finalAnswers },
    preferences: {
      departureArea: { region: '경기', locality: '수원시' },
      resolvedVisitRange: { start: '2026-11-29', end: '2026-11-29' },
    },
    results: [{ eventId: listedEvent.id, reasons: [ageReason] }],
    eventSnapshots: [listedEvent],
  };
  const list = jest.spyOn(RemoteRecommendationService.prototype, 'listSessions').mockResolvedValue([session]);
  const credits = jest.spyOn(babyrooApi, 'getCreditStatusFromBabyrooApi').mockRejectedValue(new Error('Unavailable'));
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
  try {
    await ReactTestRenderer.act(() => { renderer = ReactTestRenderer.create(<App />); });
    const root = renderer!.root;
    const row = root.findAll(node => node.props.accessibilityRole === 'button' &&
      typeof node.props.accessibilityLabel === 'string' &&
      node.props.accessibilityLabel.includes('원래 아이') &&
      typeof node.props.onPress === 'function')[0];
    await ReactTestRenderer.act(() => row.props.onPress());
    expect(root.findByProps({ children: '경기 수원시' })).toBeTruthy();
    expect(root.findByProps({ children: '동물이나 곤충을 좋아해요' })).toBeTruthy();
    expect(root.findByProps({ children: finalLabel })).toBeTruthy();
    expect(root.findByProps({ children: '방문 예정 11월 29일 (일)' })).toBeTruthy();
    expect(root.findByProps({ children: ageReason })).toBeTruthy();
  } finally {
    await ReactTestRenderer.act(() => renderer?.unmount());
    list.mockRestore();
    credits.mockRestore();
  }
});

test('retains failed history without a duplicate panel and retries original inputs once', async () => {
  await saveAuthSession({...testAuthSession,apiAccessToken:'failure-test-token'});
  const departureArea = { region: '경기', locality: '수원시' };
  const answers = {
    startRegion: 'departure_input', visitDay: 'visit_soon', interest: 'interest_transport',
  } as const;
  const saved = {
    ...failedRecommendation,
    answers,
    preferences: {
      ...failedRecommendation.preferences,
      departureArea,
      interest: 'interest_transport' as const,
      resolvedVisitRange: { start: '2026-11-22', end: '2026-11-23' },
    },
  };
  const list = jest.spyOn(RemoteRecommendationService.prototype,'listSessions').mockResolvedValue([saved]);
  const credits = jest.spyOn(babyrooApi,'getCreditStatusFromBabyrooApi').mockRejectedValue(new Error('Unavailable'));
  let resolveRequest!: (session:RecommendationSession) => void;
  const createRequest = jest.spyOn(RemoteRecommendationService.prototype,'createSession').mockImplementation(
    () => new Promise(resolve => {resolveRequest=resolve;}),
  );
  let renderer:ReactTestRenderer.ReactTestRenderer|undefined;
  try {
    await ReactTestRenderer.act(()=>{renderer=ReactTestRenderer.create(<App/>);});
    const root=renderer!.root;
    expect(root.findAllByProps({children:'이번 요청에는 추천권이 사용되지 않았어요.'})).toHaveLength(0);
    const row=root.findAll(node=>node.props.accessibilityRole==='button' &&
      typeof node.props.accessibilityLabel==='string' && node.props.accessibilityLabel.includes('원래 아이') &&
      typeof node.props.onPress==='function')[0];
    expect(row).toBeTruthy();
    await ReactTestRenderer.act(()=>row.props.onPress());
    expect(root.findByProps({children:'추천 요청 실패'})).toBeTruthy();
    expect(root.findAllByProps({children:'조건에 맞춰 고른 후보 0개'})).toHaveLength(0);
    expect(root.findByProps({children:'이번 요청에는 추천권이 사용되지 않았어요.'})).toBeTruthy();
    const retry=root.findByProps({accessibilityLabel:'다시 시도, 추천 완료 시 추천권 1회 사용'});
    await ReactTestRenderer.act(()=>{retry.props.onPress();retry.props.onPress();});
    expect(createRequest).toHaveBeenCalledTimes(1);
    expect(createRequest).toHaveBeenCalledWith(expect.objectContaining({
      answers,
      preferences: { ...failedRecommendation.preferences, departureArea, interest: 'interest_transport' },
      selectedChildIds:failedRecommendation.selectedChildIds,
      selectedChildren:failedRecommendation.selectedChildrenSnapshot,
    }));
    await ReactTestRenderer.act(()=>resolveRequest({...failedRecommendation,id:'retry-record',status:'loading',error:undefined}));
    expect(root.findAllByProps({children:'추천 요청 실패'})).toHaveLength(0);
    expect(root.findAllByProps({children:'이번 요청에는 추천권이 사용되지 않았어요.'})).toHaveLength(0);
    const alert=jest.spyOn(Alert,'alert').mockImplementation(()=>{});
    try {
      createRequest.mockRejectedValueOnce(new Error('network unavailable'));
      await ReactTestRenderer.act(()=>row.props.onPress());
      await ReactTestRenderer.act(()=>root.findByProps({accessibilityLabel:'다시 시도, 추천 완료 시 추천권 1회 사용'}).props.onPress());
      expect(createRequest).toHaveBeenCalledTimes(2);
      expect(alert).toHaveBeenCalledWith('추천 요청 실패','network unavailable');
      createRequest.mockResolvedValueOnce({...failedRecommendation,id:'retry-after-error',status:'loading',error:undefined});
      await ReactTestRenderer.act(()=>row.props.onPress());
      await ReactTestRenderer.act(()=>root.findByProps({accessibilityLabel:'다시 시도, 추천 완료 시 추천권 1회 사용'}).props.onPress());
      expect(createRequest).toHaveBeenCalledTimes(3);
    } finally {alert.mockRestore();}
  } finally {
    await ReactTestRenderer.act(()=>renderer?.unmount());
    list.mockRestore();credits.mockRestore();createRequest.mockRestore();
  }
});

test.each([
  {push:'failed', saved:'failed', opensDetail:false},
  {push:'timeout', saved:'failed', opensDetail:false},
  {push:'success', saved:'failed', opensDetail:false},
  {push:'success', saved:'success', opensDetail:true},
])('notification $push with saved $saved routes by outcome', async ({push,saved,opensDetail})=>{
  await saveAuthSession({...testAuthSession,apiAccessToken:'notification-test-token'});
  let open!: (id:string,status:string)=>Promise<void>;
  const hook=jest.spyOn(recommendationNotifications,'useRecommendationNotifications').mockImplementation((_session,onOpen)=>{
    open=onOpen;return async()=>{};
  });
  const list=jest.spyOn(RemoteRecommendationService.prototype,'listSessions').mockResolvedValue([]);
  const get=jest.spyOn(RemoteRecommendationService.prototype,'getSession').mockResolvedValue({
    ...failedRecommendation,status:saved as 'failed'|'success',
    results:saved==='success'?[{eventId:'event-1',reasons:[]}]:[],
  });
  const credits=jest.spyOn(babyrooApi,'getCreditStatusFromBabyrooApi').mockRejectedValue(new Error('Unavailable'));
  let renderer:ReactTestRenderer.ReactTestRenderer|undefined;
  try {
    await ReactTestRenderer.act(()=>{renderer=ReactTestRenderer.create(<App/>);});
    await ReactTestRenderer.act(async()=>{await open('failed-record',push);});
    expect(renderer!.root.findAllByProps({accessibilityLabel:'Go back to recommendations'}).length>0).toBe(opensDetail);
    expect(renderer!.root.findAll(node=>node.props.accessibilityRole==='button' &&
      typeof node.props.accessibilityLabel==='string' && node.props.accessibilityLabel.includes('원래 아이')).length).toBeGreaterThan(0);
  } finally {
    await ReactTestRenderer.act(()=>renderer?.unmount());
    hook.mockRestore();list.mockRestore();get.mockRestore();credits.mockRestore();
  }
});

test.each(['nonretryable','missing-child','legacy-child'])('failed detail handles %s safely',async scenario=>{
  await saveAuthSession({...testAuthSession,apiAccessToken:'failure-edge-token'});
  const saved:RecommendationSession={...failedRecommendation,
    selectedChildIds:scenario==='legacy-child'?completeUser.activeChildIds:failedRecommendation.selectedChildIds,
    selectedChildrenSnapshot:scenario==='nonretryable'?failedRecommendation.selectedChildrenSnapshot:undefined,
    error:{...failedRecommendation.error!,retryable:scenario!=='nonretryable'},
  };
  const list=jest.spyOn(RemoteRecommendationService.prototype,'listSessions').mockResolvedValue([saved]);
  const credits=jest.spyOn(babyrooApi,'getCreditStatusFromBabyrooApi').mockRejectedValue(new Error('Unavailable'));
  const createRequest=jest.spyOn(RemoteRecommendationService.prototype,'createSession').mockResolvedValue({...saved,id:'new-request',status:'loading'});
  const alert=jest.spyOn(Alert,'alert').mockImplementation(()=>{});
  let renderer:ReactTestRenderer.ReactTestRenderer|undefined;
  try {
    await ReactTestRenderer.act(()=>{renderer=ReactTestRenderer.create(<App/>);});
    const root=renderer!.root;
    const row=root.findAll(node=>node.props.accessibilityRole==='button' &&
      typeof node.props.accessibilityLabel==='string' && node.props.accessibilityLabel.includes('방문 예정') &&
      typeof node.props.onPress==='function')[0];
    await ReactTestRenderer.act(()=>row.props.onPress());
    const retries=root.findAllByProps({accessibilityLabel:'다시 시도, 추천 완료 시 추천권 1회 사용'});
    if(scenario==='nonretryable') {
      expect(retries).toHaveLength(0);
    } else {
      await ReactTestRenderer.act(()=>retries[0].props.onPress());
      if(scenario==='missing-child') {
        expect(createRequest).not.toHaveBeenCalled();
        expect(alert).toHaveBeenCalledWith('아이 정보를 확인해 주세요',expect.stringContaining('새 추천'));
      } else {
        expect(createRequest).toHaveBeenCalledWith(expect.objectContaining({selectedChildren:completeUser.children}));
      }
    }
  } finally {
    await ReactTestRenderer.act(()=>renderer?.unmount());
    list.mockRestore();credits.mockRestore();createRequest.mockRestore();alert.mockRestore();
  }
});

test.each([
  {records: [], label: '추천 시작하기'},
  {records: ['past'], label: '추천 시작하기'},
  {records: ['past', 'past'], label: '추천 시작하기'},
  {records: ['past', 'current'], label: '다시 추천받기'},
  {records: ['current', 'current'], label: '다시 추천받기'},
])('recommendation action is $label for $records', async ({records,label}) => {
  await saveAuthSession({...testAuthSession,apiAccessToken:'cta-test-token'});
  const sessions: RecommendationSession[] = records.map((record,index)=>({
    id: String(index), userId: completeUser.id, selectedChildIds: completeUser.activeChildIds,
    createdAt: record === 'past' ? '2020-01-01T00:00:00Z' : new Date().toISOString(),
    preferences:{visitWindow:'soon'}, status:'success',
    results:[{eventId:'example-event',reasons:[]}],
    credit:{policy:'none',cost:0,consumed:false},
  }));
  const list = jest.spyOn(RemoteRecommendationService.prototype,'listSessions').mockResolvedValue(sessions);
  const credits = jest.spyOn(babyrooApi,'getCreditStatusFromBabyrooApi').mockRejectedValue(new Error('Unavailable'));
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
  try {
    await ReactTestRenderer.act(()=>{renderer=ReactTestRenderer.create(<App/>);});
    expect(renderer!.root.findByProps({accessibilityLabel:'Request recommendation'})
      .findByProps({children:label})).toBeTruthy();
  } finally {
    await ReactTestRenderer.act(()=>renderer?.unmount());
    list.mockRestore();
    credits.mockRestore();
  }
});

test('fixes the recommendation header while preserving Explore collapsing headers', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<App />);
  });
  try {
    for (const label of ['추천', '탐색']) {
      await ReactTestRenderer.act(() => {
        renderer!.root.findByProps({ accessibilityRole: 'tab', accessibilityLabel: label }).props.onPress();
      });
      const root = renderer!.root;
      expect(root.findByProps({ testID: 'stationary-tab-header' })).toBeTruthy();
      const shell = root.findByProps({ testID: 'tab-shell' });
      expect(shell.findByProps({ testID: 'stationary-tab-header' })).toBeTruthy();
      expect(StyleSheet.flatten(shell.props.style).flex).toBe(1);
      const coveredBrand = root.findByProps({ testID: 'fixed-brand-header' })
        .findAll(node => node.props.accessibilityElementsHidden === true &&
          StyleSheet.flatten(node.props.style)?.opacity === 0);
      expect(coveredBrand.length).toBeGreaterThan(0);
      const strip = root.findByProps({ accessibilityLabel: 'Tab strip' });
      if (label === '추천') {
        const header = root.findByProps({ testID: 'fixed-brand-header' });
        expect(header.findByProps({ children: 'babyroo' })).toBeTruthy();
      } else {
        expect(root.findByProps({ testID: 'fixed-brand-header' })).toBeTruthy();
        expect(strip.findByProps({ testID: 'explore-expanded-header' }).findByProps({ children: 'babyroo' })).toBeTruthy();
        expect(strip.findByProps({ testID: 'explore-compact-header' }).findByProps({ accessibilityLabel: '의견 보내기' })).toBeTruthy();
      }
      // Neither pane's vertical scroll view may own the fixed shell.
      for (const scrollView of root.findAllByType(ScrollView)) {
        expect(scrollView.findAllByProps({ testID: 'fixed-brand-header' })).toHaveLength(0);
        expect(scrollView.findAllByProps({ accessibilityLabel: 'Bottom navigation' })).toHaveLength(0);
      }
      expect(strip.findByProps({ testID: 'fixed-brand-header' })).toBeTruthy();
      expect(strip.findAllByProps({ accessibilityLabel: 'Bottom navigation' })).toHaveLength(0);
    }
    const root = renderer!.root;
    const list = root.findAll(node =>
      node.props.scrollEventThrottle === 16 && typeof node.props.onScroll === 'function',
    )[0];
    const scrollExplore = async (y: number) => {
      await ReactTestRenderer.act(() => list.props.onScroll({
        nativeEvent: {
          contentOffset: { x: 0, y },
          contentSize: { width: 390, height: 3000 },
          layoutMeasurement: { width: 390, height: 700 },
        },
      }));
    };
    // Even a partially collapsed header switches the whole pane.
    await scrollExplore(1);
    expect(root.findAllByProps({ testID: 'stationary-tab-header' })).toHaveLength(0);
    await ReactTestRenderer.act(() => {
      root.findByProps({ accessibilityRole: 'tab', accessibilityLabel: '추천' }).props.onPress();
    });
    expect(root.findAllByProps({ testID: 'stationary-tab-header' })).toHaveLength(0);
    await ReactTestRenderer.act(() => {
      root.findByProps({ accessibilityRole: 'tab', accessibilityLabel: '탐색' }).props.onPress();
    });
    await scrollExplore(150);
    expect(root.findAllByProps({ testID: 'stationary-tab-header' })).toHaveLength(0);
    await scrollExplore(0);
    expect(root.findByProps({ testID: 'stationary-tab-header' })).toBeTruthy();
  } finally {
    await ReactTestRenderer.act(() => renderer?.unmount());
  }
});

test('Explore back-to-top follows the viewport and measured recommendation area', async () => {
  const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo');
  let renderer: ReactTestRenderer.ReactTestRenderer | null = null;

  try {
    await ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(<App />);
    });
    const root = renderer!.root;
    const topButtons = () =>
      root
        .findAllByProps({ accessibilityLabel: '맨 위로' })
        .filter(node => typeof node.props.onPress === 'function');
    const topButtonStyle = () => {
      const style = topButtons()[0].props.style;
      return StyleSheet.flatten(
        typeof style === 'function' ? style({ pressed: false }) : style,
      );
    };
    const list = root.findAll(
      node =>
        node.props.scrollEventThrottle === 16 &&
        typeof node.props.onScroll === 'function',
    )[0];
    const scroll = async (y: number, contentHeight = 3000) => {
      await ReactTestRenderer.act(() => {
        list.props.onScroll({
          nativeEvent: {
            contentOffset: { x: 0, y },
            contentSize: { width: 390, height: contentHeight },
            layoutMeasurement: { width: 390, height: 700 },
          },
        });
      });
    };
    const recommendation = root
      .findAllByProps({
        accessibilityLabel: 'Open recommendation page',
      })
      .find(node => typeof node.props.onLayout === 'function')!;
    await ReactTestRenderer.act(() => {
      recommendation.props.onLayout({
        nativeEvent: { layout: { height: 80 } },
      });
    });

    const header = (mode: 'compact' | 'expanded') =>
      root.findByProps({ testID: `explore-${mode}-header` });
    const expectActiveHeader = (active: 'compact' | 'expanded') => {
      const inactive = active === 'compact' ? 'expanded' : 'compact';
      expect(header(active).props.pointerEvents).toBe('auto');
      expect(header(active).props.accessibilityElementsHidden).toBe(false);
      expect(header(inactive).props.pointerEvents).toBe('none');
      expect(header(inactive).props.importantForAccessibility).toBe(
        'no-hide-descendants',
      );
    };
    expectActiveHeader('expanded');
    await ReactTestRenderer.act(() => {
      header('expanded').props.onLayout({
        nativeEvent: { layout: { height: 240 } },
      });
      header('compact').props.onLayout({
        nativeEvent: { layout: { height: 96 } },
      });
    });
    await scroll(40);
    expectActiveHeader('expanded');
    await scroll(110);
    expectActiveHeader('compact');
    // Larger type can remeasure the header while the list is stationary.
    await ReactTestRenderer.act(() => {
      header('expanded').props.onLayout({
        nativeEvent: { layout: { height: 400 } },
      });
    });
    expectActiveHeader('expanded');
    await scroll(220);
    expectActiveHeader('compact');
    await scroll(0);
    expectActiveHeader('expanded');
    expect(topButtons()).toHaveLength(0);
    await scroll(700);
    expect(topButtons()).toHaveLength(0);
    await scroll(800);
    expect(StyleSheet.flatten(list.props.style).marginBottom).toBe(56 + 34);
    expect(StyleSheet.flatten(list.props.contentContainerStyle).paddingBottom).toBe(80 + 8);
    expect(StyleSheet.flatten(recommendation.props.style).bottom).toBe(64 + 34);
    expect(topButtons().length).toBeGreaterThan(0);
    const raisedBottom = topButtonStyle().bottom;
    expect(raisedBottom).toBe(64 + 34 + 80 + 12);
    await ReactTestRenderer.act(() => {
      recommendation.props.onLayout({
        nativeEvent: { layout: { height: 128 } },
      });
    });
    expect(topButtonStyle().bottom).toBe(64 + 34 + 128 + 12);

    await scroll(752);
    expect(StyleSheet.flatten(list.props.style).marginBottom).toBe(56 + 34);
    expect(topButtonStyle().bottom).toBe(96 + 34);
    expect(recommendation.props.pointerEvents).toBe('none');
    expect(recommendation.props.importantForAccessibility).toBe(
      'no-hide-descendants',
    );
    await ReactTestRenderer.act(() => topButtons()[0].props.onPress());
    expect(scrollTo).toHaveBeenCalledWith({ y: 0, animated: true });

    await scroll(700);
    expect(topButtons()).toHaveLength(0);
    await scroll(0);
    await scroll(900, 1000);
    expect(topButtons()).toHaveLength(0);
  } finally {
    await ReactTestRenderer.act(() => renderer?.unmount());
    scrollTo.mockRestore();
  }
});

test('keeps a back-to-top tap active while upward momentum moves and hides its target', async () => {
  const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo');
  let renderer: ReactTestRenderer.ReactTestRenderer | null = null;

  try {
    await ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(<App />);
    });
    const root = renderer!.root;
    const button = () =>
      root
        .findAllByProps({ accessibilityLabel: '맨 위로' })
        .find((node) => typeof node.props.onPress === 'function');
    const bottom = () => {
      const style = button()!.props.style;
      return StyleSheet.flatten(
        typeof style === 'function' ? style({ pressed: false }) : style,
      ).bottom;
    };
    const list = root.findAll(
      (node) =>
        node.props.scrollEventThrottle === 16 &&
        typeof node.props.onScroll === 'function',
    )[0];
    const scroll = async (y: number) => {
      await ReactTestRenderer.act(() => {
        list.props.onScroll({
          nativeEvent: {
            contentOffset: { x: 0, y },
            contentSize: { width: 390, height: 3000 },
            layoutMeasurement: { width: 390, height: 700 },
          },
        });
      });
    };

    const recommendation = root
      .findAllByProps({
        accessibilityLabel: 'Open recommendation page',
      })
      .find((node) => typeof node.props.onLayout === 'function')!;
    await ReactTestRenderer.act(() => {
      recommendation.props.onLayout({
        nativeEvent: { layout: { height: 80 } },
      });
    });
    await scroll(800);
    const originalBottom = bottom();
    await ReactTestRenderer.act(() => button()!.props.onPressIn?.());
    expect(scrollTo).not.toHaveBeenCalled();
    await scroll(752);
    expect(bottom()).toBe(originalBottom);
    await scroll(690);
    expect(button()).toBeDefined();
    const { onPress, onPressOut } = button()!.props;
    await ReactTestRenderer.act(() => {
      onPressOut();
      onPress();
    });
    expect(scrollTo).toHaveBeenCalledWith({ y: 0, animated: true });
    expect(button()).toBeUndefined();

    await scroll(1000);
    await ReactTestRenderer.act(() => button()!.props.onPressIn());
    await scroll(940);
    expect(bottom()).toBe(originalBottom);
    await ReactTestRenderer.act(() => button()!.props.onPressOut());
    expect(bottom()).toBe(96 + 34);
    expect(scrollTo).toHaveBeenCalledTimes(1);
  } finally {
    await ReactTestRenderer.act(() => renderer?.unmount());
    scrollTo.mockRestore();
  }
});

test('opens a feedback draft from Explore headers and shows the address on failure', async () => {
  const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  let renderer: ReactTestRenderer.ReactTestRenderer | null = null;

  try {
    await ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(<App />);
    });
    const feedbackButtons = renderer!.root.findByProps({ testID: 'stationary-tab-header' })
      .findAllByProps({ accessibilityLabel: '의견 보내기' })
      .filter(node => typeof node.props.onPress === 'function');
    expect(feedbackButtons).toHaveLength(1);
    for (const button of feedbackButtons) {
      await ReactTestRenderer.act(async () => button.props.onPress());
    }

    const subject = encodeURIComponent('베이비루 앱 의견');
    expect(openURL.mock.calls).toEqual(
      Array.from({ length: 1 }, () => [
        `mailto:hans.tyranos@gmail.com?subject=${subject}`,
      ]),
    );

    openURL.mockRejectedValueOnce(new Error('No mail app'));
    await ReactTestRenderer.act(async () => feedbackButtons[0].props.onPress());
    expect(alert).toHaveBeenCalledWith('메일 앱을 열 수 없어요', 'hans.tyranos@gmail.com');
  } finally {
    await ReactTestRenderer.act(() => renderer?.unmount());
    openURL.mockRestore();
    alert.mockRestore();
  }
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
    renderer!.root.findAllByProps({ children: '우리 아이에게 맞는\n나들이를 찾아볼까요?' }).length,
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

  expect(bottomNavigationStyle.paddingBottom).toBe(34);
  const exploreTab = bottomNavigation.findByProps({
    accessibilityRole: 'tab',
    accessibilityLabel: '탐색',
  });
  expect(StyleSheet.flatten(exploreTab.props.style).minHeight).toBe(56);
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

test('completes eight UI questions and submits the edited interest', async () => {
  await saveAuthSession({
    ...testAuthSession,
    apiAccessToken: 'ui-test-token',
  });
  await saveUser({
    ...completeUser,
    homeAddress: { address: '서울 광진구 구의동', sido: '서울', sigungu: '광진구' },
  });
  const createSession = jest
    .spyOn(RemoteRecommendationService.prototype, 'createSession')
    .mockResolvedValue({
      id: 'ui-session',
      createdAt: '2026-11-21T00:00:00Z',
      userId: completeUser.id,
      selectedChildIds: completeUser.activeChildIds,
      preferences: {},
      status: 'loading',
      results: [],
      credit: { policy: 'on_success_with_results', cost: 1, consumed: false },
    });
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
  try {
    await ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(<App />);
    });
    await ReactTestRenderer.act(() => {
      renderer!.root
        .findByProps({ accessibilityRole: 'tab', accessibilityLabel: '추천' })
        .props.onPress();
    });
    await ReactTestRenderer.act(() => {
      renderer!.root
        .findByProps({ accessibilityLabel: 'Request recommendation' })
        .props.onPress();
    });
    expect(
      renderer!.root.findAllByProps({ children: '지난 추천' }),
    ).toHaveLength(0);
    await ReactTestRenderer.act(() => {
      renderer!.root
        .findByProps({
          accessibilityLabel: 'Answer recommendation 출발지를 직접 입력할게요',
        })
        .props.onPress();
    });
    await selectPostcodeAddress(renderer!, '경기 수원시', { sido: '경기', sigungu: '수원시' });
    await ReactTestRenderer.act(() => {
      renderer!.root
        .findByProps({ accessibilityLabel: 'Use departure address' })
        .props.onPress();
    });
    jest.useFakeTimers();
    for (const answer of [
      '이번 주말에 갈 거예요',
      '기차나 자동차를 좋아해요',
      '가능해요',
      '날씨와 상관없이 실내로 가고 싶어요',
      '무료인 곳을 위주로 보고 싶어요',
      '예약 없이 갈 수 있는 곳이 좋아요',
      '아이가 직접 체험하는 활동이 좋아요',
    ]) {
      await ReactTestRenderer.act(() => {
        renderer!.root
          .findByProps({
            accessibilityLabel: 'Answer recommendation ' + answer,
          })
          .props.onPress();
      });
      await ReactTestRenderer.act(() => {
        jest.advanceTimersByTime(250);
      });
    }
    expect(
      renderer!.root.findByProps({ children: '이 조건으로 추천 받을까요?' }),
    ).toBeTruthy();
    expect(
      renderer!.root.findByProps({ children: '기차나 자동차를 좋아해요' }),
    ).toBeTruthy();
    expect(
      renderer!.root.findAllByProps({ children: '지난 추천' }),
    ).toHaveLength(0);
    await ReactTestRenderer.act(() => {
      renderer!.root
        .findByProps({ accessibilityLabel: 'Edit answer 이번 외출의 관심사' })
        .props.onPress();
    });
    await ReactTestRenderer.act(() => {
      renderer!.root
        .findByProps({
          accessibilityLabel: 'Answer recommendation 특별히 떠오르는 건 없어요',
        })
        .props.onPress();
    });
    await ReactTestRenderer.act(() => {
      jest.advanceTimersByTime(250);
    });
    await ReactTestRenderer.act(async () => {
      await renderer!.root
        .findByProps({ accessibilityLabel: 'Confirm recommendation request' })
        .props.onPress();
    });
    expect(createSession).toHaveBeenCalledTimes(1);
    const submitted = createSession.mock.calls[0][0];
    expect(submitted.answers).toHaveProperty('interest', 'interest_any');
    expect(submitted.preferences).toHaveProperty('interest', 'interest_any');
    expect(submitted.preferences).toMatchObject({
      startRegion: 'gyeonggi',
      departureArea: { region: '경기', locality: '수원시' },
      visitWindow: 'this_weekend',
      mobility: 'car',
      price: 'free',
    });
    expect(renderer!.root.findByProps({ children: '지난 추천' })).toBeTruthy();
  } finally {
    await ReactTestRenderer.act(() => renderer?.unmount());
    jest.useRealTimers();
    createSession.mockRestore();
  }
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
      .findByProps({ accessibilityLabel: 'Answer recommendation 출발지를 직접 입력할게요' })
      .props.onPress();
  });

  await selectPostcodeAddress(renderer!, '서울 광진구 구의동');

  await ReactTestRenderer.act(() => {
    renderer!.root
      .findByProps({ accessibilityLabel: 'Use departure address' })
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
      children: '어디에서 출발하세요?',
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

test('accepts a typed birthday when adding a child and rejects invalid dates', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer | null = null;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<App />);
  });
  await ReactTestRenderer.act(() => {
    renderer!.root.findAllByProps({ accessibilityLabel: 'Open user settings' })
      .find(node => typeof node.props.onPress === 'function')!.props.onPress();
  });
  await ReactTestRenderer.act(() => {
    renderer!.root.findByProps({ accessibilityLabel: 'Add child' }).props.onPress();
  });
  await ReactTestRenderer.act(() => {
    renderer!.root.findByProps({ placeholder: '아이 이름 또는 별명' })
      .props.onChangeText('둘째');
  });
  const input = () => renderer!.root.findByProps({ accessibilityLabel: 'New child birth date' });
  const save = () => renderer!.root.findByProps({ accessibilityLabel: 'Save child' });
  expect(renderer!.root.findByProps({ accessibilityLabel: 'Choose new child birth date' })).toBeTruthy();
  for (const value of ['20250412', '2025-04-12']) {
    await ReactTestRenderer.act(() => input().props.onChangeText(value));
    expect(input().props.value).toBe('2025-04-12');
    expect(save().props.disabled).toBe(false);
  }
  for (const [typed, formatted] of [
    ['20251', '2025-1'],
    ['2025-', '2025-'],
    ['202501', '2025-01'],
    ['2025-01-', '2025-01-'],
    ['2025012', '2025-01-2'],
    ['20250123', '2025-01-23'],
    ['2025', '2025'],
  ]) {
    await ReactTestRenderer.act(() => input().props.onChangeText(typed));
    expect(input().props.value).toBe(formatted);
  }
  for (const value of ['', '2024-02', '2024-02-30', '2024-13-01', '2999-01-01']) {
    await ReactTestRenderer.act(() => input().props.onChangeText(value));
    expect(save().props.disabled).toBe(true);
  }
  await ReactTestRenderer.act(() => input().props.onChangeText('2025-1-2'));
  await ReactTestRenderer.act(() => input().props.onBlur());
  expect(input().props.value).toBe('2025-01-02');
  expect(save().props.disabled).toBe(false);
  await ReactTestRenderer.act(() => input().props.onChangeText('2025-1-'));
  expect(input().props.value).toBe('2025-01-');
  await ReactTestRenderer.act(() => input().props.onChangeText('2025-01-2'));
  expect(input().props.value).toBe('2025-01-2');
  await ReactTestRenderer.act(() => input().props.onChangeText('2025-01-23'));
  await ReactTestRenderer.act(() => input().props.onBlur());
  expect(input().props.value).toBe('2025-01-23');
  await ReactTestRenderer.act(() => input().props.onChangeText('2024-02-29'));
  expect(save().props.disabled).toBe(false);
  await ReactTestRenderer.act(async () => save().props.onPress());
  expect((await loadUser()).children).toEqual(expect.arrayContaining([
    expect.objectContaining({ nickname: '둘째', birthDate: '2024-02-29' }),
  ]));
  await ReactTestRenderer.act(() => renderer!.unmount());
});

test('toggles recommendation children with native switches and retains one child', async () => {
  const secondChild = { ...completeUser.children[0], id: 'switch-child-002', nickname: '둘째' };
  await saveUser({ ...completeUser, children: [...completeUser.children, secondChild], activeChildIds: [completeUser.children[0].id, secondChild.id] });
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => { renderer = ReactTestRenderer.create(<App />); });
  await ReactTestRenderer.act(async () => {
    renderer.root.findAllByProps({ accessibilityLabel: 'Open user settings' }).find(node => typeof node.props.onPress === 'function')!.props.onPress();
  });
  const toggle = (nickname: string) => renderer.root.findByProps({ accessibilityLabel: `Toggle ${nickname} recommendation` });
  const saveSelection = () => renderer.root.findByProps({ accessibilityLabel: 'Save child selection' });
  expect(saveSelection().props.disabled).toBe(true);
  expect(toggle(secondChild.nickname).props.value).toBe(true);
  await ReactTestRenderer.act(async () => {
    const setIncluded = toggle(secondChild.nickname).props.onValueChange;
    setIncluded(false);
    setIncluded(false);
  });
  expect(toggle(secondChild.nickname).props.value).toBe(false);
  expect(saveSelection().props.disabled).toBe(false);
  expect((await loadUser()).activeChildIds).toEqual([completeUser.children[0].id, secondChild.id]);
  expect(toggle(completeUser.children[0].nickname).props.disabled).toBe(true);
  await ReactTestRenderer.act(async () => { toggle(secondChild.nickname).props.onValueChange(true); });
  expect(toggle(secondChild.nickname).props.value).toBe(true);
  expect(toggle(completeUser.children[0].nickname).props.disabled).toBe(false);
  expect(saveSelection().props.disabled).toBe(true);
  await ReactTestRenderer.act(async () => { toggle(secondChild.nickname).props.onValueChange(false); });
  await ReactTestRenderer.act(async () => { await saveSelection().props.onPress(); });
  expect((await loadUser()).activeChildIds).toEqual([completeUser.children[0].id]);
  expect(saveSelection().props.disabled).toBe(true);
  await ReactTestRenderer.act(async () => { renderer.unmount(); });
});

test('keeps unsaved child choices on failure, blocks duplicate saves, and retries', async () => {
  const secondChild = { ...completeUser.children[0], id: 'save-child-002', nickname: '둘째' };
  const profile = { ...completeUser, children: [...completeUser.children, secondChild], activeChildIds: [completeUser.children[0].id, secondChild.id] };
  await saveUser(profile);
  await saveAuthSession({ ...testAuthSession, apiAccessToken: 'explicit-save-token' });
  const hydrate = jest.spyOn(babyrooApi, 'getCurrentUserFromBabyrooApi').mockResolvedValue(profile);
  let fail!: (error: Error) => void;
  const update = jest.spyOn(babyrooApi, 'updateCurrentUserInBabyrooApi').mockImplementationOnce(() => new Promise((_resolve, reject) => { fail = reject; }));
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  try {
    await ReactTestRenderer.act(async () => { renderer = ReactTestRenderer.create(<App />); });
    await ReactTestRenderer.act(async () => { renderer.root.findAllByProps({ accessibilityLabel: 'Open user settings' }).find(node => typeof node.props.onPress === 'function')!.props.onPress(); });
    const toggle = () => renderer.root.findByProps({ accessibilityLabel: 'Toggle 둘째 recommendation' });
    const save = () => renderer.root.findByProps({ accessibilityLabel: 'Save child selection' });
    await ReactTestRenderer.act(async () => { toggle().props.onValueChange(false); });
    expect(update).not.toHaveBeenCalled();
    let request!: Promise<void>;
    await ReactTestRenderer.act(async () => {
      const press = save().props.onPress;
      request = press();
      await press();
    });
    expect(update).toHaveBeenCalledTimes(1);
    expect(save().props.accessibilityState.busy).toBe(true);
    expect(save().props.disabled).toBe(true);
    expect(toggle().props.disabled).toBe(true);
    await ReactTestRenderer.act(async () => { fail(new Error('offline')); await request; });
    expect(toggle().props.value).toBe(false);
    expect(save().props.disabled).toBe(false);
    expect((await loadUser()).activeChildIds).toEqual(profile.activeChildIds);
    expect(renderer.root.findAllByProps({ children: '선택을 저장하지 못했어요. 다시 시도해 주세요.' }).length).toBeGreaterThan(0);
    update.mockResolvedValueOnce({ ...profile, activeChildIds: [completeUser.children[0].id] });
    await ReactTestRenderer.act(async () => { await save().props.onPress(); });
    expect(update).toHaveBeenCalledTimes(2);
    expect((await loadUser()).activeChildIds).toEqual([completeUser.children[0].id]);
    expect(save().props.disabled).toBe(true);
  } finally {
    if (renderer) await ReactTestRenderer.act(async () => { renderer.unmount(); });
    hydrate.mockRestore();
    update.mockRestore();
  }
});

test('asks before discarding unsaved selection from close and hardware back', async () => {
  const secondChild = { ...completeUser.children[0], id: 'discard-child-002', nickname: '둘째' };
  const profile = { ...completeUser, children: [...completeUser.children, secondChild], activeChildIds: [completeUser.children[0].id, secondChild.id] };
  await saveUser(profile);
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const back = jest.spyOn(BackHandler, 'addEventListener');
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  try {
    await ReactTestRenderer.act(async () => { renderer = ReactTestRenderer.create(<App />); });
    await ReactTestRenderer.act(async () => { renderer.root.findAllByProps({ accessibilityLabel: 'Open user settings' }).find(node => typeof node.props.onPress === 'function')!.props.onPress(); });
    await ReactTestRenderer.act(async () => { renderer.root.findByProps({ accessibilityLabel: 'Toggle 둘째 recommendation' }).props.onValueChange(false); });
    await ReactTestRenderer.act(async () => { renderer.root.findByProps({ accessibilityLabel: 'Close settings' }).props.onPress(); });
    expect(alert).toHaveBeenLastCalledWith('아이 선택 변경사항', expect.any(String), expect.arrayContaining([expect.objectContaining({ text: '계속 편집' }), expect.objectContaining({ text: '변경사항 버리기' })]));
    const hardwareBack = back.mock.calls[back.mock.calls.length - 1][1];
    await ReactTestRenderer.act(async () => { expect(hardwareBack({ type: 'hardwareBackPress', timeStamp: Date.now() })).toBe(true); });
    const buttons = alert.mock.calls[alert.mock.calls.length - 1][2]!;
    await ReactTestRenderer.act(async () => { buttons.find(button => button.text === '변경사항 버리기')!.onPress!(); });
    expect(renderer.root.findAllByProps({ accessibilityLabel: 'Close settings' })).toHaveLength(0);
    expect((await loadUser()).activeChildIds).toEqual(profile.activeChildIds);
  } finally {
    if (renderer) await ReactTestRenderer.act(async () => { renderer.unmount(); });
    alert.mockRestore();
    back.mockRestore();
  }
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
      .findByProps({ testID: 'explore-filter-entry' })
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

test('hides bottom navigation while filters are open and restores it after applying or dismissing', async () => {
  const backListener = jest.spyOn(BackHandler, 'addEventListener');
  let renderer: ReactTestRenderer.ReactTestRenderer | null = null;

  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<App />);
  });

  const navigation = () =>
    renderer!.root.findAllByProps({ accessibilityLabel: 'Bottom navigation' });
  expect(navigation().length).toBeGreaterThan(0);

  for (const closeBy of ['apply', 'back']) {
    await ReactTestRenderer.act(() => {
      renderer!.root
        .findByProps({ testID: 'explore-filter-entry' })
        .props.onPress();
    });

    expect(navigation()).toHaveLength(0);

    await ReactTestRenderer.act(() => {
      if (closeBy === 'apply') {
        renderer!.root
          .findByProps({ accessibilityLabel: 'Apply filters' })
          .props.onPress();
      } else {
        const listeners = backListener.mock.calls;
        const handler = listeners[listeners.length - 1][1];
        expect(handler({} as never)).toBe(true);
      }
    });

    expect(navigation().length).toBeGreaterThan(0);
  }

  await ReactTestRenderer.act(() => renderer!.unmount());
  backListener.mockRestore();
});

test('filters schedule by scheduled and ongoing states separately', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer | null = null;

  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<App />);
  });

  await ReactTestRenderer.act(() => {
    renderer!.root
      .findByProps({ testID: 'explore-filter-entry' })
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

  expect(renderer!.root.findByProps({ testID: 'explore-filter-entry' }).props.accessibilityLabel).toContain('예정');
  expect(
    renderer!.root.findAllByProps({ children: '예정' }).length,
  ).toBeGreaterThan(0);

  await ReactTestRenderer.act(() => renderer!.unmount());
});

const exploreWorkshop: BabyrooEvent = {
    id: 'workshop',
    csvSequence: 1,
    title: '가족 놀이',
    venueName: '놀이 센터',
    region: '서울',
    locality: '종로구',
    source: 'test',
    sourceUrl: '',
    summary: '',
    category: 'experience',
    startsAt: '2020-01-01',
    endsAt: '2099-12-31',
    priceType: 'free',
    ageMinMonths: 18,
    indoor: true,
    guardianRequired: true,
    reservationStatus: 'available',
    reservationRequired: true,
    tags: ['예약필요'],
};

test('Explore distinguishes a failed load from a retry that succeeds with zero results', async () => {
  let finishRetry!: (events: BabyrooEvent[]) => void;
  const pendingRetry = new Promise<BabyrooEvent[]>(resolve => { finishRetry = resolve; });
  const fetchList = jest.spyOn(babyrooApi, 'listEventsFromBabyrooApi')
    .mockRejectedValueOnce(new Error('private server error'))
    .mockReturnValueOnce(pendingRetry);
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
    .mockClear()
    .mockImplementation(() => {});
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
  try {
    await ReactTestRenderer.act(() => { renderer = ReactTestRenderer.create(<App />); });
    const root = renderer!.root;
    const retry = () => root.findByProps({ accessibilityLabel: '다시 시도' });
    expect(root.findByProps({ children: '행사 목록을 불러오지 못했어요' })).toBeTruthy();
    expect(root.findAllByProps({ children: '조건에 맞는 행사가 없어요' })).toHaveLength(0);
    expect(root.findAllByProps({ children: 'private server error' })).toHaveLength(0);
    await ReactTestRenderer.act(() => {
      const onPress = retry().props.onPress;
      onPress();
      onPress();
    });
    expect(fetchList).toHaveBeenCalledTimes(2);
    expect(fetchList.mock.calls[1]).toEqual(fetchList.mock.calls[0]);
    expect(retry().props.accessibilityState).toEqual({ disabled: true, busy: true });
    await ReactTestRenderer.act(() => finishRetry([]));
    expect(root.findByProps({ children: '조건에 맞는 행사가 없어요' })).toBeTruthy();
    expect(root.findAllByProps({ accessibilityLabel: '다시 시도' })).toHaveLength(0);
    expect(announce.mock.calls).toEqual([
      ['행사 목록을 불러오지 못했어요'],
      ['행사 목록을 불러왔어요'],
    ]);
  } finally {
    await ReactTestRenderer.act(() => renderer?.unmount());
    fetchList.mockRestore();
    announce.mockRestore();
  }
});

test('Explore reuses a matching saved response and labels the detail during an outage', async () => {
  const fetchList = jest.spyOn(babyrooApi, 'listEventsFromBabyrooApi')
    .mockResolvedValueOnce([exploreWorkshop])
    .mockRejectedValueOnce(new Error('different filters unavailable'))
    .mockRejectedValueOnce(new Error('original filters unavailable'));
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
  try {
    await ReactTestRenderer.act(() => { renderer = ReactTestRenderer.create(<App />); });
    const root = renderer!.root;
    const category = () => root.findByProps({ accessibilityLabel: 'Toggle explore event type 상설 전시' });
    await ReactTestRenderer.act(() => category().props.onPress());
    expect(root.findAllByProps({ accessibilityLabel: 'Open 가족 놀이' })).toHaveLength(0);
    expect(root.findByProps({ children: '행사 목록을 불러오지 못했어요' })).toBeTruthy();
    await ReactTestRenderer.act(() => category().props.onPress());
    expect(fetchList.mock.calls[2]).toEqual(fetchList.mock.calls[0]);
    expect(root.findByProps({ children: '이전에 불러온 행사예요' })).toBeTruthy();
    const card = root.findByProps({ accessibilityLabel: 'Open 가족 놀이' });
    await ReactTestRenderer.act(() => card.props.onPress());
    expect(root.findByProps({
      children: '예약 가능 여부가 달라졌을 수 있어요. 방문 전 원문을 확인해 주세요.',
    })).toBeTruthy();
    expect(root.findByProps({ accessibilityLabel: 'Open source or reservation page' })).toBeTruthy();
  } finally {
    await ReactTestRenderer.act(() => renderer?.unmount());
    fetchList.mockRestore();
  }
});

test('Explore announces a background failure once when the user returns', async () => {
  let rejectLoad!: (error: Error) => void;
  const load = new Promise<BabyrooEvent[]>((_resolve, reject) => { rejectLoad = reject; });
  const fetchList = jest.spyOn(babyrooApi, 'listEventsFromBabyrooApi').mockReturnValueOnce(load);
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
    .mockClear()
    .mockImplementation(() => {});
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
  try {
    await ReactTestRenderer.act(() => { renderer = ReactTestRenderer.create(<App />); });
    const navigate = (label: string) => ReactTestRenderer.act(() => {
      renderer!.root.findByProps({ accessibilityRole: 'tab', accessibilityLabel: label }).props.onPress();
    });
    await navigate('추천');
    await ReactTestRenderer.act(() => rejectLoad(new Error('server unavailable')));
    expect(announce).not.toHaveBeenCalled();
    await navigate('탐색');
    await navigate('추천');
    await navigate('탐색');
    expect(announce.mock.calls).toEqual([['행사 목록을 불러오지 못했어요']]);
  } finally {
    await ReactTestRenderer.act(() => renderer?.unmount());
    fetchList.mockRestore();
    announce.mockRestore();
  }
});

test('Explore shows recovery when local filters hide the matching saved cards', async () => {
  const fetchList = jest.spyOn(babyrooApi, 'listEventsFromBabyrooApi')
    .mockResolvedValueOnce([exploreWorkshop])
    .mockRejectedValueOnce(new Error('other filters unavailable'))
    .mockRejectedValueOnce(new Error('original filters unavailable'));
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
  try {
    await ReactTestRenderer.act(() => { renderer = ReactTestRenderer.create(<App />); });
    const root = renderer!.root;
    const press = (props: Record<string, string>) => ReactTestRenderer.act(() => root.findByProps(props).props.onPress());
    await press({ testID: 'explore-filter-entry' });
    await press({ accessibilityLabel: 'Filter schedule 예정' });
    await press({ accessibilityLabel: 'Apply filters' });
    expect(fetchList).toHaveBeenCalledTimes(1);
    await press({ accessibilityLabel: 'Toggle explore event type 상설 전시' });
    await press({ accessibilityLabel: 'Toggle explore event type 상설 전시' });
    expect(fetchList.mock.calls[2]).toEqual(fetchList.mock.calls[0]);
    expect(root.findAllByProps({ children: '이전에 불러온 행사예요' })).toHaveLength(0);
    expect(root.findAllByProps({ children: '조건에 맞는 행사가 없어요' })).toHaveLength(0);
    expect(root.findByProps({ children: '행사 목록을 불러오지 못했어요' })).toBeTruthy();
  } finally {
    await ReactTestRenderer.act(() => renderer?.unmount());
    fetchList.mockRestore();
  }
});

test('Explore ignores a superseded response and retains only the latest successful request', async () => {
  let finishOldRequest!: (events: BabyrooEvent[]) => void;
  const oldRequest = new Promise<BabyrooEvent[]>(resolve => { finishOldRequest = resolve; });
  const fetchList = jest.spyOn(babyrooApi, 'listEventsFromBabyrooApi')
    .mockResolvedValueOnce([exploreWorkshop])
    .mockReturnValueOnce(oldRequest)
    .mockResolvedValueOnce([exploreWorkshop])
    .mockResolvedValueOnce([{ ...exploreWorkshop, id: 'latest', title: '최신 놀이' }])
    .mockRejectedValueOnce(new Error('original filters unavailable'));
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
  try {
    await ReactTestRenderer.act(() => { renderer = ReactTestRenderer.create(<App />); });
    const root = renderer!.root;
    const toggle = () => root.findByProps({ accessibilityLabel: 'Toggle explore event type 상설 전시' }).props.onPress();
    await ReactTestRenderer.act(toggle);
    await ReactTestRenderer.act(toggle);
    await ReactTestRenderer.act(() => finishOldRequest([]));
    expect(root.findByProps({ accessibilityLabel: 'Open 가족 놀이' })).toBeTruthy();
    await ReactTestRenderer.act(toggle);
    expect(root.findByProps({ accessibilityLabel: 'Open 최신 놀이' })).toBeTruthy();
    await ReactTestRenderer.act(toggle);
    expect(root.findAllByProps({ accessibilityLabel: 'Open 가족 놀이' })).toHaveLength(0);
    expect(root.findAllByProps({ accessibilityLabel: 'Open 최신 놀이' })).toHaveLength(0);
    expect(root.findByProps({ children: '행사 목록을 불러오지 못했어요' })).toBeTruthy();
  } finally {
    await ReactTestRenderer.act(() => renderer?.unmount());
    fetchList.mockRestore();
  }
});

test('Explore combines categories and shows age, venue and booking facts on each card', async () => {
  const event = exploreWorkshop;
  const fetchList = jest
    .spyOn(babyrooApi, 'listEventsFromBabyrooApi')
    .mockResolvedValue([
      event,
      {
        ...event,
        id: 'museum',
        title: '놀이 박물관 관람',
        venueName: '놀이 박물관',
        category: 'museum',
        reservationRequired: false,
      },
      {
        ...event,
        id: 'cafe',
        title: '서울형 키즈카페',
        source: 'seoul_kids_cafe',
      },
    ]);
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
  try {
    await ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(<App />);
    });
    const root = renderer!.root;
    const category = (name: string) =>
      root.findByProps({
        accessibilityLabel: 'Toggle explore event type ' + name,
      });
    const card = (title: string) =>
      root.findByProps({ accessibilityLabel: 'Open ' + title });
    expect(category('이벤트').props.accessibilityState.selected).toBe(true);
    expect(category('상설 전시').props.accessibilityState.selected).toBe(true);
    expect(
      card('가족 놀이').findByProps({ children: '놀이 센터' }),
    ).toBeTruthy();
    expect(
      card('가족 놀이').findByProps({ children: '18개월 이상 · 보호자 동반' }),
    ).toBeTruthy();
    expect(
      card('가족 놀이').findByProps({ children: '예약 필요' }),
    ).toBeTruthy();
    expect(
      card('놀이 박물관 관람').findAllByProps({ children: '놀이 박물관' }),
    ).toHaveLength(0);
    expect(
      card('놀이 박물관 관람').findAllByProps({ children: '예약 필요' }),
    ).toHaveLength(0);
    await ReactTestRenderer.act(() => category('상설 전시').props.onPress());
    expect(
      root.findAllByProps({ accessibilityLabel: 'Open 놀이 박물관 관람' }),
    ).toHaveLength(0);
    await ReactTestRenderer.act(() =>
      category('서울형 키즈카페').props.onPress(),
    );
    expect(card('서울형 키즈카페')).toBeTruthy();
  } finally {
    await ReactTestRenderer.act(() => renderer?.unmount());
    fetchList.mockRestore();
  }
});

async function selectPostcodeAddress(
  renderer: ReactTestRenderer.ReactTestRenderer,
  address: string,
  area = { sido: '서울', sigungu: '광진구' },
) {
  await ReactTestRenderer.act(() => {
    const postcodeSearchButtons = renderer.root
      .findAllByProps({
        accessibilityLabel: 'Open postcode search',
      })
      .filter(node => typeof node.props.onPress === 'function');

    postcodeSearchButtons[postcodeSearchButtons.length - 1].props.onPress();
  });

  const postcodeWebViews = renderer.root.findAll(
    node => typeof node.props.onMessage === 'function',
  );
  const postcodeWebView = postcodeWebViews[postcodeWebViews.length - 1];

  await ReactTestRenderer.act(() => {
    postcodeWebView.props.onMessage({
      nativeEvent: {
        data: JSON.stringify({
          address,
          roadAddress: address,
          ...area,
          bname: '구의동',
          zonecode: '05000',
        }),
      },
    });
  });
}

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
