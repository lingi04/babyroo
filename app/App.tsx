import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  BackHandler,
  Image,
  Linking,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker, {
  DateTimePickerAndroid,
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { type Purchase, useIAP } from 'react-native-iap';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { BabyrooEvent, eventsNewestFirst } from './src/data/events';
import {
  bottomInsetPadding,
  bottomTabsSafeArea,
  detailContentBottomPadding,
  FLOATING_RECOMMENDATION_BOTTOM,
  floatingRecommendationBottomOffset,
  MobileLayoutProvider,
  SwipeableTabs,
  TAB_BAR_HEIGHT,
  TAB_SCREEN_BOTTOM_PADDING,
  tabScreenBottomPadding,
  useBottomSafeAreaInset,
  useTabSwipePressGuard,
} from './src/mobileLayout';
import {
  Preferences,
  RecommendationAnswerMap,
  RecommendationAnswerValue,
  RecommendationDebugInfo,
  RecommendationErrorCode,
  RecommendationQuestion,
  RecommendationQuestionId,
  RecommendationQuestionOption,
  RecommendationResult,
  RecommendationSession,
  RemoteRecommendationService,
} from './src/recommendation';
import { AuthSession } from './src/auth/types';
import {
  signInWithGoogle,
  signOutFromGoogle,
} from './src/auth/GoogleAuthService';
import {
  BabyrooEventListQuery,
  BabyrooCreditStatus,
  BabyrooApiError,
  createChildInBabyrooApi,
  deleteChildFromBabyrooApi,
  getCreditStatusFromBabyrooApi,
  getCurrentUserFromBabyrooApi,
  listEventsFromBabyrooApi,
  loginWithBabyrooApi,
  updateChildInBabyrooApi,
  updateCurrentUserInBabyrooApi,
  verifyGooglePlayPurchaseInBabyrooApi,
} from './src/api/babyrooApi';
import {
  Child,
  ChildGender,
  createUserProfile,
  currentUser,
  getSelectedChildren,
  isUserProfileComplete,
  User,
  UserHomeAddress,
} from './src/data/user';
import {
  clearAuthSession,
  loadAuthSession,
  saveAuthSession,
} from './src/storage/authStorage';
import { clearSavedUser, loadUser, saveUser } from './src/storage/userStorage';
import {
  colors,
  layout,
  radius,
  shadows,
  spacing,
  typography,
} from './src/theme/tokens';

type Tab = 'home' | 'explore';
type PriceFilter = 'all' | 'free' | 'paid';
type PlaceFilter = 'all' | 'indoor' | 'outdoor';
type ReservationFilter = 'all' | 'required' | 'notRequired';
type DateFilter = 'active' | 'scheduled' | 'ongoing';
type RegionFilter = 'all' | 'seoul' | 'gyeonggi' | 'other';
type ExploreEventType = 'limitedEvent' | 'permanentVenue' | 'seoulKidsCafe';

type ExploreFilters = {
  ageFit: boolean;
  date: DateFilter;
  region: RegionFilter;
  exploreEventTypes: ExploreEventType[];
  place: PlaceFilter;
  price: PriceFilter;
  reservation: ReservationFilter;
};

const defaultExploreFilters: ExploreFilters = {
  ageFit: false,
  date: 'active',
  region: 'all',
  exploreEventTypes: ['limitedEvent'],
  place: 'all',
  price: 'all',
  reservation: 'all',
};

const exploreEventTypeOptions: Array<{
  value: ExploreEventType;
  label: string;
  icon: string;
}> = [
  { value: 'limitedEvent', label: '이벤트', icon: 'E' },
  { value: 'permanentVenue', label: '상설 전시', icon: '상' },
  { value: 'seoulKidsCafe', label: '서울형 키즈카페', icon: '키' },
];

const EXPLORE_HEADER_FULL_HEIGHT = 230;
const EXPLORE_HEADER_EXPANDED_HEIGHT = 430;
const EXPLORE_HEADER_COMPACT_HEIGHT = 92;
const EXPLORE_HEADER_COLLAPSE_DISTANCE =
  EXPLORE_HEADER_FULL_HEIGHT - EXPLORE_HEADER_COMPACT_HEIGHT;

const postcodeSearchHtml = `
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
    <style>
      html, body, #postcode {
        width: 100%;
        height: 100%;
        margin: 0;
        padding: 0;
      }
      body {
        background: #ffffff;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .loading {
        color: #667085;
        font-size: 14px;
        font-weight: 700;
        padding: 24px;
      }
    </style>
  </head>
  <body>
    <div id="postcode"><div class="loading">주소 검색을 불러오고 있어요.</div></div>
    <script src="https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js"></script>
    <script>
      function sendSelectedAddress(data) {
        var payload = JSON.stringify({
          address: data.address,
          roadAddress: data.roadAddress,
          jibunAddress: data.jibunAddress,
          zonecode: data.zonecode,
          sido: data.sido,
          sigungu: data.sigungu,
          bname: data.bname,
          buildingName: data.buildingName
        });

        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(payload);
        }

        window.location.href = 'babyroo-postcode://selected?data=' + encodeURIComponent(payload);
      }

      new kakao.Postcode({
        width: '100%',
        height: '100%',
        oncomplete: function(data) {
          sendSelectedAddress(data);
        }
      }).embed(document.getElementById('postcode'));
    </script>
  </body>
</html>
`;

function buildWeatherPlanQuestion(
  visitDay: RecommendationAnswerValue | undefined,
): RecommendationQuestion {
  return {
    id: 'weather',
    prompt: `${formatVisitWindowForWeatherQuestion(
      visitDay,
    )} 날씨를 어떻게 반영할까요?`,
    options: [
      {
        label: '날씨 괜찮으면 야외도 좋아요',
        value: 'weather_outdoor_if_suitable',
      },
      { label: '날씨 상관없이 실내로 갈래요', value: 'weather_prefer_indoor' },
      { label: '날씨 상관없이 야외가 좋아요', value: 'weather_prefer_outdoor' },
    ],
  };
}

function coreRecommendationQuestions(
  answers: RecommendationAnswerMap,
  userHomeAddress?: UserHomeAddress,
  departureAddress?: UserHomeAddress,
) {
  const homeAddressRegionValue =
    userHomeAddress && regionAnswerValueFromAddress(userHomeAddress);
  const homeAddressOption: RecommendationQuestionOption[] =
    userHomeAddress && homeAddressRegionValue
      ? [
          {
            label: `${formatShortHomeAddress(userHomeAddress)} 기준`,
            value: homeAddressRegionValue,
          },
        ]
      : [];

  return [
    {
      id: 'startRegion',
      prompt: '출발지를 선택해주세요',
      options: [
        ...homeAddressOption,
        {
          label: departureAddress
            ? `${formatShortHomeAddress(departureAddress)} 기준`
            : '출발지 입력',
          value: 'departure_input',
        },
      ],
    },
    {
      id: 'visitDay',
      prompt: '언제쯤 갈 생각인가요?',
      options: [
        { label: '1-2일 안에', value: 'visit_soon' },
        { label: '이번 주말', value: 'visit_this_weekend' },
        { label: '다음 주', value: 'visit_next_week' },
        { label: '날짜는 유연해요', value: 'visit_flexible' },
      ],
    },
    buildWeatherPlanQuestion(answers.visitDay),
    {
      id: 'mobility',
      prompt: '차로 이동할 수 있나요?',
      options: [
        { label: '가능해요', value: 'mobility_car' },
        { label: '대중교통이 좋아요', value: 'mobility_transit' },
        { label: '가까운 곳만', value: 'mobility_nearby' },
      ],
    },
    {
      id: 'vibe',
      prompt: '오늘은 어떤 분위기가 좋으세요?',
      options: [
        { label: '한적한 곳', value: 'vibe_quiet' },
        { label: '활기찬 곳', value: 'vibe_lively' },
        { label: '상관없어요', value: 'vibe_any' },
      ],
    },
    {
      id: 'priceComfort',
      prompt: '입장료는 어느 정도 괜찮으세요?',
      options: [
        { label: '무료 위주', value: 'price_free' },
        { label: '저렴하면 괜찮아요', value: 'price_low' },
        { label: '유료도 괜찮아요', value: 'price_any' },
      ],
    },
    {
      id: 'reservationComfort',
      prompt: '예약이 필요한 행사도 괜찮으세요?',
      options: [
        { label: '예약 없이 가고 싶어요', value: 'reservation_none' },
        { label: '예약 가능하면 괜찮아요', value: 'reservation_ok' },
        { label: '상관없어요', value: 'reservation_any' },
      ],
    },
  ] satisfies RecommendationQuestion[];
}

const TAB_ORDER: Tab[] = ['home', 'explore'];
const brandIcon = require('./assets/brand/babyroo-app-icon-1024.png');

function App() {
  return (
    <MobileLayoutProvider>
      <BabyrooApp />
    </MobileLayoutProvider>
  );
}

function BabyrooApp() {
  const bottomInset = useBottomSafeAreaInset();
  const { top: topInset } = useSafeAreaInsets();
  const [user, setUser] = useState<User>(currentUser);
  const [userLoaded, setUserLoaded] = useState(false);
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [browsingAsGuest, setBrowsingAsGuest] = useState(false);
  const [tab, setTab] = useState<Tab>('explore');
  const [selectedEvent, setSelectedEvent] = useState<BabyrooEvent | null>(null);
  const [events, setEvents] = useState<BabyrooEvent[]>(eventsNewestFirst);
  const [selectedRecommendationSession, setSelectedRecommendationSession] =
    useState<RecommendationSession | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [creditStatusOpen, setCreditStatusOpen] = useState(false);
  const [exploreFilters, setExploreFilters] = useState<ExploreFilters>(
    defaultExploreFilters,
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const skipNextUserSaveRef = useRef(false);
  const apiLoginAttemptedRef = useRef(false);
  const apiUserHydrationAttemptedRef = useRef(false);
  const renderTabScreen = (
    screenTab: Tab,
    navigateToTab: (tab: Tab) => void,
  ) => {
    if (screenTab === 'home') {
      if (!authSession) {
        return (
          <AuthRequiredScreen
            bottomInset={bottomInset}
            onSignIn={handleGoogleSignIn}
          />
        );
      }

      return (
        <HomeScreen
          authSession={authSession}
          events={events}
          user={user}
          onChangeAuthSession={setAuthSession}
          onOpenCredits={() => setCreditStatusOpen(true)}
          onOpenRecommendationDetail={openRecommendationDetail}
          onOpenSettings={openSettings}
          bottomInset={bottomInset}
        />
      );
    }

    if (screenTab === 'explore') {
      return (
        <ExploreScreen
          events={events}
          onChangeEvents={setEvents}
          user={user}
          filters={exploreFilters}
          onOpenEvent={openDetail}
          onOpenFilter={() => setFilterOpen(true)}
          onOpenRecommendation={() => {
            navigateToTab('home');
          }}
          onOpenSettings={openSettings}
          onToggleEventType={eventType =>
            setExploreFilters(previousFilters => ({
              ...previousFilters,
              exploreEventTypes: toggleExploreEventType(
                previousFilters.exploreEventTypes,
                eventType,
              ),
            }))
          }
          onToggleChild={toggleActiveChild}
          bottomInset={bottomInset}
        />
      );
    }

    return null;
  };
  useEffect(() => {
    let mounted = true;

    Promise.all([loadUser(), loadAuthSession()])
      .then(([savedUser, savedAuthSession]) => {
        if (mounted) {
          setUser(savedUser);
          setAuthSession(savedAuthSession);
        }
      })
      .finally(() => {
        if (mounted) {
          setUserLoaded(true);
          setAuthLoaded(true);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (userLoaded && authSession) {
      if (skipNextUserSaveRef.current) {
        skipNextUserSaveRef.current = false;
        return;
      }

      saveUser(user).catch(() => undefined);
    }
  }, [authSession, user, userLoaded]);

  useEffect(() => {
    if (
      !authLoaded ||
      !authSession ||
      authSession.apiAccessToken ||
      apiLoginAttemptedRef.current
    ) {
      return;
    }

    apiLoginAttemptedRef.current = true;

    loginWithBabyrooApi(authSession)
      .then(apiAuth => {
        const apiSession: AuthSession = {
          ...authSession,
          apiAccessToken: apiAuth.accessToken,
          apiUserId: apiAuth.user.id,
        };

        setAuthSession(apiSession);
        return Promise.all([
          saveAuthSession(apiSession),
          hydrateUserFromBabyrooApi(apiAuth.accessToken),
        ]);
      })
      .catch(error => {
        Alert.alert(
          '서버 연결 실패',
          error instanceof Error
            ? error.message
            : 'Babyroo 서버에 로그인하지 못했습니다.',
        );
      });
  }, [authLoaded, authSession]);

  useEffect(() => {
    if (
      !authLoaded ||
      !userLoaded ||
      !authSession ||
      !authSession.apiAccessToken ||
      apiUserHydrationAttemptedRef.current
    ) {
      return;
    }

    apiUserHydrationAttemptedRef.current = true;

    hydrateUserFromBabyrooApi(authSession.apiAccessToken).catch(() => {
      loginWithBabyrooApi(authSession)
        .then(apiAuth => {
          const apiSession: AuthSession = {
            ...authSession,
            apiAccessToken: apiAuth.accessToken,
            apiUserId: apiAuth.user.id,
          };

          setAuthSession(apiSession);
          return Promise.all([
            saveAuthSession(apiSession),
            hydrateUserFromBabyrooApi(apiAuth.accessToken),
          ]);
        })
        .catch(error => {
          console.warn('[Babyroo API] failed to hydrate current user', error);
        });
    });
  }, [authLoaded, authSession, userLoaded]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (filterOpen) {
          setFilterOpen(false);
          return true;
        }

        if (selectedEvent) {
          setSelectedEvent(null);
          return true;
        }

        if (selectedRecommendationSession) {
          setSelectedRecommendationSession(null);
          return true;
        }

        if (settingsOpen) {
          setSettingsOpen(false);
          return true;
        }

        if (tab !== 'explore') {
          setTab('explore');
          return true;
        }

        return false;
      },
    );

    return () => subscription.remove();
  }, [
    filterOpen,
    selectedEvent,
    selectedRecommendationSession,
    settingsOpen,
    tab,
  ]);

  const openDetail = (event: BabyrooEvent) => {
    setSelectedEvent(event);
    setFilterOpen(false);
    setSettingsOpen(false);
  };

  const closeDetail = () => setSelectedEvent(null);

  const openRecommendationDetail = (session: RecommendationSession) => {
    setSelectedRecommendationSession(session);
    setFilterOpen(false);
    setSettingsOpen(false);
  };

  const closeRecommendationDetail = () =>
    setSelectedRecommendationSession(null);

  const handleGoogleSignIn = async () => {
    const result = await signInWithGoogle();

    if (result.status === 'cancelled') {
      return;
    }

    if (result.status === 'failed') {
      Alert.alert('로그인 실패', result.message);
      return;
    }

    const nextUser =
      user.id === currentUser.id
        ? createUserProfile({
            id: `google-${result.session.providerUserId}`,
            displayName: '',
          })
        : user;

    let apiSession: AuthSession;

    try {
      const apiAuth = await loginWithBabyrooApi(result.session);
      apiSession = {
        ...result.session,
        apiAccessToken: apiAuth.accessToken,
        apiUserId: apiAuth.user.id,
      };
    } catch (error) {
      Alert.alert(
        '서버 연결 실패',
        error instanceof Error
          ? error.message
          : 'Babyroo 서버에 로그인하지 못했습니다.',
      );
      return;
    }

    const serverUser = await getCurrentUserFromBabyrooApi(
      apiSession.apiAccessToken!,
    ).catch(() => null);

    await saveAuthSession(apiSession);
    await saveUser(serverUser ?? nextUser);
    setAuthSession(apiSession);
    setBrowsingAsGuest(false);
    setUser(serverUser ?? nextUser);
  };

  const completeOnboarding = async (nextUser: User) => {
    const savedUser = await saveUserProfileToBabyrooApi(nextUser);
    await saveUser(savedUser);
    setUser(savedUser);
  };

  const signOut = async () => {
    await signOutFromGoogle().catch(() => undefined);
    await clearAuthSession().catch(() => undefined);
    setAuthSession(null);
    setBrowsingAsGuest(false);
    setSettingsOpen(false);
    setFilterOpen(false);
    setSelectedEvent(null);
    setSelectedRecommendationSession(null);
  };

  const openSettings = () => {
    if (!authSession) {
      setBrowsingAsGuest(false);
      return;
    }

    setFilterOpen(false);
    setSettingsOpen(true);
  };

  const closeSettings = () => setSettingsOpen(false);

  const hydrateUserFromBabyrooApi = async (accessToken: string) => {
    const serverUser = await getCurrentUserFromBabyrooApi(accessToken);
    await saveUser(serverUser);
    setUser(serverUser);
    return serverUser;
  };

  const saveUserProfileToBabyrooApi = async (nextUser: User) => {
    if (!authSession?.apiAccessToken) {
      return nextUser;
    }

    let serverUser = await updateCurrentUserInBabyrooApi({
      accessToken: authSession.apiAccessToken,
      user: {
        displayName: nextUser.displayName,
        homeAddress: nextUser.homeAddress,
        homeRegion: nextUser.homeRegion,
        preferredLocalities: nextUser.preferredLocalities,
      },
    });

    if (serverUser.children.length === 0 && nextUser.children.length > 0) {
      const child = nextUser.children[0];
      await createChildInBabyrooApi({
        accessToken: authSession.apiAccessToken,
        child: {
          birthDate: child.birthDate,
          gender: child.gender,
          nickname: child.nickname,
        },
      });
      serverUser = await getCurrentUserFromBabyrooApi(
        authSession.apiAccessToken,
      );
    }

    return serverUser;
  };

  const updateUserProfileOnBabyrooApi = (
    userPatch: Parameters<typeof updateCurrentUserInBabyrooApi>[0]['user'],
  ) => {
    if (!authSession?.apiAccessToken) {
      return;
    }

    updateCurrentUserInBabyrooApi({
      accessToken: authSession.apiAccessToken,
      user: userPatch,
    })
      .then(serverUser => {
        setUser(serverUser);
        return saveUser(serverUser);
      })
      .catch(error => {
        console.warn('[Babyroo API] failed to sync user profile', error);
      });
  };

  const updateHomeRegion = (homeRegion: string) => {
    setUser(previousUser => ({ ...previousUser, homeRegion }));
    updateUserProfileOnBabyrooApi({ homeRegion });
  };

  const updateHomeAddress = (homeAddress?: UserHomeAddress) => {
    const homeRegion = homeAddress?.sido
      ? regionFromAddressSido(homeAddress.sido)
      : user.homeRegion;

    setUser(previousUser => ({
      ...previousUser,
      homeAddress,
      homeRegion,
    }));
    updateUserProfileOnBabyrooApi({ homeAddress, homeRegion });
  };

  const updateDisplayName = (displayName: string) => {
    setUser(previousUser => ({ ...previousUser, displayName }));
    updateUserProfileOnBabyrooApi({ displayName });
  };

  const addChild = async (child: Omit<Child, 'id'>) => {
    const id = `child-${Date.now()}`;

    setUser(previousUser => {
      return {
        ...previousUser,
        children: [...previousUser.children, { id, ...child }],
        activeChildIds: [...previousUser.activeChildIds, id],
      };
    });

    if (authSession?.apiAccessToken) {
      createChildInBabyrooApi({
        accessToken: authSession.apiAccessToken,
        child,
      })
        .then(() => getCurrentUserFromBabyrooApi(authSession.apiAccessToken!))
        .then(serverUser => {
          setUser(serverUser);
          return saveUser(serverUser);
        })
        .catch(error => {
          console.warn('[Babyroo API] failed to create child', error);
        });
    }

    return id;
  };

  const updateChild = (
    childId: string,
    childPatch: Partial<Omit<Child, 'id'>>,
  ) => {
    setUser(previousUser => ({
      ...previousUser,
      children: previousUser.children.map(child =>
        child.id === childId ? { ...child, ...childPatch } : child,
      ),
    }));

    if (authSession?.apiAccessToken) {
      updateChildInBabyrooApi({
        accessToken: authSession.apiAccessToken,
        childId,
        childPatch,
      }).catch(error => {
        console.warn('[Babyroo API] failed to update child', error);
      });
    }
  };

  const removeChild = (childId: string) => {
    setUser(previousUser => {
      if (previousUser.children.length <= 1) {
        return previousUser;
      }

      const children = previousUser.children.filter(
        child => child.id !== childId,
      );
      const activeChildIds = previousUser.activeChildIds.filter(
        id => id !== childId,
      );

      return {
        ...previousUser,
        children,
        activeChildIds:
          activeChildIds.length > 0 ? activeChildIds : [children[0].id],
      };
    });

    if (authSession?.apiAccessToken) {
      deleteChildFromBabyrooApi({
        accessToken: authSession.apiAccessToken,
        childId,
      }).catch(error => {
        console.warn('[Babyroo API] failed to delete child', error);
      });
    }
  };

  const toggleActiveChild = (childId: string) => {
    setUser(previousUser => {
      const isActive = previousUser.activeChildIds.includes(childId);
      const activeChildIds = isActive
        ? previousUser.activeChildIds.filter(id => id !== childId)
        : [...previousUser.activeChildIds, childId];

      return {
        ...previousUser,
        activeChildIds:
          activeChildIds.length > 0
            ? activeChildIds
            : previousUser.activeChildIds,
      };
    });

    const isActive = user.activeChildIds.includes(childId);
    const activeChildIds = isActive
      ? user.activeChildIds.filter(id => id !== childId)
      : [...user.activeChildIds, childId];
    updateUserProfileOnBabyrooApi({
      activeChildIds:
        activeChildIds.length > 0 ? activeChildIds : user.activeChildIds,
    });
  };

  const resetUser = () => {
    Alert.alert(
      '사용자 정보 초기화',
      '보호자 이름, 아이 정보, 추천 기준을 처음 상태로 되돌릴까요?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '초기화',
          style: 'destructive',
          onPress: async () => {
            await clearSavedUser().catch(() => undefined);
            skipNextUserSaveRef.current = true;
            setUser(
              authSession
                ? createUserProfile({
                    id: `google-${authSession.providerUserId}`,
                    displayName: '',
                  })
                : cloneUser(currentUser),
            );
            setSettingsOpen(false);
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      {!authLoaded || !userLoaded ? (
        <View style={styles.authScreen}>
          <Text style={styles.pageTitle}>Babyroo</Text>
          <Text style={styles.pageSubtitle}>앱을 준비하고 있어요.</Text>
        </View>
      ) : !authSession && !browsingAsGuest ? (
        <AuthScreen
          eventCount={events.length}
          onBrowse={() => setBrowsingAsGuest(true)}
          onSignIn={handleGoogleSignIn}
        />
      ) : authSession && !isUserProfileComplete(user) ? (
        <OnboardingScreen
          authSession={authSession}
          initialUser={user}
          onComplete={completeOnboarding}
          onSignOut={signOut}
        />
      ) : creditStatusOpen && authSession ? (
        <CreditStatusScreen
          accessToken={authSession.apiAccessToken}
          onBack={() => setCreditStatusOpen(false)}
        />
      ) : settingsOpen ? (
        <SettingsScreen
          user={user}
          onBack={closeSettings}
          onAddChild={addChild}
          onRemoveChild={removeChild}
          onUpdateChild={updateChild}
          onUpdateDisplayName={updateDisplayName}
          onToggleChild={toggleActiveChild}
          onUpdateHomeAddress={updateHomeAddress}
          onSelectRegion={updateHomeRegion}
          onResetUser={resetUser}
          onSignOut={signOut}
        />
      ) : (
        <>
          <SwipeableTabs
            activeTab={tab}
            onChangeTab={setTab}
            renderBottomNavigation={({ activeTab, navigateToTab }) => (
              <BottomTabs
                activeTab={activeTab}
                bottomInset={bottomInset}
                onChange={navigateToTab}
              />
            )}
            renderTab={(screenTab, { navigateToTab }) =>
              renderTabScreen(screenTab, navigateToTab)
            }
            tabOrder={TAB_ORDER}
          />
          {filterOpen ? (
            <FilterSheet
              filters={exploreFilters}
              bottomInset={bottomInset}
              onChangeFilters={setExploreFilters}
              onClose={() => setFilterOpen(false)}
            />
          ) : null}
          {selectedRecommendationSession ? (
            <RecommendationSessionDetail
              bottomInset={bottomInset}
              events={events}
              questions={buildRecommendationQuestions(
                events,
                sortChildrenByAge(getSelectedChildren(user)),
                preferencesToAnswers(selectedRecommendationSession.preferences),
                user.homeAddress,
              )}
              session={selectedRecommendationSession}
              topInset={topInset}
              onBack={closeRecommendationDetail}
              onOpenEvent={openDetail}
            />
          ) : null}
          {selectedEvent ? (
            <EventDetail
              event={selectedEvent}
              bottomInset={bottomInset}
              onBack={closeDetail}
            />
          ) : null}
        </>
      )}
    </SafeAreaView>
  );
}

function AuthScreen({
  eventCount,
  onBrowse,
  onSignIn,
}: {
  eventCount: number;
  onBrowse?: () => void;
  onSignIn: () => Promise<void>;
}) {
  const [signingIn, setSigningIn] = useState(false);

  const handleSignIn = async () => {
    setSigningIn(true);
    await onSignIn().finally(() => setSigningIn(false));
  };

  return (
    <View style={styles.authScreen}>
      <View style={styles.authBrandRow}>
        <Image
          source={brandIcon}
          resizeMode="cover"
          style={styles.authLogo}
          accessibilityIgnoresInvertColors
        />
        <Text style={styles.authEyebrow}>Babyroo</Text>
      </View>
      <Text style={styles.authTitle}>아이와 갈 곳을 더 쉽게 고르세요</Text>
      <Text style={styles.authSubtitle}>
        Google 계정으로 시작하고, 추천에 필요한 가족 정보를 이어서 설정합니다.
      </Text>
      <View style={styles.authValuePanel}>
        <View style={styles.authValueItem}>
          <Text style={styles.authValueNumber}>{eventCount}</Text>
          <Text style={styles.authValueLabel}>검토할 행사</Text>
        </View>
        <View style={styles.authValueDivider} />
        <View style={styles.authValueItem}>
          <Text style={styles.authValueNumber}>맞춤</Text>
          <Text style={styles.authValueLabel}>월령/지역 기준</Text>
        </View>
      </View>
      <Pressable
        style={[styles.primaryButton, signingIn && styles.buttonDisabled]}
        onPress={handleSignIn}
        disabled={signingIn}
        accessibilityLabel="Continue with Google"
      >
        <Text style={styles.primaryButtonText}>
          {signingIn ? '로그인 중...' : 'Google로 계속하기'}
        </Text>
      </Pressable>
      {onBrowse ? (
        <Pressable
          style={styles.browseButton}
          onPress={onBrowse}
          accessibilityLabel="Browse without login"
        >
          <Text style={styles.linkText}>로그인 없이 둘러보기</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function AuthRequiredScreen({
  bottomInset,
  onSignIn,
}: {
  bottomInset: number;
  onSignIn: () => Promise<void>;
}) {
  return (
    <View
      style={[
        styles.screenWithTabs,
        tabScreenBottomPadding(bottomInset),
        styles.emptyState,
      ]}
    >
      <Text style={styles.pageTitle}>로그인이 필요해요</Text>
      <Text style={styles.pageSubtitle}>
        추천 기능은 Google 로그인 후 사용할 수 있어요.
      </Text>
      <Pressable
        style={styles.authRequiredButton}
        onPress={onSignIn}
        accessibilityLabel="Sign in for personalization"
      >
        <Text style={styles.primaryButtonText}>Google로 계속하기</Text>
      </Pressable>
    </View>
  );
}

function BabyrooBrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <View
      style={[
        styles.babyrooBrandMark,
        compact && styles.babyrooBrandMarkCompact,
      ]}
    >
      <Image
        source={brandIcon}
        resizeMode="cover"
        style={[
          styles.babyrooBrandIcon,
          compact && styles.babyrooBrandIconCompact,
        ]}
        accessibilityIgnoresInvertColors
      />
      {compact ? null : <Text style={styles.babyrooBrandText}>babyroo</Text>}
    </View>
  );
}

function OnboardingScreen({
  authSession,
  initialUser,
  onComplete,
  onSignOut,
}: {
  authSession: AuthSession;
  initialUser: User;
  onComplete: (user: User) => Promise<void>;
  onSignOut: () => Promise<void>;
}) {
  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState(
    initialUser.displayName || authSession.displayName,
  );
  const [childNickname, setChildNickname] = useState(
    initialUser.children[0]?.nickname ?? '',
  );
  const [childBirthDate, setChildBirthDate] = useState(
    initialUser.children[0]?.birthDate ?? formatDateInput(defaultBirthDate()),
  );
  const [childGender, setChildGender] = useState<ChildGender>(
    initialUser.children[0]?.gender ?? 'unknown',
  );
  const [homeRegion, setHomeRegion] = useState(initialUser.homeRegion);
  const [homeAddress, setHomeAddress] = useState<UserHomeAddress | undefined>(
    initialUser.homeAddress,
  );
  const [postcodeOpen, setPostcodeOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const canProceed =
    step === 0
      ? displayName.trim().length > 0
      : step === 1
      ? childNickname.trim().length > 0 && isValidDateInput(childBirthDate)
      : true;

  const goNext = async () => {
    if (!canProceed) {
      return;
    }

    if (step < 2) {
      setStep(previousStep => previousStep + 1);
      return;
    }

    const childId = initialUser.children[0]?.id ?? `child-${Date.now()}`;
    const nextUser: User = {
      ...initialUser,
      id: `google-${authSession.providerUserId}`,
      displayName: displayName.trim(),
      children: [
        {
          id: childId,
          nickname: childNickname.trim(),
          birthDate: childBirthDate,
          gender: childGender,
        },
      ],
      activeChildIds: [childId],
      homeRegion,
      homeAddress,
    };

    setSaving(true);
    await onComplete(nextUser).finally(() => setSaving(false));
  };

  return (
    <ScrollView contentContainerStyle={styles.onboardingScreen}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.eyebrow}>회원가입</Text>
          <Text style={styles.pageTitle}>추천 준비를 마칠게요</Text>
        </View>
        <Pressable
          style={styles.textButton}
          onPress={onSignOut}
          accessibilityLabel="Sign out"
        >
          <Text style={styles.linkText}>로그아웃</Text>
        </Pressable>
      </View>

      <Text style={styles.onboardingStepText}>Step {step + 1} / 3</Text>

      {step === 0 ? (
        <View style={styles.settingsCard}>
          <Text style={styles.settingsLabel}>사용자 닉네임</Text>
          <Text style={styles.settingsTitle}>
            앱에서 사용할 이름을 알려주세요
          </Text>
          <TextInput
            style={styles.textInput}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="예: 로아 아빠"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="nickname"
          />
        </View>
      ) : null}

      {step === 1 ? (
        <View style={styles.settingsCard}>
          <Text style={styles.settingsLabel}>자녀 정보</Text>
          <Text style={styles.settingsTitle}>
            첫 추천에 사용할 아이 정보를 입력해주세요
          </Text>
          <TextInput
            style={styles.textInput}
            value={childNickname}
            onChangeText={setChildNickname}
            placeholder="아이 이름 또는 별명"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="nickname"
          />
          <TextInput
            style={styles.textInput}
            value={childBirthDate}
            onChangeText={setChildBirthDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.muted}
            keyboardType="numbers-and-punctuation"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={styles.wrapRow}>
            {(['unknown', 'female', 'male'] as ChildGender[]).map(gender => (
              <Pressable
                key={gender}
                onPress={() => setChildGender(gender)}
                accessibilityLabel={`Select child gender ${gender}`}
              >
                <Chip
                  label={formatGender(gender)}
                  selected={gender === childGender}
                />
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {step === 2 ? (
        <View style={styles.settingsCard}>
          <Text style={styles.settingsLabel}>거주지</Text>
          <Text style={styles.settingsTitle}>
            추천에 우선 반영할 주소를 설정해주세요
          </Text>
          <AddressSummaryCard
            homeAddress={homeAddress}
            onOpenPostcode={() => setPostcodeOpen(true)}
          />
          {homeAddress ? (
            <TextInput
              style={styles.textInput}
              value={homeAddress.detailAddress ?? ''}
              onChangeText={detailAddress =>
                setHomeAddress({
                  ...homeAddress,
                  detailAddress,
                })
              }
              placeholder="상세 주소 예: 101동 1203호"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              textContentType="fullStreetAddress"
            />
          ) : null}
          <Text style={styles.settingsMeta}>
            주소 검색이 어렵다면 지역만 선택해도 추천을 시작할 수 있어요.
          </Text>
          <View style={styles.wrapRow}>
            {['서울', '경기', '기타 지역'].map(region => (
              <Pressable key={region} onPress={() => setHomeRegion(region)}>
                <Chip label={region} selected={region === homeRegion} />
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <PostcodeModal
        visible={postcodeOpen}
        onClose={() => setPostcodeOpen(false)}
        onSelect={nextAddress => {
          const keepDetailAddress = addressesShareSameBase(
            homeAddress,
            nextAddress,
          );

          setHomeAddress({
            ...nextAddress,
            detailAddress: keepDetailAddress
              ? homeAddress?.detailAddress
              : undefined,
          });
          setHomeRegion(regionFromAddressSido(nextAddress.sido));
          setPostcodeOpen(false);
        }}
      />

      <View style={styles.onboardingActions}>
        {step > 0 ? (
          <Pressable
            style={[styles.secondaryButton, styles.onboardingActionButton]}
            onPress={() =>
              setStep(previousStep => Math.max(previousStep - 1, 0))
            }
            accessibilityLabel="Previous onboarding step"
          >
            <Text style={styles.secondaryButtonText}>이전</Text>
          </Pressable>
        ) : null}
        <Pressable
          style={[
            styles.primaryButton,
            styles.onboardingActionButton,
            (!canProceed || saving) && styles.buttonDisabled,
          ]}
          onPress={goNext}
          disabled={!canProceed || saving}
          accessibilityLabel="Continue onboarding"
        >
          <Text style={styles.primaryButtonText}>
            {step === 2 ? (saving ? '저장 중...' : '시작하기') : '다음'}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function HomeScreen({
  authSession,
  events,
  user,
  onChangeAuthSession,
  onOpenCredits,
  onOpenRecommendationDetail,
  onOpenSettings,
  bottomInset,
}: {
  authSession: AuthSession;
  events: BabyrooEvent[];
  user: User;
  onChangeAuthSession: (session: AuthSession) => void;
  onOpenCredits: () => void;
  onOpenRecommendationDetail: (session: RecommendationSession) => void;
  onOpenSettings: () => void;
  bottomInset: number;
}) {
  const selectedChildren = sortChildrenByAge(getSelectedChildren(user));
  const [recommendationSessions, setRecommendationSessions] = useState<
    RecommendationSession[]
  >([]);
  const [selectedRecommendationSessionId, setSelectedRecommendationSessionId] =
    useState<string | null>(null);
  const [recommendationAnswers, setRecommendationAnswers] =
    useState<RecommendationAnswerMap>({});
  const recommendationHistoryLoadedRef = useRef<string | null>(null);
  const [recommendationFlowStep, setRecommendationFlowStep] = useState<
    'idle' | 'interview' | 'confirming'
  >('idle');
  const [creatingRecommendationSession, setCreatingRecommendationSession] =
    useState(false);
  const [recommendationQuestionIndex, setRecommendationQuestionIndex] =
    useState(0);
  const [returnToConfirmationAfterAnswer, setReturnToConfirmationAfterAnswer] =
    useState(false);
  const [creditStatus, setCreditStatus] = useState<BabyrooCreditStatus | null>(
    null,
  );
  const [creditStatusLoading, setCreditStatusLoading] = useState(true);
  const [departureAddress, setDepartureAddress] = useState<
    UserHomeAddress | undefined
  >();
  const [departureAddressModalOpen, setDepartureAddressModalOpen] =
    useState(false);
  const recommendationQuestions = useMemo(
    () =>
      buildRecommendationQuestions(
        events,
        selectedChildren,
        recommendationAnswers,
        user.homeAddress,
        departureAddress,
      ),
    [
      departureAddress,
      events,
      recommendationAnswers,
      selectedChildren,
      user.homeAddress,
    ],
  );
  const currentRecommendationQuestion =
    recommendationQuestions[recommendationQuestionIndex];
  const latestRecommendationSession = recommendationSessions[0];
  const selectedRecommendationSession =
    recommendationSessions.find(
      session => session.id === selectedRecommendationSessionId,
    ) ?? latestRecommendationSession;
  const visibleRecommendationSessions = recommendationSessions.filter(
    session =>
      session.status === 'loading' ||
      (session.status === 'success' && session.results.length > 0),
  );
  const availableCredits = creditStatus?.balance.available ?? 0;
  const hasLoadedCreditStatus = !creditStatusLoading && creditStatus !== null;
  const shouldTopUpBeforeRecommendation =
    hasLoadedCreditStatus && availableCredits <= 0;
  let recommendationCtaLabel = latestRecommendationSession
    ? '다시 추천 받기'
    : '추천 받기';

  if (creditStatusLoading) {
    recommendationCtaLabel = '추천권 확인 중...';
  } else if (shouldTopUpBeforeRecommendation) {
    recommendationCtaLabel = '추천권 구매하고 추천 받기';
  }
  const loadingRecommendationSessionIds = recommendationSessions
    .filter(session => session.status === 'loading')
    .map(session => session.id)
    .join('|');

  useEffect(() => {
    if (!authSession.apiAccessToken) {
      setCreditStatus(null);
      setCreditStatusLoading(false);
      return;
    }

    let cancelled = false;
    setCreditStatusLoading(true);

    getCreditStatusFromBabyrooApi(authSession.apiAccessToken)
      .then(nextCreditStatus => {
        if (!cancelled) {
          setCreditStatus(nextCreditStatus);
        }
      })
      .catch(error => {
        if (!cancelled) {
          setCreditStatus(null);
          console.warn('[Babyroo API] failed to load credit status', error);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCreditStatusLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authSession.apiAccessToken]);

  useEffect(() => {
    if (
      !authSession.apiAccessToken ||
      recommendationHistoryLoadedRef.current === authSession.apiAccessToken
    ) {
      return;
    }

    recommendationHistoryLoadedRef.current = authSession.apiAccessToken;

    new RemoteRecommendationService({
      accessToken: authSession.apiAccessToken,
    })
      .listSessions()
      .then(sessions => {
        setRecommendationSessions(sessions);
        setSelectedRecommendationSessionId(
          sessions.length > 0 ? sessions[0].id : null,
        );
      })
      .catch(error => {
        console.warn(
          '[Babyroo API] failed to load recommendation sessions',
          error,
        );
      });
  }, [authSession.apiAccessToken]);

  useEffect(() => {
    if (!authSession.apiAccessToken || loadingRecommendationSessionIds === '') {
      return;
    }

    let cancelled = false;
    const service = new RemoteRecommendationService({
      accessToken: authSession.apiAccessToken,
    });

    const refreshLoadingSessions = async () => {
      const loadingIds = loadingRecommendationSessionIds.split('|');
      const settledSessions = await Promise.allSettled(
        loadingIds.map(sessionId => service.getSession(sessionId)),
      );

      if (cancelled) {
        return;
      }

      const refreshedSessions = settledSessions
        .map(result => (result.status === 'fulfilled' ? result.value : null))
        .filter(
          (session): session is RecommendationSession => session !== null,
        );

      if (refreshedSessions.length === 0) {
        return;
      }

      setRecommendationSessions(previousSessions =>
        previousSessions.map(session => {
          const refreshedSession = refreshedSessions.find(
            candidate => candidate.id === session.id,
          );

          return refreshedSession ?? session;
        }),
      );
    };

    refreshLoadingSessions().catch(error => {
      console.warn(
        '[Babyroo API] failed to refresh recommendation session',
        error,
      );
    });
    const interval = setInterval(refreshLoadingSessions, 10000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [authSession.apiAccessToken, loadingRecommendationSessionIds]);

  const startRecommendationInterview = () => {
    if (shouldTopUpBeforeRecommendation) {
      onOpenCredits();
      return;
    }

    setRecommendationAnswers({});
    setDepartureAddress(undefined);
    setRecommendationQuestionIndex(0);
    setReturnToConfirmationAfterAnswer(false);
    setRecommendationFlowStep('interview');
  };

  const requestRecommendation = async (answers: RecommendationAnswerMap) => {
    if (creatingRecommendationSession) {
      return;
    }

    setCreatingRecommendationSession(true);
    let apiSession: AuthSession;

    try {
      const apiAuth = await loginWithBabyrooApi(authSession);
      apiSession = {
        ...authSession,
        apiAccessToken: apiAuth.accessToken,
        apiUserId: apiAuth.user.id,
      };
      onChangeAuthSession(apiSession);
      await saveAuthSession(apiSession);
    } catch (error) {
      Alert.alert(
        '서버 연결 실패',
        error instanceof Error
          ? error.message
          : 'Babyroo 서버에 로그인하지 못했습니다.',
      );
      setCreatingRecommendationSession(false);
      return;
    }

    const preferences = answersToPreferences(answers, departureAddress);
    const requestedAt = new Date().toISOString();

    const recommendationService = new RemoteRecommendationService({
      accessToken: apiSession.apiAccessToken,
      selectedChildren,
    });

    try {
      const createdSession = await recommendationService.createSession({
        sessionId: `recommendation-${Date.now()}`,
        userId: user.id,
        selectedChildIds: selectedChildren.map(child => child.id),
        selectedChildren,
        answers,
        preferences,
        client: {
          locale: 'ko-KR',
          timezone: 'Asia/Seoul',
          requestedAt,
        },
        debug: __DEV__,
      });

      setRecommendationSessions(previousSessions => [
        createdSession,
        ...previousSessions.filter(session => session.id !== createdSession.id),
      ]);
      setSelectedRecommendationSessionId(createdSession.id);
      setRecommendationFlowStep('idle');
    } catch (error) {
      if (
        error instanceof BabyrooApiError &&
        error.code === 'INSUFFICIENT_CREDITS'
      ) {
        Alert.alert(
          '추천권이 부족해요',
          '추천권을 충전한 뒤 다시 추천을 받아보세요.',
          [{ text: '확인', onPress: onOpenCredits }],
        );
        return;
      }

      Alert.alert(
        '추천 요청 실패',
        error instanceof Error
          ? error.message
          : '추천 요청을 서버에 저장하지 못했습니다.',
      );
    } finally {
      setCreatingRecommendationSession(false);
    }
  };

  const answerRecommendationQuestion = (
    questionId: RecommendationQuestionId,
    value: RecommendationAnswerMap[RecommendationQuestionId],
  ) => {
    if (questionId === 'startRegion' && value === 'departure_input') {
      setDepartureAddressModalOpen(true);
      return;
    }

    if (questionId === 'startRegion' && user.homeAddress) {
      setDepartureAddress(user.homeAddress);
    }

    commitRecommendationAnswer(questionId, value);
  };

  const commitRecommendationAnswer = (
    questionId: RecommendationQuestionId,
    value: RecommendationAnswerMap[RecommendationQuestionId],
  ) => {
    const nextAnswers = {
      ...recommendationAnswers,
      [questionId]: value,
    };
    const nextIndex = recommendationQuestionIndex + 1;

    setRecommendationAnswers(nextAnswers);

    if (returnToConfirmationAfterAnswer) {
      setReturnToConfirmationAfterAnswer(false);
      setRecommendationFlowStep('confirming');
      return;
    }

    if (nextIndex >= recommendationQuestions.length) {
      setRecommendationFlowStep('confirming');
      return;
    }

    setRecommendationQuestionIndex(nextIndex);
  };

  const submitDepartureAddress = (nextDepartureAddress: UserHomeAddress) => {
    setDepartureAddress(nextDepartureAddress);
    setDepartureAddressModalOpen(false);
    commitRecommendationAnswer('startRegion', 'departure_input');
  };

  const goToNextRecommendationQuestion = () => {
    const question = currentRecommendationQuestion;

    if (!question) {
      return;
    }

    const selectedAnswer = recommendationAnswers[question.id];

    if (!selectedAnswer) {
      return;
    }

    commitRecommendationAnswer(question.id, selectedAnswer);
  };

  const editRecommendationAnswer = (questionId: RecommendationQuestionId) => {
    const nextQuestionIndex = recommendationQuestions.findIndex(
      question => question.id === questionId,
    );

    if (nextQuestionIndex < 0) {
      return;
    }

    setRecommendationQuestionIndex(nextQuestionIndex);
    setReturnToConfirmationAfterAnswer(true);
    setRecommendationFlowStep('interview');
  };

  return (
    <>
      <ScrollView
        contentContainerStyle={[
          styles.screenWithTabs,
          tabScreenBottomPadding(bottomInset),
        ]}
      >
        <View style={styles.homeMasthead}>
          <View style={styles.mastheadTopRow}>
            <BabyrooBrandMark />
            <Pressable
              style={styles.mastheadIconButton}
              onPress={onOpenSettings}
              accessibilityLabel="Open user settings"
            >
              <Text style={styles.mastheadIconText}>⚙</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.recommendationSetupCard}>
          {recommendationFlowStep === 'interview' &&
          currentRecommendationQuestion ? (
            <RecommendationQuestionCard
              answers={recommendationAnswers}
              question={currentRecommendationQuestion}
              questionIndex={recommendationQuestionIndex}
              questionCount={recommendationQuestions.length}
              tone="dark"
              onAnswer={answerRecommendationQuestion}
              onBack={() =>
                setRecommendationQuestionIndex(previousIndex =>
                  Math.max(previousIndex - 1, 0),
                )
              }
              onClose={() => setRecommendationFlowStep('idle')}
              onNext={goToNextRecommendationQuestion}
              nextLabel={
                returnToConfirmationAfterAnswer ||
                recommendationQuestionIndex >= recommendationQuestions.length - 1
                  ? '확인하기'
                  : '다음 질문'
              }
            />
          ) : recommendationFlowStep === 'confirming' ? (
            <RecommendationConfirmationCard
              answers={recommendationAnswers}
              creating={creatingRecommendationSession}
              questions={recommendationQuestions}
              tone="dark"
              onConfirm={() => requestRecommendation(recommendationAnswers)}
              onClose={() => setRecommendationFlowStep('idle')}
              onEditAnswer={editRecommendationAnswer}
            />
          ) : (
            <>
              <View>
                <Text style={styles.recommendationSetupTitle}>
                  아이랑 어디 갈까요?
                </Text>
                <Text style={styles.recommendationSetupMeta}>
                  조건을 입력해 보세요.
                </Text>
              </View>

              <Pressable
                style={styles.recommendationContextRow}
                onPress={onOpenSettings}
                accessibilityLabel="Edit recommendation children"
              >
                <View>
                  <Text style={styles.recommendationContextLabel}>추천 기준</Text>
                  <Text style={styles.recommendationContextValue}>
                    {formatRecommendationCriteriaSummary(selectedChildren)}
                  </Text>
                </View>
                <Text style={styles.recommendationContextAction}>설정</Text>
              </Pressable>

              <Pressable
                style={[
                  styles.primaryButton,
                  styles.recommendationPrimaryButton,
                  creditStatusLoading && styles.buttonDisabled,
                ]}
                onPress={startRecommendationInterview}
                disabled={creditStatusLoading}
                accessibilityLabel="Request recommendation"
              >
                <Text style={styles.primaryButtonText}>
                  {recommendationCtaLabel}
                </Text>
              </Pressable>
              <Pressable
                style={styles.creditStatusTextLink}
                onPress={onOpenCredits}
                accessibilityLabel="Open recommendation credit purchases and history"
              >
                <Text style={styles.creditStatusTextLinkText}>
                  추천권 구매 및 사용 기록 보기
                </Text>
              </Pressable>
              {latestRecommendationSession ? (
                <Text style={styles.recommendationSetupFootnote}>
                  최근 추천{' '}
                  {formatRecommendationSessionTime(
                    latestRecommendationSession.createdAt,
                  )}{' '}
                  · 총 {recommendationSessions.length}회 사용
                </Text>
              ) : null}
            </>
          )}
        </View>

        <View style={styles.recommendationHistorySection}>
          <View style={styles.sectionHeaderCompact}>
            <Text style={styles.sectionTitle}>추천 기록</Text>
            <Text style={styles.sectionMeta}>
              추천받은 결과를 조건별로 다시 볼 수 있어요
            </Text>
          </View>
          {visibleRecommendationSessions.length > 0 ? (
            visibleRecommendationSessions.map(session => (
              <RecommendationSessionCard
                key={session.id}
                events={events}
                questions={recommendationQuestions}
                session={session}
                onPress={() => {
                  if (session.status === 'loading') {
                    setSelectedRecommendationSessionId(session.id);
                    return;
                  }

                  setSelectedRecommendationSessionId(session.id);
                  onOpenRecommendationDetail(session);
                }}
              />
            ))
          ) : (
            <View style={styles.recommendationHistoryEmpty}>
              <Text style={styles.emptyStateTitle}>
                아직 추천 기록이 없어요
              </Text>
              <Text style={styles.emptyStateText}>
                추천을 받으면 조건과 결과가 여기에 쌓입니다.
              </Text>
            </View>
          )}
        </View>

        {selectedRecommendationSession?.status === 'failed' ? (
          <RecommendationFailureState
            errorCode={selectedRecommendationSession.error?.code ?? 'unknown'}
            retryable={selectedRecommendationSession.error?.retryable ?? true}
            onRetry={() => requestRecommendation(recommendationAnswers)}
          />
        ) : selectedRecommendationSession?.status === 'success' &&
          selectedRecommendationSession.results.length === 0 ? (
          <View style={styles.recommendationEmptyState}>
            <Text style={styles.emptyStateTitle}>
              조건에 맞는 추천이 없어요
            </Text>
            <Text style={styles.emptyStateText}>
              일정이나 장소 조건을 넓혀서 다시 추천받아 보세요.
            </Text>
          </View>
        ) : null}
      </ScrollView>
      <DepartureAddressModal
        initialAddress={departureAddress}
        visible={departureAddressModalOpen}
        onClose={() => setDepartureAddressModalOpen(false)}
        onSubmit={submitDepartureAddress}
      />
    </>
  );
}

function RecommendationQuestionCard({
  answers,
  question,
  questionIndex,
  questionCount,
  tone = 'light',
  onAnswer,
  onBack,
  onClose,
  onNext,
  nextLabel = '다음 질문',
}: {
  answers: RecommendationAnswerMap;
  question: RecommendationQuestion;
  questionIndex: number;
  questionCount: number;
  tone?: 'light' | 'dark';
  onAnswer: (
    questionId: RecommendationQuestionId,
    value: RecommendationAnswerValue,
  ) => void;
  onBack: () => void;
  onClose: () => void;
  onNext?: () => void;
  nextLabel?: string;
}) {
  const isDark = tone === 'dark';
  const selectedValue = answers[question.id];

  return (
    <View
      style={[
        styles.recommendationQuestionCard,
        isDark && styles.recommendationQuestionCardInSetup,
      ]}
    >
      <View style={styles.recommendationQuestionHeader}>
        <View style={styles.recommendationQuestionTitleGroup}>
          <Text style={[styles.settingsLabel, isDark && styles.darkCardLabel]}>
            질문 {questionIndex + 1}/{questionCount}
          </Text>
          <Text style={[styles.settingsTitle, isDark && styles.darkCardTitle]}>
            {question.prompt}
          </Text>
        </View>
        <Pressable
          style={styles.recommendationQuestionCloseButton}
          onPress={onClose}
          accessibilityLabel="Close recommendation questions"
        >
          <Text style={[styles.linkText, isDark && styles.darkCardLinkText]}>
            닫기
          </Text>
        </Pressable>
      </View>

      <View style={styles.recommendationOptionList}>
        {question.options.map(option => {
          const selected = option.value === selectedValue;

          return (
            <Pressable
              key={option.value}
              style={[
                styles.recommendationOption,
                selected && styles.recommendationOptionSelected,
              ]}
              onPress={() => onAnswer(question.id, option.value)}
              accessibilityLabel={`Answer recommendation ${option.label}`}
            >
              <Text
                style={[
                  styles.recommendationOptionText,
                  selected && styles.recommendationOptionTextSelected,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.recommendationQuestionActions}>
        {questionIndex > 0 ? (
          <Pressable
            style={styles.recommendationBackButton}
            onPress={onBack}
            accessibilityLabel="Previous recommendation question"
          >
            <Text style={[styles.linkText, isDark && styles.darkCardLinkText]}>
              이전 질문
            </Text>
          </Pressable>
        ) : (
          <View />
        )}

        {selectedValue && onNext ? (
          <Pressable
            style={styles.recommendationNextButton}
            onPress={onNext}
            accessibilityLabel="Go to next recommendation question"
          >
            <Text style={styles.recommendationNextButtonText}>{nextLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function DepartureAddressModal({
  initialAddress,
  visible,
  onClose,
  onSubmit,
}: {
  initialAddress?: UserHomeAddress;
  visible: boolean;
  onClose: () => void;
  onSubmit: (homeAddress: UserHomeAddress) => void;
}) {
  const [draftAddress, setDraftAddress] = useState<UserHomeAddress | undefined>(
    initialAddress,
  );
  const [postcodeOpen, setPostcodeOpen] = useState(false);

  useEffect(() => {
    if (visible) {
      setDraftAddress(initialAddress);
    }
  }, [initialAddress, visible]);

  const canSubmitDepartureAddress = Boolean(draftAddress?.address.trim());
  const canEditDepartureAddressDetail = Boolean(draftAddress?.address.trim());

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.postcodeModalRoot}>
        <View style={styles.postcodeModalHeader}>
          <View>
            <Text style={styles.settingsLabel}>출발지</Text>
            <Text style={styles.postcodeModalTitle}>주소 입력</Text>
          </View>
          <Pressable
            style={styles.iconButton}
            onPress={onClose}
            accessibilityLabel="Close departure address input"
          >
            <Text style={styles.iconButtonText}>×</Text>
          </Pressable>
        </View>

        <View style={styles.departureAddressBody}>
          <AddressSummaryCard
            homeAddress={draftAddress}
            onOpenPostcode={() => setPostcodeOpen(true)}
          />
          <TextInput
            style={[
              styles.textInput,
              !canEditDepartureAddressDetail && styles.textInputDisabled,
            ]}
            value={draftAddress?.detailAddress ?? ''}
            onChangeText={detailAddress =>
              setDraftAddress(previousAddress => ({
                ...previousAddress,
                address: previousAddress?.address ?? '',
                detailAddress,
              }))
            }
            editable={canEditDepartureAddressDetail}
            placeholder={
              canEditDepartureAddressDetail
                ? '상세 주소 예: 101동 1203호'
                : '주소 검색 후 상세 주소를 입력할 수 있어요'
            }
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            textContentType="fullStreetAddress"
          />
          <Text style={styles.settingsMeta}>
            입력한 출발지는 이번 추천 조건에만 사용돼요.
          </Text>
          <Pressable
            style={[
              styles.primaryButton,
              styles.departureAddressSubmitButton,
              !canSubmitDepartureAddress && styles.buttonDisabled,
            ]}
            onPress={() => {
              if (draftAddress && canSubmitDepartureAddress) {
                onSubmit(draftAddress);
              }
            }}
            accessibilityLabel="Use departure address"
          >
            <Text style={styles.primaryButtonText}>이 주소로 출발</Text>
          </Pressable>
        </View>

        <PostcodeModal
          visible={postcodeOpen}
          onClose={() => setPostcodeOpen(false)}
          onSelect={nextAddress => {
            const keepDetailAddress = addressesShareSameBase(
              draftAddress,
              nextAddress,
            );

            setDraftAddress({
              ...nextAddress,
              detailAddress: keepDetailAddress
                ? draftAddress?.detailAddress
                : undefined,
            });
            setPostcodeOpen(false);
          }}
        />
      </SafeAreaView>
    </Modal>
  );
}

function RecommendationAnswerSummary({
  answers,
  questions,
  tone = 'light',
  onEditAnswer,
}: {
  answers: RecommendationAnswerMap;
  questions: RecommendationQuestion[];
  tone?: 'light' | 'dark';
  onEditAnswer?: (questionId: RecommendationQuestionId) => void;
}) {
  const isDark = tone === 'dark';
  const answeredQuestions = questions.filter(question =>
    Boolean(answers[question.id]),
  );

  if (answeredQuestions.length === 0) {
    return null;
  }

  return (
    <View
      style={[
        styles.recommendationAnswerSummary,
        isDark && styles.recommendationAnswerSummaryDark,
      ]}
    >
      <Text
        style={[
          styles.fieldLabel,
          styles.recommendationAnswerSummaryLabel,
          isDark && styles.darkCardLabel,
        ]}
      >
        선택한 답변
      </Text>
      <View style={styles.recommendationAnswerList}>
        {answeredQuestions.map(question => (
          <Pressable
            key={question.id}
            style={styles.recommendationAnswerItem}
            onPress={onEditAnswer ? () => onEditAnswer(question.id) : undefined}
            accessibilityLabel={`Edit answer ${recommendationQuestionLabel(
              question,
            )}`}
          >
            <Text
              style={[
                styles.recommendationAnswerQuestion,
                isDark && styles.recommendationAnswerQuestionDark,
              ]}
            >
              {recommendationQuestionLabel(question)}
            </Text>
            <Text
              style={[
                styles.recommendationAnswerValue,
                isDark && styles.recommendationAnswerValueDark,
              ]}
            >
              {recommendationAnswerLabel(question, answers[question.id])}
            </Text>
            {onEditAnswer ? (
              <Text
                style={[
                  styles.recommendationAnswerEdit,
                  isDark && styles.recommendationAnswerEditDark,
                ]}
              >
                수정
              </Text>
            ) : null}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function RecommendationConfirmationCard({
  answers,
  creating,
  tone = 'light',
  onConfirm,
  onClose,
  onEditAnswer,
  questions,
}: {
  answers: RecommendationAnswerMap;
  creating: boolean;
  tone?: 'light' | 'dark';
  onConfirm: () => void;
  onClose: () => void;
  onEditAnswer: (questionId: RecommendationQuestionId) => void;
  questions: RecommendationQuestion[];
}) {
  const isDark = tone === 'dark';

  return (
    <View
      style={[
        styles.recommendationQuestionCard,
        isDark && styles.recommendationQuestionCardInSetup,
      ]}
    >
      <View style={styles.recommendationQuestionHeader}>
        <View style={styles.recommendationQuestionTitleGroup}>
          <Text style={[styles.settingsTitle, isDark && styles.darkCardTitle]}>
            이 조건으로 추천 받을까요?
          </Text>
        </View>
        <Pressable
          style={styles.recommendationQuestionCloseButton}
          onPress={onClose}
          accessibilityLabel="Close recommendation confirmation"
        >
          <Text style={[styles.linkText, isDark && styles.darkCardLinkText]}>
            닫기
          </Text>
        </Pressable>
      </View>
      <Text style={[styles.settingsMeta, isDark && styles.darkCardMeta]}>
        추천 결과가 생성되면 추천권 1회가 사용돼요.
      </Text>
      <RecommendationAnswerSummary
        answers={answers}
        questions={questions}
        tone={tone}
        onEditAnswer={onEditAnswer}
      />
      <Pressable
        style={[
          styles.primaryButton,
          styles.recommendationConfirmButton,
          creating && styles.buttonDisabled,
        ]}
        onPress={onConfirm}
        disabled={creating}
        accessibilityLabel="Confirm recommendation request"
      >
        <Text style={styles.primaryButtonText}>
          {creating ? '추천 요청 생성중...' : '추천 받기'}
        </Text>
      </Pressable>
    </View>
  );
}

function RecommendationSessionCard({
  events,
  onPress,
  questions,
  session,
}: {
  events: BabyrooEvent[];
  onPress: () => void;
  questions: RecommendationQuestion[];
  session: RecommendationSession;
}) {
  const isLoading = session.status === 'loading';

  return (
    <Pressable
      style={[
        styles.recommendationHistoryItem,
        isLoading && styles.recommendationHistoryItemLoading,
      ]}
      onPress={onPress}
      accessibilityLabel="Open stored recommendation"
      disabled={isLoading}
    >
      <View style={styles.recommendationHistoryBody}>
        <View style={styles.recommendationHistoryHeader}>
          <Text style={styles.recommendationHistoryTitle}>
            {formatRecommendationSessionTime(session.createdAt)} 추천
          </Text>
          <Text style={styles.recommendationHistoryBadge}>
            {isLoading ? '진행중' : '보기'}
          </Text>
        </View>
        <Text style={styles.recommendationHistoryMeta} numberOfLines={1}>
          {formatRecommendationSessionChildSummary(session)}
        </Text>
        <Text style={styles.recommendationHistoryMeta} numberOfLines={1}>
          {formatRecommendationSessionAnswerSummary(session, questions)}
        </Text>
        <Text style={styles.recommendationHistoryPreview} numberOfLines={2}>
          {isLoading
            ? '아이에게 맞는 후보를 고르고 있어요'
            : formatRecommendationSessionEventPreview(session, events)}
        </Text>
      </View>
    </Pressable>
  );
}

function RecommendationFailureState({
  errorCode,
  onRetry,
  retryable,
}: {
  errorCode: RecommendationErrorCode;
  onRetry: () => void;
  retryable: boolean;
}) {
  const message = recommendationErrorMessage(errorCode);

  return (
    <View style={styles.recommendationEmptyState}>
      <Text style={styles.emptyStateTitle}>{message.title}</Text>
      <Text style={styles.emptyStateText}>{message.body}</Text>
      {retryable ? (
        <Pressable
          style={styles.retryButton}
          onPress={onRetry}
          accessibilityLabel="Retry recommendation"
        >
          <Text style={styles.linkText}>다시 시도</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function CreditStatusScreen({
  accessToken,
  onBack,
}: {
  accessToken?: string;
  onBack: () => void;
}) {
  const [status, setStatus] = useState<BabyrooCreditStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasingPackageId, setPurchasingPackageId] = useState<string | null>(
    null,
  );
  const processingPurchaseTokensRef = useRef(new Set<string>());
  const finishTransactionRef = useRef<
    ((args: { purchase: Purchase; isConsumable?: boolean }) => Promise<void>) | null
  >(null);

  const applyCreditPurchase = useCallback(
    (purchase: {
      balance: BabyrooCreditStatus['balance'];
      ledgerEntry: BabyrooCreditStatus['ledger'][number];
    }) => {
      setStatus(previousStatus =>
        previousStatus
          ? {
              ...previousStatus,
              balance: purchase.balance,
              ledger: previousStatus.ledger.some(
                entry => entry.id === purchase.ledgerEntry.id,
              )
                ? previousStatus.ledger
                : [purchase.ledgerEntry, ...previousStatus.ledger],
            }
          : previousStatus,
      );
    },
    [],
  );

  const handlePurchaseSuccess = useCallback(
    async (purchase: Purchase) => {
      if (!accessToken) {
        return;
      }

      const purchaseToken = purchase.purchaseToken;
      const productId = purchase.productId;

      if (!purchaseToken || !productId) {
        setPurchasingPackageId(null);
        Alert.alert(
          '추천권 충전 실패',
          '구매 정보를 확인하지 못했습니다. 잠시 후 다시 시도해주세요.',
        );
        return;
      }

      if (processingPurchaseTokensRef.current.has(purchaseToken)) {
        return;
      }

      processingPurchaseTokensRef.current.add(purchaseToken);

      const matchedPackage = status?.packages.find(
        creditPackage => googlePlayProductId(creditPackage) === productId,
      );

      setPurchasingPackageId(matchedPackage?.id ?? productId);

      try {
        const verifiedPurchase = await verifyGooglePlayPurchaseInBabyrooApi({
          accessToken,
          purchase: {
            productId,
            purchaseToken,
            packageName:
              'packageNameAndroid' in purchase
                ? purchase.packageNameAndroid ?? undefined
                : undefined,
          },
        });

        applyCreditPurchase(verifiedPurchase);
        await finishTransactionRef.current?.({
          purchase,
          isConsumable: true,
        });
      } catch (error) {
        Alert.alert(
          '추천권 충전 실패',
          error instanceof Error
            ? error.message
          : '추천권 충전에 실패했습니다.',
        );
      } finally {
        processingPurchaseTokensRef.current.delete(purchaseToken);
        setPurchasingPackageId(null);
      }
    },
    [accessToken, applyCreditPurchase, status?.packages],
  );

  const handlePurchaseError = useCallback((error: unknown) => {
    setPurchasingPackageId(null);

    const code =
      typeof error === 'object' && error && 'code' in error
        ? String(error.code)
        : '';

    if (code === 'user-cancelled' || code === 'E_USER_CANCELED') {
      return;
    }

    Alert.alert(
      '추천권 충전 실패',
      error instanceof Error ? error.message : '구매를 완료하지 못했습니다.',
    );
  }, []);

  const {
    connected: billingConnected,
    products: billingProducts,
    availablePurchases,
    fetchProducts,
    getAvailablePurchases,
    requestPurchase,
    finishTransaction,
  } = useIAP({
    onPurchaseSuccess: handlePurchaseSuccess,
    onPurchaseError: handlePurchaseError,
  });

  finishTransactionRef.current = finishTransaction;

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        onBack();
        return true;
      },
    );

    return () => subscription.remove();
  }, [onBack]);

  const loadStatus = useCallback(async () => {
    if (!accessToken) {
      setStatus(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      setStatus(await getCreditStatusFromBabyrooApi(accessToken));
    } catch (error) {
      Alert.alert(
        '추천권 조회 실패',
        error instanceof Error
          ? error.message
          : '추천권 정보를 불러오지 못했습니다.',
      );
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadStatus().catch(() => undefined);
  }, [loadStatus]);

  useEffect(() => {
    if (
      Platform.OS !== 'android' ||
      !billingConnected ||
      !status?.packages.length
    ) {
      return;
    }

    fetchProducts({
      skus: status.packages.map(
        creditPackage => googlePlayProductId(creditPackage),
      ),
      type: 'in-app',
    }).catch(() => undefined);
    getAvailablePurchases().catch(() => undefined);
  }, [billingConnected, fetchProducts, getAvailablePurchases, status?.packages]);

  useEffect(() => {
    if (Platform.OS !== 'android' || !accessToken || !status?.packages.length) {
      return;
    }

    const googlePlayProductIds = new Set(
      status.packages.map(creditPackage => googlePlayProductId(creditPackage)),
    );

    availablePurchases
      .filter(purchase => googlePlayProductIds.has(purchase.productId))
      .forEach(purchase => {
        handlePurchaseSuccess(purchase).catch(() => undefined);
      });
  }, [
    accessToken,
    availablePurchases,
    handlePurchaseSuccess,
    status?.packages,
  ]);

  const billingProductById = useMemo(
    () =>
      new Map(
        billingProducts.map(product => [
          product.id,
          {
            price: product.displayPrice,
          },
        ]),
      ),
    [billingProducts],
  );

  const purchasePackage = async (packageId: string) => {
    if (!accessToken || purchasingPackageId) {
      return;
    }

    const creditPackage = status?.packages.find(
      candidate => candidate.id === packageId,
    );

    if (!creditPackage) {
      return;
    }

    if (Platform.OS !== 'android') {
      Alert.alert(
        '추천권 충전 안내',
        '현재 추천권 결제는 Android Google Play에서 사용할 수 있습니다.',
      );
      return;
    }

    if (!billingConnected) {
      Alert.alert(
        '추천권 충전 준비 중',
        'Google Play 결제 연결을 준비하고 있습니다. 잠시 후 다시 시도해주세요.',
      );
      return;
    }

    setPurchasingPackageId(packageId);

    try {
      await requestPurchase({
        request: {
          google: {
            skus: [googlePlayProductId(creditPackage)],
          },
        },
        type: 'in-app',
      });
    } catch (error) {
      setPurchasingPackageId(null);
      Alert.alert(
        '추천권 충전 실패',
        error instanceof Error ? error.message : '구매를 시작하지 못했습니다.',
      );
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.settingsScreen}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.pageTitle}>추천권 현황</Text>
        </View>
        <Pressable
          style={styles.iconButton}
          onPress={onBack}
          accessibilityLabel="Close credit status"
        >
          <Text style={styles.iconButtonText}>×</Text>
        </Pressable>
      </View>

      <View style={styles.creditBalanceCard}>
        <Text style={styles.settingsLabel}>잔여 추천권</Text>
        <Text style={styles.creditBalanceValue}>
          {loading ? '-' : status?.balance.available ?? 0}
        </Text>
        <Text style={styles.settingsMeta}>
          추천 결과가 생성되면 1회 차감돼요.
        </Text>
      </View>

      <View style={styles.settingsSection}>
        <Text style={styles.sectionTitle}>추천권 충전</Text>
        {status?.packages
          .filter(creditPackage => creditPackage.credits !== 12)
          .map(creditPackage => {
          const billingProduct = billingProductById.get(
            googlePlayProductId(creditPackage),
          );

          return (
            <Pressable
              key={creditPackage.id}
              style={[
                styles.creditPackageCard,
                purchasingPackageId === creditPackage.id &&
                  styles.buttonDisabled,
              ]}
              onPress={() => purchasePackage(creditPackage.id)}
              disabled={Boolean(purchasingPackageId)}
              accessibilityLabel={`Purchase ${creditPackage.label}`}
            >
              <View>
                <Text style={styles.creditPackageTitle}>
                  {creditPackage.label}
                </Text>
                <Text style={styles.creditPackageMeta}>
                  {billingProduct?.price ?? formatKrw(creditPackage.priceKrw)}
                </Text>
              </View>
              <Text style={styles.recommendationContextAction}>
                {purchasingPackageId === creditPackage.id ? '처리중' : '구매'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.settingsSection}>
        <Text style={styles.sectionTitle}>사용 내역</Text>
        {status && status.ledger.length > 0 ? (
          status.ledger.map(entry => (
            <View key={entry.id} style={styles.creditLedgerItem}>
              <View>
                <Text style={styles.creditLedgerReason}>
                  {formatCreditReason(entry.reason)}
                </Text>
                <Text style={styles.creditLedgerDate}>
                  {formatRecommendationSessionTime(entry.createdAt)}
                </Text>
              </View>
              <Text
                style={[
                  styles.creditLedgerAmount,
                  entry.amount > 0 && styles.creditLedgerAmountPositive,
                ]}
              >
                {entry.amount > 0 ? '+' : ''}
                {entry.amount}
              </Text>
            </View>
          ))
        ) : (
          <View style={styles.recommendationHistoryEmpty}>
            <Text style={styles.emptyStateTitle}>
              아직 사용 내역이 없어요
            </Text>
            <Text style={styles.emptyStateText}>
              추천권을 충전하거나 추천을 완료하면 여기에 기록됩니다.
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function RecommendationDebugPrompt({
  debug,
}: {
  debug: RecommendationDebugInfo;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.recommendationDebugPrompt}>
      <Pressable
        style={styles.recommendationDebugHeader}
        onPress={() => setExpanded(previousExpanded => !previousExpanded)}
        accessibilityLabel="Toggle recommendation debug"
      >
        <Text style={styles.recommendationDebugTitle}>
          Recommendation Debug
        </Text>
        <Text style={styles.recommendationDebugToggle}>
          {expanded ? '접기' : '펼치기'}
        </Text>
      </Pressable>

      {expanded ? (
        <>
          {debug.prompt ? (
            <>
              <Text style={styles.recommendationDebugLabel}>DEBUG PROMPT</Text>
              <Text style={styles.recommendationDebugText} selectable>
                {debug.prompt}
              </Text>
            </>
          ) : null}
          {debug.rawResponse ? (
            <>
              <Text style={styles.recommendationDebugLabel}>
                DEBUG RAW RESPONSE
              </Text>
              <Text style={styles.recommendationDebugText} selectable>
                {debug.rawResponse}
              </Text>
            </>
          ) : null}
          {debug.normalizedResponse ? (
            <>
              <Text style={styles.recommendationDebugLabel}>
                DEBUG NORMALIZED RESULT
              </Text>
              <Text style={styles.recommendationDebugText} selectable>
                {JSON.stringify(debug.normalizedResponse, null, 2)}
              </Text>
            </>
          ) : null}
        </>
      ) : (
        <Text style={styles.recommendationDebugCollapsedText}>
          프롬프트와 응답 원문은 펼쳐서 확인할 수 있어요.
        </Text>
      )}
    </View>
  );
}

function ExploreScreen({
  events,
  onChangeEvents,
  user,
  filters,
  onOpenEvent,
  onOpenFilter,
  onOpenRecommendation,
  onOpenSettings,
  onToggleEventType,
  onToggleChild,
  bottomInset,
}: {
  events: BabyrooEvent[];
  onChangeEvents: (events: BabyrooEvent[]) => void;
  user: User;
  filters: ExploreFilters;
  onOpenEvent: (event: BabyrooEvent) => void;
  onOpenFilter: () => void;
  onOpenRecommendation: () => void;
  onOpenSettings: () => void;
  onToggleEventType: (eventType: ExploreEventType) => void;
  onToggleChild: (childId: string) => void;
  bottomInset: number;
}) {
  const selectedChildren = sortChildrenByAge(getSelectedChildren(user));
  const childrenByAge = sortChildrenByAge(user.children);
  const searchQuery = '';
  const exploreScrollY = useRef(new Animated.Value(0)).current;
  const [eventsLoaded, setEventsLoaded] = useState(false);
  const [recommendationCtaVisible, setRecommendationCtaVisible] =
    useState(false);
  const [compactHeaderTouchable, setCompactHeaderTouchable] = useState(false);
  const [exploreControlsCollapsed, setExploreControlsCollapsed] =
    useState(true);
  const activeFilterCount = countActiveExploreFilters(filters);
  const filteredEvents = useMemo(
    () => filterEvents(events, searchQuery, filters, selectedChildren),
    [events, filters, searchQuery, selectedChildren],
  );
  const activeFilterLabels = getActiveExploreFilterLabels(filters);
  const exploreEventTypeSummary = formatExploreEventTypeSummary(
    filters.exploreEventTypes,
  );
  const exploreIntentSummary = formatExploreIntentSummary(
    selectedChildren,
    activeFilterLabels,
    exploreEventTypeSummary,
  );
  const eventListQueryKey = useMemo(
    () =>
      JSON.stringify(
        buildExploreEventListQuery(searchQuery, filters, selectedChildren),
      ),
    [filters, searchQuery, selectedChildren],
  );

  useEffect(() => {
    let mounted = true;
    const eventListQuery = JSON.parse(
      eventListQueryKey,
    ) as BabyrooEventListQuery;

    console.warn(
      `[Babyroo Explore] loading events from API with query ${JSON.stringify(
        eventListQuery,
      )}`,
    );
    setEventsLoaded(false);
    listEventsFromBabyrooApi(eventListQuery)
      .then(apiEvents => {
        if (mounted) {
          console.warn(
            `[Babyroo Explore] loaded ${apiEvents.length} events from API`,
          );
          onChangeEvents(apiEvents);
        }
      })
      .catch(error => {
        if (mounted) {
          console.warn(
            '[Babyroo Explore] failed to load events from API',
            error,
          );
          Alert.alert(
            '행사 데이터를 불러오지 못했어요',
            error instanceof Error
              ? error.message
              : 'Babyroo 서버에서 행사 목록을 가져오지 못했습니다.',
          );
        }
      })
      .finally(() => {
        if (mounted) {
          setEventsLoaded(true);
        }
      });

    return () => {
      mounted = false;
    };
  }, [eventListQueryKey, onChangeEvents]);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const scrollOffsetY = event.nativeEvent.contentOffset.y;
    const nextVisible = scrollOffsetY > 420;
    const nextCompactTouchable = compactHeaderTouchable
      ? scrollOffsetY > 44
      : scrollOffsetY > 78;
    const shouldCollapseOpenControls =
      !exploreControlsCollapsed && scrollOffsetY > 12;

    if (nextVisible !== recommendationCtaVisible) {
      setRecommendationCtaVisible(nextVisible);
    }

    if (nextCompactTouchable !== compactHeaderTouchable) {
      setCompactHeaderTouchable(nextCompactTouchable);
    }

    if (shouldCollapseOpenControls) {
      setExploreControlsCollapsed(true);
    }
  };
  const animatedFixedHeaderHeight = exploreScrollY.interpolate({
    inputRange: [0, 40, EXPLORE_HEADER_COLLAPSE_DISTANCE],
    outputRange: [
      EXPLORE_HEADER_FULL_HEIGHT,
      176,
      EXPLORE_HEADER_COMPACT_HEIGHT,
    ],
    extrapolate: 'clamp',
  });
  const brandRowOpacity = exploreScrollY.interpolate({
    inputRange: [0, 16, 40],
    outputRange: [1, 0.7, 0],
    extrapolate: 'clamp',
  });
  const brandRowTranslateY = exploreScrollY.interpolate({
    inputRange: [0, 40],
    outputRange: [0, -8],
    extrapolate: 'clamp',
  });
  const eventTypeOpacity = exploreScrollY.interpolate({
    inputRange: [12, 44, 64],
    outputRange: [1, 0.45, 0],
    extrapolate: 'clamp',
  });
  const eventTypeTranslateY = exploreScrollY.interpolate({
    inputRange: [12, 64],
    outputRange: [0, -10],
    extrapolate: 'clamp',
  });
  const mastheadOpacity = exploreScrollY.interpolate({
    inputRange: [36, 72, EXPLORE_HEADER_COLLAPSE_DISTANCE],
    outputRange: [1, 0.5, 0],
    extrapolate: 'clamp',
  });
  const mastheadTranslateY = exploreScrollY.interpolate({
    inputRange: [36, EXPLORE_HEADER_COLLAPSE_DISTANCE],
    outputRange: [0, -14],
    extrapolate: 'clamp',
  });
  const compactHeaderOpacity = exploreScrollY.interpolate({
    inputRange: [48, 76, EXPLORE_HEADER_COLLAPSE_DISTANCE],
    outputRange: [0, 0.45, 1],
    extrapolate: 'clamp',
  });
  const compactHeaderTranslateY = exploreScrollY.interpolate({
    inputRange: [48, EXPLORE_HEADER_COLLAPSE_DISTANCE],
    outputRange: [8, 0],
    extrapolate: 'clamp',
  });
  const compactHeaderScale = exploreScrollY.interpolate({
    inputRange: [48, EXPLORE_HEADER_COLLAPSE_DISTANCE],
    outputRange: [0.98, 1],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.exploreRoot}>
      <Animated.View
        style={[
          styles.exploreFixedHeader,
          {
            height: exploreControlsCollapsed
              ? animatedFixedHeaderHeight
              : EXPLORE_HEADER_EXPANDED_HEIGHT,
          },
        ]}
      >
        <Animated.View
          pointerEvents={
            exploreControlsCollapsed && compactHeaderTouchable ? 'auto' : 'none'
          }
          style={[
            styles.exploreCompactHeader,
            {
              opacity: compactHeaderOpacity,
              transform: [
                { translateY: compactHeaderTranslateY },
                { scale: compactHeaderScale },
              ],
            },
            !exploreControlsCollapsed && styles.exploreHiddenHeaderLayer,
          ]}
        >
          <BabyrooBrandMark compact />
          <Pressable
            style={styles.exploreCompactSummary}
            onPress={() => setExploreControlsCollapsed(false)}
            accessibilityLabel="Open exploration conditions"
          >
            <Text
              style={styles.exploreCompactTitle}
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.88}
            >
              {exploreIntentSummary.title}
            </Text>
            <Text style={styles.exploreCompactMeta} numberOfLines={1}>
              {exploreIntentSummary.meta}
            </Text>
          </Pressable>
          <Pressable
            style={styles.exploreCompactIconButton}
            onPress={onOpenSettings}
            accessibilityLabel="Open user settings"
          >
            <Text style={styles.exploreCompactIconText}>⚙</Text>
          </Pressable>
        </Animated.View>

        <Animated.View
          pointerEvents={
            exploreControlsCollapsed && compactHeaderTouchable ? 'none' : 'auto'
          }
          style={styles.exploreFullHeader}
        >
          <Animated.View
            style={[
              styles.exploreTopHeader,
              exploreControlsCollapsed && {
                opacity: brandRowOpacity,
                transform: [{ translateY: brandRowTranslateY }],
              },
            ]}
          >
            <BabyrooBrandMark />
            <Pressable
              style={styles.mastheadIconButton}
              onPress={onOpenSettings}
              accessibilityLabel="Open user settings"
            >
              <Text style={styles.mastheadIconText}>⚙</Text>
            </Pressable>
          </Animated.View>

          <Animated.View
            style={[
              styles.eventTypeSelector,
              exploreControlsCollapsed && {
                opacity: eventTypeOpacity,
                transform: [{ translateY: eventTypeTranslateY }],
              },
            ]}
          >
            {exploreEventTypeOptions.map(option => {
              const selected = filters.exploreEventTypes.includes(option.value);

              return (
                <Pressable
                  key={option.value}
                  style={[
                    styles.eventTypeOption,
                    selected && styles.eventTypeOptionSelected,
                  ]}
                  onPress={() => onToggleEventType(option.value)}
                  accessibilityLabel={`Toggle explore event type ${option.label}`}
                >
                  <View
                    style={[
                      styles.eventTypeIcon,
                      selected && styles.eventTypeIconSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.eventTypeIconText,
                        selected && styles.eventTypeIconTextSelected,
                      ]}
                    >
                      {option.icon}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.eventTypeLabel,
                      selected && styles.eventTypeLabelSelected,
                    ]}
                    numberOfLines={2}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </Animated.View>

          <Animated.View
            style={[
              styles.exploreMasthead,
              exploreControlsCollapsed && {
                opacity: mastheadOpacity,
                transform: [{ translateY: mastheadTranslateY }],
              },
            ]}
          >
            <Pressable
              style={styles.exploreControlsHeader}
              onPress={() =>
                setExploreControlsCollapsed(
                  previousCollapsed => !previousCollapsed,
                )
              }
              accessibilityLabel="Toggle exploration controls"
            >
              <View style={styles.exploreControlsSummaryArea}>
                <View style={styles.exploreControlsTitleRow}>
                  <View style={styles.exploreCriteriaSummaryBlock}>
                    <Text style={styles.exploreIntentTitle} numberOfLines={2}>
                      {exploreIntentSummary.title}
                    </Text>
                    <Text style={styles.exploreIntentMeta} numberOfLines={1}>
                      {exploreIntentSummary.meta}
                    </Text>
                  </View>
                </View>
              </View>
              <View style={styles.exploreControlsChevronButton}>
                <View
                  style={[
                    styles.exploreControlsChevronGlyph,
                    exploreControlsCollapsed
                      ? styles.exploreControlsChevronGlyphDown
                      : styles.exploreControlsChevronGlyphUp,
                  ]}
                />
              </View>
            </Pressable>

            {exploreControlsCollapsed ? null : (
              <>
                <View
                  style={[
                    styles.exploreControlDivider,
                    styles.exploreControlDividerInMasthead,
                  ]}
                />

                <View style={styles.exploreControlSection}>
                  <Text
                    style={[
                      styles.exploreControlLabel,
                      styles.exploreControlLabelInMasthead,
                    ]}
                  >
                    아이 월령 기준
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.childChipRow}
                  >
                    {childrenByAge.map(child => {
                      const selected = user.activeChildIds.includes(child.id);

                      return (
                        <Pressable
                          key={child.id}
                          onPress={() => onToggleChild(child.id)}
                          accessibilityLabel={`Toggle ${child.nickname} exploration age context`}
                        >
                          <ChildContextChip child={child} selected={selected} />
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>

                <View
                  style={[
                    styles.exploreControlDivider,
                    styles.exploreControlDividerInMasthead,
                  ]}
                />

                <View
                  style={[
                    styles.exploreControlSection,
                    styles.exploreFilterSection,
                  ]}
                >
                  <Text
                    style={[
                      styles.exploreControlLabel,
                      styles.exploreControlLabelInMasthead,
                    ]}
                  >
                    필터
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.chipRow}
                  >
                    {activeFilterLabels.map(chip => (
                      <Chip key={chip} label={chip} selected />
                    ))}
                    <Pressable
                      onPress={onOpenFilter}
                      accessibilityLabel="Open filters"
                    >
                      <Chip
                        label={
                          activeFilterCount > 0
                            ? `필터 ${activeFilterCount}`
                            : '필터'
                        }
                      />
                    </Pressable>
                  </ScrollView>
                </View>
              </>
            )}
          </Animated.View>
        </Animated.View>
      </Animated.View>

      <Animated.FlatList
        style={styles.exploreList}
        data={filteredEvents}
        keyExtractor={event => event.id}
        renderItem={({ item, index }) => (
          <EventCard
            event={item}
            tone={index}
            showSequence
            onPress={() => onOpenEvent(item)}
          />
        )}
        contentContainerStyle={[
          styles.exploreListContent,
          {
            paddingTop:
              (exploreControlsCollapsed
                ? EXPLORE_HEADER_FULL_HEIGHT
                : EXPLORE_HEADER_EXPANDED_HEIGHT) + spacing.lg,
          },
          tabScreenBottomPadding(bottomInset),
        ]}
        ListEmptyComponent={
          <View style={styles.noResultsCard}>
            <Text style={styles.noResultsTitle}>
              {eventsLoaded
                ? '조건에 맞는 행사가 없어요'
                : '행사 데이터를 불러오고 있어요'}
            </Text>
            <Text style={styles.noResultsText}>
              {eventsLoaded
                ? '검색어를 줄이거나 필터를 넓혀서 다시 찾아보세요.'
                : 'Babyroo 서버에서 최신 행사 목록을 가져오는 중입니다.'}
            </Text>
          </View>
        }
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: exploreScrollY } } }],
          { useNativeDriver: false, listener: handleScroll },
        )}
        removeClippedSubviews
        scrollEventThrottle={16}
        updateCellsBatchingPeriod={50}
        windowSize={7}
      />

      {recommendationCtaVisible ? (
        <Pressable
          style={[
            styles.floatingRecommendationCta,
            floatingRecommendationBottomOffset(bottomInset),
          ]}
          onPress={onOpenRecommendation}
          accessibilityLabel="Open recommendation page"
        >
          <View>
            <Text style={styles.floatingRecommendationTitle}>
              고르기 어렵다면
            </Text>
            <Text style={styles.floatingRecommendationText}>
              아이에게 맞는 후보만 추천받기
            </Text>
          </View>
          <Text style={styles.floatingRecommendationBadge}>추천 1회</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function EventDetail({
  event,
  bottomInset,
  onBack,
}: {
  event: BabyrooEvent;
  bottomInset: number;
  onBack: () => void;
}) {
  const openSourceUrl = () => {
    Linking.openURL(event.sourceUrl).catch(() => {
      Alert.alert('페이지를 열 수 없어요', '잠시 후 다시 시도해 주세요.');
    });
  };

  return (
    <View style={styles.detailRoot}>
      <ScrollView
        contentContainerStyle={[
          styles.detailContent,
          detailContentBottomPadding(bottomInset),
        ]}
      >
        <View style={styles.detailHero}>
          {event.imageUrl ? (
            <Image
              source={{ uri: event.imageUrl }}
              resizeMode="cover"
              style={styles.detailHeroImage}
              accessibilityIgnoresInvertColors
            />
          ) : (
            <EventThumbnailFallback event={event} tone={event.csvSequence} />
          )}
          <View style={styles.detailHeroScrim} />
          <Pressable
            style={styles.backButton}
            onPress={onBack}
            accessibilityLabel="Go back"
          >
            <Text style={styles.backButtonText}>‹</Text>
          </Pressable>
          <Text style={styles.heroSource}>{event.source}</Text>
        </View>

        <View style={styles.detailPanel}>
          <View style={styles.detailPills}>
            <Chip label={`${event.source} · ${event.category}`} selected />
          </View>
          <Text style={styles.detailTitle}>{event.title}</Text>
          <Text style={styles.detailMeta}>
            {event.region} {event.locality} · {formatDateRange(event)}
          </Text>

          <View style={styles.factGrid}>
            <Fact label="월령" value={formatAge(event)} />
            <Fact
              label="가격"
              value={event.priceText || formatPriceType(event.priceType)}
            />
            <Fact label="예약" value={formatReservation(event)} />
            <Fact label="장소" value={event.venueName} />
            {event.venueDetail ? (
              <Fact label="상세위치" value={event.venueDetail} />
            ) : null}
          </View>

          <Text style={styles.sectionTitle}>행사 소개</Text>
          <Text style={styles.bodyText}>{event.summary}</Text>

          <Text style={styles.sectionTitle}>태그</Text>
          <View style={styles.wrapRow}>
            {event.tags.slice(0, 6).map(tag => (
              <Chip key={tag} label={tag} />
            ))}
          </View>
        </View>
      </ScrollView>

      <View
        style={[styles.ctaBar, bottomInsetPadding(bottomInset, spacing.xl)]}
      >
        <Pressable
          style={styles.primaryButton}
          onPress={openSourceUrl}
          accessibilityLabel="Open source or reservation page"
          accessibilityRole="link"
        >
          <Text style={styles.primaryButtonText}>원문 / 예약 페이지 열기</Text>
        </Pressable>
      </View>
    </View>
  );
}

function RecommendationSessionDetail({
  bottomInset,
  events,
  onBack,
  onOpenEvent,
  questions,
  session,
  topInset,
}: {
  bottomInset: number;
  events: BabyrooEvent[];
  onBack: () => void;
  onOpenEvent: (event: BabyrooEvent) => void;
  questions: RecommendationQuestion[];
  session: RecommendationSession;
  topInset: number;
}) {
  const recommendedEvents = session.results
    .map(result =>
      [...(session.eventSnapshots ?? []), ...events].find(
        event => event.id === result.eventId,
      ),
    )
    .filter((event): event is BabyrooEvent => Boolean(event));

  return (
    <View style={styles.detailRoot}>
      <ScrollView
        contentContainerStyle={[
          styles.recommendationDetailContent,
          { paddingTop: spacing.xl + topInset },
          detailContentBottomPadding(bottomInset),
        ]}
      >
        <View style={styles.recommendationDetailHeader}>
          <Pressable
            style={styles.recommendationDetailBackButton}
            onPress={onBack}
            accessibilityLabel="Go back to recommendations"
          >
            <Text style={styles.recommendationDetailBackText}>‹</Text>
          </Pressable>
          <View style={styles.recommendationDetailHeaderText}>
            <Text style={styles.recommendationDetailTitle}>추천 결과</Text>
            <Text style={styles.recommendationDetailTime}>
              {formatRecommendationSessionTime(session.createdAt)}에 저장된 추천
            </Text>
            <Text style={styles.recommendationDetailTime}>
              {formatRecommendationSessionChildSummary(session)} 기준
            </Text>
          </View>
        </View>

        <RecommendationAnswerSummary
          answers={preferencesToAnswers(session.preferences)}
          questions={questions}
        />

        {__DEV__ && session.debug ? (
          <RecommendationDebugPrompt debug={session.debug} />
        ) : null}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>추천 결과</Text>
          <Text style={styles.sectionMeta}>
            조건에 맞춰 고른 후보 {recommendedEvents.length}개
          </Text>
        </View>

        {recommendedEvents.length > 0 ? (
          recommendedEvents.map((event, index) => (
            <EventCard
              key={event.id}
              event={event}
              compact
              recommendationResult={session.results.find(
                result => result.eventId === event.id,
              )}
              tone={index}
              onPress={() => onOpenEvent(event)}
            />
          ))
        ) : (
          <View style={styles.recommendationEmptyState}>
            <Text style={styles.emptyStateTitle}>
              추천 후보를 다시 확인할 수 없어요
            </Text>
            <Text style={styles.emptyStateText}>
              행사 데이터가 갱신되면서 저장된 후보가 사라졌을 수 있어요.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function SettingsScreen({
  user,
  onBack,
  onAddChild,
  onRemoveChild,
  onUpdateChild,
  onUpdateDisplayName,
  onToggleChild,
  onUpdateHomeAddress,
  onSelectRegion,
  onResetUser,
  onSignOut,
}: {
  user: User;
  onBack: () => void;
  onAddChild: (child: Omit<Child, 'id'>) => Promise<string>;
  onRemoveChild: (childId: string) => void;
  onUpdateChild: (
    childId: string,
    childPatch: Partial<Omit<Child, 'id'>>,
  ) => void;
  onUpdateDisplayName: (displayName: string) => void;
  onToggleChild: (childId: string) => void;
  onUpdateHomeAddress: (homeAddress?: UserHomeAddress) => void;
  onSelectRegion: (region: string) => void;
  onResetUser: () => void;
  onSignOut: () => Promise<void>;
}) {
  const selectedChildren = sortChildrenByAge(getSelectedChildren(user));
  const childrenByAge = sortChildrenByAge(user.children);
  const regions = ['서울', '경기', '기타 지역'];
  const [displayNameDraft, setDisplayNameDraft] = useState(user.displayName);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [datePickerTarget, setDatePickerTarget] = useState<string | null>(null);
  const [editingChildId, setEditingChildId] = useState<string | null>(null);
  const [postcodeOpen, setPostcodeOpen] = useState(false);
  const displayNameInputRef = useRef<TextInput>(null);

  const commitDisplayName = () => {
    const nextDisplayName = displayNameDraft.trim();

    if (nextDisplayName) {
      onUpdateDisplayName(nextDisplayName);
    } else {
      setDisplayNameDraft(user.displayName);
    }
  };

  const handleBack = () => {
    commitDisplayName();
    onBack();
  };

  const handleAddChild = async () => {
    const newChildId = await onAddChild({
      nickname: '새 아이',
      birthDate: formatDateInput(defaultBirthDate()),
      gender: 'unknown',
    });

    setEditingChildId(newChildId);
  };

  const setBirthDate = (target: string, selectedDate: Date) => {
    const birthDate = formatDateInput(selectedDate);

    onUpdateChild(target, { birthDate });
  };

  const handleBirthDateChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date,
  ) => {
    if (Platform.OS === 'android') {
      setDatePickerOpen(false);
    }

    if (event.type === 'dismissed' || !selectedDate) {
      return;
    }

    if (datePickerTarget) {
      setBirthDate(datePickerTarget, selectedDate);
    }
  };

  const openBirthDatePicker = (target: string, birthDate?: string) => {
    const value = birthDate ? parseDateInput(birthDate) : defaultBirthDate();

    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value,
        mode: 'date',
        maximumDate: new Date(),
        onChange: (event, selectedDate) => {
          if (event.type !== 'dismissed' && selectedDate) {
            setBirthDate(target, selectedDate);
          }
        },
      });
      return;
    }

    setDatePickerTarget(target);
    setDatePickerOpen(true);
  };

  return (
    <ScrollView contentContainerStyle={styles.settingsScreen}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.pageTitle}>설정</Text>
        </View>
        <Pressable
          style={styles.iconButton}
          onPress={handleBack}
          accessibilityLabel="Close settings"
        >
          <Text style={styles.iconButtonText}>×</Text>
        </Pressable>
      </View>

      <View style={styles.settingsCard}>
        <Text style={styles.settingsLabel}>Parent</Text>
        <TextInput
          ref={displayNameInputRef}
          style={styles.textInput}
          defaultValue={user.displayName}
          onChangeText={setDisplayNameDraft}
          onBlur={commitDisplayName}
          placeholder="보호자 이름"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="default"
          returnKeyType="done"
          textContentType="none"
        />
        <Text style={styles.settingsMeta}>
          앱 안에서 사용할 보호자 이름입니다.
        </Text>
      </View>

      <View style={styles.settingsSection}>
        <Text style={styles.sectionTitle}>추천에 포함할 아이</Text>
        <Text style={styles.sectionMeta}>
          {formatChildrenNames(selectedChildren)} 기준으로 월령 필터를
          계산합니다.
        </Text>

        {childrenByAge.map(child => {
          const selected = user.activeChildIds.includes(child.id);
          const editing = editingChildId === child.id;

          return (
            <View
              key={child.id}
              style={[styles.childCard, selected && styles.childCardSelected]}
            >
              <View style={styles.childCardHeader}>
                <View>
                  <Text style={styles.childName}>{child.nickname}</Text>
                  <Text style={styles.childMeta}>
                    {child.birthDate} · {formatChildAge(child)} ·{' '}
                    {formatGender(child.gender)}
                  </Text>
                </View>
                <View style={styles.childActions}>
                  <Pressable
                    style={styles.editButton}
                    onPress={() => setEditingChildId(editing ? null : child.id)}
                    accessibilityLabel={`Edit ${child.nickname}`}
                  >
                    <Text style={styles.editButtonText}>
                      {editing ? '완료' : '수정'}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.checkCircle,
                      selected && styles.checkCircleSelected,
                    ]}
                    onPress={() => onToggleChild(child.id)}
                    accessibilityLabel={`Toggle ${child.nickname} recommendation`}
                  >
                    <Text
                      style={[
                        styles.checkText,
                        selected && styles.checkTextSelected,
                      ]}
                    >
                      ✓
                    </Text>
                  </Pressable>
                </View>
              </View>

              {editing ? (
                <>
                  <TextInput
                    style={styles.textInput}
                    defaultValue={child.nickname}
                    onChangeText={nickname =>
                      onUpdateChild(child.id, { nickname })
                    }
                    placeholder="아이 이름 또는 별명"
                    placeholderTextColor={colors.muted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="default"
                    returnKeyType="done"
                    textContentType="none"
                  />

                  <Pressable
                    style={styles.datePickerButton}
                    onPress={() =>
                      openBirthDatePicker(child.id, child.birthDate)
                    }
                  >
                    <Text style={styles.datePickerText}>{child.birthDate}</Text>
                    <Text style={styles.childMeta}>
                      {formatChildAge(child)}
                    </Text>
                  </Pressable>

                  <View style={styles.wrapRow}>
                    {(['unknown', 'female', 'male'] as ChildGender[]).map(
                      gender => (
                        <Pressable
                          key={gender}
                          onPress={() => onUpdateChild(child.id, { gender })}
                        >
                          <Chip
                            label={formatGender(gender)}
                            selected={gender === child.gender}
                          />
                        </Pressable>
                      ),
                    )}
                  </View>
                </>
              ) : null}

              {user.children.length > 1 ? (
                <Pressable
                  style={styles.removeButton}
                  onPress={() => onRemoveChild(child.id)}
                  accessibilityLabel={`Remove ${child.nickname}`}
                >
                  <Text style={styles.removeButtonText}>삭제</Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}

        <Pressable
          style={styles.addChildButton}
          onPress={handleAddChild}
          accessibilityLabel="Add child"
        >
          <Text style={styles.addChildPlus}>＋</Text>
          <Text style={styles.addChildText}>아이 추가</Text>
        </Pressable>
        {datePickerOpen && Platform.OS === 'ios' && datePickerTarget ? (
          <DateTimePicker
            value={datePickerValue(datePickerTarget, user.children)}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            maximumDate={new Date()}
            onChange={handleBirthDateChange}
          />
        ) : null}
      </View>

      <View style={styles.settingsSection}>
        <Text style={styles.sectionTitle}>거주지</Text>
        <Text style={styles.sectionMeta}>
          추천과 탐색 필터에서 우선 참고하는 지역입니다.
        </Text>
        <AddressSummaryCard
          homeAddress={user.homeAddress}
          onOpenPostcode={() => setPostcodeOpen(true)}
        />
        {user.homeAddress ? (
          <TextInput
            style={styles.textInput}
            value={user.homeAddress.detailAddress ?? ''}
            onChangeText={detailAddress =>
              onUpdateHomeAddress({
                ...user.homeAddress!,
                detailAddress,
              })
            }
            placeholder="상세 주소 예: 101동 1203호"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            textContentType="fullStreetAddress"
          />
        ) : null}
        <View style={[styles.wrapRow, styles.settingsRegionRow]}>
          {regions.map(region => (
            <Pressable key={region} onPress={() => onSelectRegion(region)}>
              <Chip label={region} selected={region === user.homeRegion} />
            </Pressable>
          ))}
        </View>
      </View>

      <PostcodeModal
        visible={postcodeOpen}
        onClose={() => setPostcodeOpen(false)}
        onSelect={nextAddress => {
          const keepDetailAddress = addressesShareSameBase(
            user.homeAddress,
            nextAddress,
          );

          onUpdateHomeAddress({
            ...nextAddress,
            detailAddress: keepDetailAddress
              ? user.homeAddress?.detailAddress
              : undefined,
          });
          setPostcodeOpen(false);
        }}
      />

      <View style={styles.settingsSection}>
        <Text style={styles.sectionTitle}>초기화</Text>
        <Text style={styles.sectionMeta}>
          이 기기에 저장된 보호자 정보와 아이 정보를 처음 상태로 되돌립니다.
        </Text>
        <Pressable
          style={styles.resetUserButton}
          onPress={onResetUser}
          accessibilityLabel="Reset user information"
        >
          <Text style={styles.resetUserButtonText}>사용자 정보 초기화</Text>
        </Pressable>
        <Pressable
          style={styles.resetUserButton}
          onPress={onSignOut}
          accessibilityLabel="Sign out from Google"
        >
          <Text style={styles.resetUserButtonText}>로그아웃</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function AddressSummaryCard({
  homeAddress,
  onOpenPostcode,
}: {
  homeAddress?: UserHomeAddress;
  onOpenPostcode: () => void;
}) {
  return (
    <View style={styles.addressCard}>
      <View style={styles.addressTextGroup}>
        <Text style={styles.addressTitle}>
          {homeAddress ? formatHomeAddress(homeAddress) : '주소 미설정'}
        </Text>
        <Text style={styles.addressMeta}>
          {homeAddress?.zonecode
            ? `우편번호 ${homeAddress.zonecode}`
            : '도로명 주소 검색으로 기준 위치를 설정해요.'}
        </Text>
      </View>
      <Pressable
        style={styles.addressSearchButton}
        onPress={onOpenPostcode}
        accessibilityLabel="Open postcode search"
      >
        <Text style={styles.addressSearchButtonText}>
          {homeAddress ? '변경' : '검색'}
        </Text>
      </Pressable>
    </View>
  );
}

function PostcodeModal({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (homeAddress: UserHomeAddress) => void;
}) {
  const handleSelectedAddress = (data: UserHomeAddress) => {
    const address = data.roadAddress || data.address || data.jibunAddress || '';

    if (!address.trim()) {
      return;
    }

    onSelect({
      address,
      roadAddress: data.roadAddress || undefined,
      jibunAddress: data.jibunAddress || undefined,
      zonecode: data.zonecode || undefined,
      sido: data.sido || undefined,
      sigungu: data.sigungu || undefined,
      bname: data.bname || undefined,
      buildingName: data.buildingName || undefined,
    });
  };

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data) as UserHomeAddress;

      handleSelectedAddress(data);
    } catch {
      onClose();
    }
  };

  const handleShouldStartLoad = ({ url }: { url: string }) => {
    const selectedAddress = parsePostcodeSelectionUrl(url);

    if (selectedAddress) {
      handleSelectedAddress(selectedAddress);
      return false;
    }

    return true;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.postcodeModalRoot}>
        <View style={styles.postcodeModalHeader}>
          <View>
            <Text style={styles.settingsLabel}>주소 검색</Text>
            <Text style={styles.postcodeModalTitle}>기준 주소 선택</Text>
          </View>
          <Pressable
            style={styles.iconButton}
            onPress={onClose}
            accessibilityLabel="Close postcode search"
          >
            <Text style={styles.iconButtonText}>×</Text>
          </Pressable>
        </View>
        <WebView
          source={{
            html: postcodeSearchHtml,
            baseUrl: 'https://postcode.map.kakao.com',
          }}
          style={styles.postcodeWebView}
          originWhitelist={['*']}
          domStorageEnabled
          javaScriptEnabled
          mixedContentMode="always"
          onMessage={handleMessage}
          onShouldStartLoadWithRequest={handleShouldStartLoad}
          setSupportMultipleWindows={false}
          thirdPartyCookiesEnabled
        />
      </SafeAreaView>
    </Modal>
  );
}

function FilterSheet({
  filters,
  bottomInset,
  onChangeFilters,
  onClose,
}: {
  filters: ExploreFilters;
  bottomInset: number;
  onChangeFilters: (filters: ExploreFilters) => void;
  onClose: () => void;
}) {
  const [draftFilters, setDraftFilters] = useState(filters);
  const updateFilter = <Key extends keyof ExploreFilters>(
    key: Key,
    value: ExploreFilters[Key],
  ) => {
    setDraftFilters(previousFilters => ({ ...previousFilters, [key]: value }));
  };

  const applyFilters = () => {
    onChangeFilters(draftFilters);
    onClose();
  };

  return (
    <View style={styles.sheetOverlay}>
      <Pressable style={styles.sheetDim} onPress={onClose} />
      <View
        style={[styles.sheet, bottomInsetPadding(bottomInset, spacing.xxxl)]}
      >
        <View style={styles.grabber} />
        <View style={styles.sheetHeader}>
          <View>
            <Text style={styles.sheetTitle}>필터</Text>
            <Text style={styles.sheetSubtitle}>
              직접 찾고 싶은 조건만 좁혀보세요
            </Text>
          </View>
          <Pressable onPress={() => setDraftFilters(defaultExploreFilters)}>
            <Text style={styles.linkText}>초기화</Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.sheetScroll}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.fieldLabel}>아이 월령</Text>
          <View style={styles.wrapRow}>
            <Pressable
              onPress={() => updateFilter('ageFit', !draftFilters.ageFit)}
            >
              <Chip
                label="선택한 아이에게 맞는 행사"
                selected={draftFilters.ageFit}
              />
            </Pressable>
          </View>

          <Text style={styles.fieldLabel}>일정</Text>
          <View style={styles.wrapRow}>
            {[
              ['scheduled', '예정'],
              ['ongoing', '진행중'],
            ].map(([value, label]) => (
              <Pressable
                key={value}
                accessibilityLabel={`Filter schedule ${label}`}
                onPress={() => updateFilter('date', value as DateFilter)}
              >
                <Chip
                  label={label}
                  selected={
                    draftFilters.date === 'active' ||
                    draftFilters.date === value
                  }
                />
              </Pressable>
            ))}
          </View>

          <Text style={styles.fieldLabel}>지역</Text>
          <View style={styles.wrapRow}>
            {[
              ['all', '전체'],
              ['seoul', '서울'],
              ['gyeonggi', '경기'],
              ['other', '기타 지역'],
            ].map(([value, label]) => (
              <Pressable
                key={value}
                onPress={() => updateFilter('region', value as RegionFilter)}
              >
                <Chip label={label} selected={draftFilters.region === value} />
              </Pressable>
            ))}
          </View>

          <Text style={styles.fieldLabel}>가격</Text>
          <View style={styles.wrapRow}>
            {[
              ['all', '전체'],
              ['free', '무료'],
              ['paid', '유료'],
            ].map(([value, label]) => (
              <Pressable
                key={value}
                onPress={() => updateFilter('price', value as PriceFilter)}
              >
                <Chip label={label} selected={draftFilters.price === value} />
              </Pressable>
            ))}
          </View>

          <Text style={styles.fieldLabel}>공간</Text>
          <View style={styles.wrapRow}>
            {[
              ['all', '전체'],
              ['indoor', '실내'],
              ['outdoor', '야외'],
            ].map(([value, label]) => (
              <Pressable
                key={value}
                onPress={() => updateFilter('place', value as PlaceFilter)}
              >
                <Chip label={label} selected={draftFilters.place === value} />
              </Pressable>
            ))}
          </View>

          <Text style={styles.fieldLabel}>예약</Text>
          <View style={styles.wrapRow}>
            {[
              ['all', '전체'],
              ['required', '예약 필요'],
              ['notRequired', '예약 불필요'],
            ].map(([value, label]) => (
              <Pressable
                key={value}
                onPress={() =>
                  updateFilter('reservation', value as ReservationFilter)
                }
              >
                <Chip
                  label={label}
                  selected={draftFilters.reservation === value}
                />
              </Pressable>
            ))}
          </View>

          <Pressable
            style={[styles.primaryButton, styles.sheetApplyButton]}
            onPress={applyFilters}
            accessibilityLabel="Apply filters"
          >
            <Text style={styles.primaryButtonText}>결과 보기</Text>
          </Pressable>
        </ScrollView>
      </View>
    </View>
  );
}

function EventCard({
  event,
  compact,
  recommendationResult,
  showSequence,
  tone,
  onPress,
}: {
  event: BabyrooEvent;
  compact?: boolean;
  recommendationResult?: RecommendationResult;
  showSequence?: boolean;
  tone: number;
  onPress: () => void;
}) {
  const color = [colors.primarySoft, colors.blue, colors.mint, colors.lilac][
    tone % 4
  ];
  const tabSwipePress = useTabSwipePressGuard(onPress);

  return (
    <Pressable
      style={[styles.eventCard, compact && styles.eventCardCompact]}
      onPress={tabSwipePress.onPress}
      onTouchStart={tabSwipePress.onTouchStart}
      onTouchMove={tabSwipePress.onTouchMove}
      onTouchEnd={tabSwipePress.onTouchEnd}
      accessibilityLabel={`Open ${event.title}`}
    >
      <View
        style={[
          styles.thumbnail,
          !compact && styles.thumbnailFeature,
          { backgroundColor: color },
        ]}
      >
        {event.imageUrl ? (
          <Image
            source={{ uri: event.imageUrl }}
            resizeMode="cover"
            style={styles.thumbnailImage}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <EventThumbnailFallback event={event} tone={tone} />
        )}
      </View>
      <View style={[styles.cardBody, !compact && styles.cardBodyFeature]}>
        {!compact ? (
          <View style={styles.cardKickerRow}>
            <Text style={styles.cardKickerText} numberOfLines={1}>
              {event.locality || '지역 확인'}
            </Text>
            <Text style={styles.cardKickerDivider}>/</Text>
            <Text style={styles.cardKickerText} numberOfLines={1}>
              {thumbnailCategoryLabel(event)}
            </Text>
          </View>
        ) : null}
        <Text style={styles.cardTitle} numberOfLines={compact ? 2 : 3}>
          {event.title}
        </Text>
        <Text style={styles.cardMeta} numberOfLines={2}>
          {event.venueName} · {formatAge(event)}
        </Text>
        {showSequence && event.tags.length > 0 ? (
          <View style={styles.cardTagRow}>
            {event.tags.slice(0, 3).map(tag => (
              <Chip key={tag} label={tag} dense />
            ))}
          </View>
        ) : null}
        <View style={styles.cardFooter}>
          {event.indoor === undefined ? null : (
            <Chip label={event.indoor ? '실내' : '야외'} dense />
          )}
          {compact ? (
            <Text style={styles.cardDate}>
              {formatShortDate(event.startsAt)}
            </Text>
          ) : null}
        </View>
        {recommendationResult ? (
          <View style={styles.recommendationReasonBox}>
            <Text style={styles.recommendationReasonTitle}>추천 이유</Text>
            {recommendationResult.reasons.map(reason => (
              <Text key={reason} style={styles.recommendationReasonText}>
                {reason}
              </Text>
            ))}
            {recommendationResult.caution ? (
              <>
                <Text style={styles.recommendationCautionTitle}>확인할 점</Text>
                <Text style={styles.recommendationReasonText}>
                  {recommendationResult.caution}
                </Text>
              </>
            ) : null}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

function EventThumbnailFallback({
  event,
  tone,
}: {
  event: BabyrooEvent;
  tone: number;
}) {
  const palette = [
    [colors.primary, colors.primarySoft],
    [colors.blueText, colors.lilac],
    [colors.mintText, colors.mint],
    [colors.amberText, colors.amber],
  ][tone % 4];

  return (
    <View style={styles.thumbnailFallback}>
      <View
        style={[styles.thumbnailBackdrop, { backgroundColor: palette[1] }]}
      />
      <View
        style={[styles.thumbnailTopLine, { backgroundColor: palette[0] }]}
      />
      <Text style={styles.thumbnailSourceText} numberOfLines={1}>
        {thumbnailSourceLabel(event)}
      </Text>
      <Text style={styles.thumbnailCategoryText} numberOfLines={1}>
        {thumbnailCategoryLabel(event)}
      </Text>
    </View>
  );
}

function Chip({
  label,
  selected,
  dense,
}: {
  label: string;
  selected?: boolean;
  dense?: boolean;
}) {
  return (
    <View
      style={[
        styles.chip,
        selected && styles.chipSelected,
        dense && styles.chipDense,
      ]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {label}
      </Text>
    </View>
  );
}

function ChildContextChip({
  child,
  selected,
}: {
  child: Child;
  selected: boolean;
}) {
  return (
    <View
      style={[
        styles.childContextChip,
        selected && styles.childContextChipSelected,
      ]}
    >
      <Text
        style={[
          styles.childContextName,
          selected && styles.childContextNameSelected,
        ]}
        numberOfLines={1}
      >
        {child.nickname}
      </Text>
      <Text
        style={[
          styles.childContextAge,
          selected && styles.childContextAgeSelected,
        ]}
      >
        {formatChildAge(child)}
      </Text>
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function BottomTabs({
  activeTab,
  bottomInset,
  onChange,
}: {
  activeTab: Tab;
  bottomInset: number;
  onChange: (tab: Tab) => void;
}) {
  const tabs: Array<{ id: Tab; label: string; mark: string }> = [
    { id: 'home', label: '추천', mark: '⌂' },
    { id: 'explore', label: '탐색', mark: '⌕' },
  ];

  return (
    <View
      style={[styles.bottomTabs, bottomTabsSafeArea(bottomInset)]}
      accessibilityLabel="Bottom navigation"
    >
      {tabs.map(tab => {
        const active = tab.id === activeTab;
        return (
          <Pressable
            key={tab.id}
            style={styles.tabButton}
            onPress={() => onChange(tab.id)}
          >
            <Text style={[styles.tabMark, active && styles.tabMarkActive]}>
              {tab.mark}
            </Text>
            <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function buildExploreEventListQuery(
  searchQuery: string,
  filters: ExploreFilters,
  selectedChildren: Child[],
): BabyrooEventListQuery {
  const query: BabyrooEventListQuery = {
    limit: 300,
  };
  const trimmedSearchQuery = searchQuery.trim();

  if (trimmedSearchQuery) {
    query.q = trimmedSearchQuery;
  }

  if (filters.exploreEventTypes.length > 0) {
    query.eventType = filters.exploreEventTypes.join(',');
  }

  if (filters.region === 'seoul') {
    query.region = '서울';
  }

  if (filters.region === 'gyeonggi') {
    query.region = '경기';
  }

  if (filters.ageFit && selectedChildren.length > 0) {
    query.childAgeMonths = calculateAgeMonths(selectedChildren[0].birthDate);
  }

  if (filters.price !== 'all') {
    query.priceType = filters.price;
  }

  if (filters.place === 'indoor') {
    query.indoor = true;
  }

  if (filters.place === 'outdoor') {
    query.indoor = false;
  }

  if (filters.reservation === 'required') {
    query.reservationRequired = true;
  }

  if (filters.reservation === 'notRequired') {
    query.reservationRequired = false;
  }

  return query;
}

function filterEvents(
  events: BabyrooEvent[],
  searchQuery: string,
  filters: ExploreFilters,
  selectedChildren: Child[],
) {
  const normalizedQuery = normalizeSearchText(searchQuery);
  const selectedChildAges = selectedChildren.map(child =>
    calculateAgeMonths(child.birthDate),
  );

  return events.filter(event => {
    if (normalizedQuery && !eventMatchesSearchQuery(event, normalizedQuery)) {
      return false;
    }

    if (
      filters.ageFit &&
      !eventFitsAllSelectedChildren(event, selectedChildAges)
    ) {
      return false;
    }

    if (!eventMatchesDateFilter(event, filters.date)) {
      return false;
    }

    if (!eventMatchesRegionFilter(event, filters.region)) {
      return false;
    }

    if (!eventMatchesExploreEventTypes(event, filters.exploreEventTypes)) {
      return false;
    }

    if (filters.price !== 'all' && event.priceType !== filters.price) {
      return false;
    }

    if (filters.place === 'indoor' && event.indoor !== true) {
      return false;
    }

    if (filters.place === 'outdoor' && event.indoor !== false) {
      return false;
    }

    if (!eventMatchesReservationFilter(event, filters.reservation)) {
      return false;
    }

    return true;
  });
}

function buildRecommendationQuestions(
  events: BabyrooEvent[],
  selectedChildren: Child[],
  answers: RecommendationAnswerMap,
  userHomeAddress?: UserHomeAddress,
  departureAddress?: UserHomeAddress,
) {
  return [
    ...coreRecommendationQuestions(answers, userHomeAddress, departureAddress),
    selectAdaptiveRecommendationQuestion(events, selectedChildren),
  ];
}

function selectAdaptiveRecommendationQuestion(
  events: BabyrooEvent[],
  selectedChildren: Child[],
): RecommendationQuestion {
  const youngestChildAge = selectedChildren.reduce<number | null>(
    (youngestAge, child) => {
      const childAge = calculateAgeMonths(child.birthDate);

      return youngestAge == null ? childAge : Math.min(youngestAge, childAge);
    },
    null,
  );

  if (youngestChildAge != null && youngestChildAge < 24) {
    return {
      id: 'duration',
      prompt: '짧게 머물 수 있는 곳이 좋으세요?',
      options: [
        { label: '짧은 코스가 좋아요', value: 'duration_short' },
        { label: '상관없어요', value: 'duration_any' },
      ],
    };
  }

  const hasIndoor = events.some(event => event.indoor === true);
  const hasOutdoor = events.some(event => event.indoor === false);

  if (hasIndoor && hasOutdoor) {
    return {
      id: 'place',
      prompt: '실내와 야외 중 어디가 더 편하세요?',
      options: [
        { label: '실내 위주', value: 'place_indoor' },
        { label: '야외도 좋아요', value: 'place_outdoor' },
        { label: '상관없어요', value: 'place_any' },
      ],
    };
  }

  return {
    id: 'activityStyle',
    prompt: '어떤 활동이 더 끌리세요?',
    options: [
      { label: '직접 체험', value: 'activity_experience' },
      { label: '전시 관람', value: 'activity_exhibition' },
      { label: '상관없어요', value: 'activity_any' },
    ],
  };
}

function recommendationQuestionLabel(question: RecommendationQuestion) {
  if (question.id === 'startRegion') {
    return '출발 지역';
  }
  if (question.id === 'visitDay') {
    return '가는 날';
  }
  if (question.id === 'weather') {
    return '날씨';
  }
  if (question.id === 'mobility') {
    return '이동 방식';
  }
  if (question.id === 'vibe') {
    return '분위기';
  }
  if (question.id === 'priceComfort') {
    return '입장료';
  }
  if (question.id === 'reservationComfort') {
    return '예약';
  }
  if (question.id === 'duration') {
    return '체류 시간';
  }
  if (question.id === 'place') {
    return '실내/야외';
  }

  return '활동 유형';
}

function recommendationAnswerLabel(
  question: RecommendationQuestion,
  value: RecommendationAnswerValue | undefined,
) {
  return (
    question.options.find(option => option.value === value)?.label ??
    '선택 안 함'
  );
}

function formatRecommendationSessionAnswerSummary(
  session: RecommendationSession,
  questions: RecommendationQuestion[],
) {
  const answers = preferencesToAnswers(session.preferences);
  const labels = questions
    .map(question => recommendationAnswerLabel(question, answers[question.id]))
    .filter(label => label !== '선택 안 함')
    .slice(0, 4);

  if (labels.length === 0) {
    return '조건 정보 없음';
  }

  return labels.join(' · ');
}

function formatRecommendationSessionChildSummary(
  session: RecommendationSession,
) {
  const children = session.selectedChildrenSnapshot ?? [];

  if (children.length === 1) {
    return `${children[0].nickname} · ${formatChildAge(children[0])}`;
  }

  if (children.length > 1) {
    return `${children[0].nickname} 외 ${children.length - 1}명`;
  }

  if (session.selectedChildIds.length > 0) {
    return `${session.selectedChildIds.length}명 기준`;
  }

  return '아이 정보 없음';
}

function formatRecommendationSessionEventPreview(
  session: RecommendationSession,
  events: BabyrooEvent[],
) {
  const recommendedEvents = session.results
    .map(result =>
      [...(session.eventSnapshots ?? []), ...events].find(
        event => event.id === result.eventId,
      ),
    )
    .filter((event): event is BabyrooEvent => Boolean(event));
  const previewTitles = recommendedEvents.slice(0, 2).map(event => event.title);
  const remainingCount = Math.max(
    recommendedEvents.length - previewTitles.length,
    0,
  );

  if (previewTitles.length === 0) {
    return '후보를 다시 확인할 수 없어요';
  }

  if (remainingCount > 0) {
    return `${previewTitles.join(', ')} 외 ${remainingCount}개`;
  }

  return previewTitles.join(', ');
}

function answersToPreferences(
  answers: RecommendationAnswerMap,
  departureAddress?: UserHomeAddress,
): Preferences {
  return {
    startRegion:
      answers.startRegion === 'region_seoul'
        ? 'seoul'
        : answers.startRegion === 'region_gyeonggi'
        ? 'gyeonggi'
        : answers.startRegion === 'region_other'
        ? 'other'
        : undefined,
    departureAddress: departureAddress
      ? formatHomeAddress(departureAddress)
      : undefined,
    visitWindow:
      answers.visitDay === 'visit_soon'
        ? 'soon'
        : answers.visitDay === 'visit_this_weekend'
        ? 'this_weekend'
        : answers.visitDay === 'visit_next_week'
        ? 'next_week'
        : answers.visitDay === 'visit_flexible'
        ? 'flexible'
        : undefined,
    weatherPlan:
      answers.weather === 'weather_outdoor_if_suitable'
        ? 'outdoor_if_suitable'
        : answers.weather === 'weather_prefer_indoor'
        ? 'prefer_indoor'
        : answers.weather === 'weather_prefer_outdoor'
        ? 'prefer_outdoor'
        : undefined,
    mobility:
      answers.mobility === 'mobility_car'
        ? 'car'
        : answers.mobility === 'mobility_transit'
        ? 'transit'
        : answers.mobility === 'mobility_nearby'
        ? 'nearby'
        : undefined,
    vibe:
      answers.vibe === 'vibe_quiet'
        ? 'quiet'
        : answers.vibe === 'vibe_lively'
        ? 'lively'
        : answers.vibe === 'vibe_any'
        ? 'any'
        : undefined,
    price:
      answers.priceComfort === 'price_free'
        ? 'free'
        : answers.priceComfort === 'price_low'
        ? 'low'
        : answers.priceComfort === 'price_any'
        ? 'any'
        : undefined,
    reservation:
      answers.reservationComfort === 'reservation_none'
        ? 'no_reservation'
        : answers.reservationComfort === 'reservation_ok'
        ? 'reservation_ok'
        : answers.reservationComfort === 'reservation_any'
        ? 'any'
        : undefined,
    duration:
      answers.duration === 'duration_short'
        ? 'short'
        : answers.duration === 'duration_any'
        ? 'any'
        : undefined,
    place:
      answers.place === 'place_indoor'
        ? 'indoor'
        : answers.place === 'place_outdoor'
        ? 'outdoor'
        : answers.place === 'place_any'
        ? 'any'
        : undefined,
    activity:
      answers.activityStyle === 'activity_experience'
        ? 'experience'
        : answers.activityStyle === 'activity_exhibition'
        ? 'exhibition'
        : answers.activityStyle === 'activity_any'
        ? 'any'
        : undefined,
  };
}

function preferencesToAnswers(
  preferences: Preferences,
): RecommendationAnswerMap {
  return {
    startRegion:
      preferences.startRegion === 'seoul'
        ? 'region_seoul'
        : preferences.startRegion === 'gyeonggi'
        ? 'region_gyeonggi'
        : preferences.startRegion === 'other'
        ? 'region_other'
        : undefined,
    visitDay:
      preferences.visitWindow === 'soon'
        ? 'visit_soon'
        : preferences.visitWindow === 'this_weekend'
        ? 'visit_this_weekend'
        : preferences.visitWindow === 'next_week'
        ? 'visit_next_week'
        : preferences.visitWindow === 'flexible'
        ? 'visit_flexible'
        : undefined,
    weather:
      preferences.weatherPlan === 'outdoor_if_suitable'
        ? 'weather_outdoor_if_suitable'
        : preferences.weatherPlan === 'prefer_indoor'
        ? 'weather_prefer_indoor'
        : preferences.weatherPlan === 'prefer_outdoor'
        ? 'weather_prefer_outdoor'
        : undefined,
    mobility:
      preferences.mobility === 'car'
        ? 'mobility_car'
        : preferences.mobility === 'transit'
        ? 'mobility_transit'
        : preferences.mobility === 'nearby'
        ? 'mobility_nearby'
        : undefined,
    vibe:
      preferences.vibe === 'quiet'
        ? 'vibe_quiet'
        : preferences.vibe === 'lively'
        ? 'vibe_lively'
        : preferences.vibe === 'any'
        ? 'vibe_any'
        : undefined,
    priceComfort:
      preferences.price === 'free'
        ? 'price_free'
        : preferences.price === 'low'
        ? 'price_low'
        : preferences.price === 'any'
        ? 'price_any'
        : undefined,
    reservationComfort:
      preferences.reservation === 'no_reservation'
        ? 'reservation_none'
        : preferences.reservation === 'reservation_ok'
        ? 'reservation_ok'
        : preferences.reservation === 'any'
        ? 'reservation_any'
        : undefined,
    duration:
      preferences.duration === 'short'
        ? 'duration_short'
        : preferences.duration === 'any'
        ? 'duration_any'
        : undefined,
    place:
      preferences.place === 'indoor'
        ? 'place_indoor'
        : preferences.place === 'outdoor'
        ? 'place_outdoor'
        : preferences.place === 'any'
        ? 'place_any'
        : undefined,
    activityStyle:
      preferences.activity === 'experience'
        ? 'activity_experience'
        : preferences.activity === 'exhibition'
        ? 'activity_exhibition'
        : preferences.activity === 'any'
        ? 'activity_any'
        : undefined,
  };
}

function recommendationErrorMessage(errorCode: RecommendationErrorCode) {
  const messages: Record<
    RecommendationErrorCode,
    { title: string; body: string }
  > = {
    network_error: {
      title: '네트워크 연결이 불안정해요',
      body: '연결 상태를 확인하고 다시 시도해 주세요.',
    },
    timeout: {
      title: '추천 시간이 조금 오래 걸리고 있어요',
      body: '잠시 후 다시 시도해 주세요.',
    },
    llm_unavailable: {
      title: '지금은 추천이 어려워요',
      body: '잠시 후 다시 시도해 주세요.',
    },
    insufficient_credits: {
      title: '추천권이 부족해요',
      body: '추천권을 충전한 뒤 다시 추천을 받아보세요.',
    },
    invalid_response: {
      title: '추천 결과를 정리하지 못했어요',
      body: '다시 시도하면 다른 결과를 받을 수 있어요.',
    },
    no_candidates: {
      title: '조건에 맞는 후보가 없어요',
      body: '지역이나 일정 조건을 조금 넓혀보세요.',
    },
    no_results: {
      title: '추천할 만한 결과를 찾지 못했어요',
      body: '조건을 조금 바꾸거나 다시 시도해 주세요.',
    },
    not_configured: {
      title: '추천 서비스가 아직 설정되지 않았어요',
      body: '개발 설정을 확인해 주세요.',
    },
    unknown: {
      title: '지금은 추천이 어려워요',
      body: '조건을 조금 바꾸거나 다시 시도해 주세요.',
    },
  };

  return messages[errorCode];
}

function normalizeSearchText(value: string) {
  return value.trim().toLocaleLowerCase();
}

function eventMatchesSearchQuery(event: BabyrooEvent, normalizedQuery: string) {
  const searchableText = normalizeSearchText(event.title);

  return searchableText.includes(normalizedQuery);
}

function thumbnailSourceLabel(event: BabyrooEvent) {
  if (event.source === 'seoul_culture') {
    return '서울';
  }
  if (event.source === 'nfm_kids') {
    return '민속';
  }
  if (event.source === 'dikidiki') {
    return 'DDP';
  }
  if (event.source === 'namu') {
    return '자연사';
  }
  if (event.source === 'seoul_childcare') {
    return '육아';
  }
  return event.region;
}

function thumbnailCategoryLabel(event: BabyrooEvent) {
  if (event.category === 'experience') {
    return '체험';
  }
  if (event.category === 'exhibition') {
    return '전시';
  }
  if (event.category === 'play_space') {
    return '놀이';
  }
  if (event.category === 'museum') {
    return '박물관';
  }
  if (event.category === 'performance') {
    return '공연';
  }
  return event.category.slice(0, 6).toUpperCase();
}

function eventFitsAllSelectedChildren(
  event: BabyrooEvent,
  childAges: number[],
) {
  if (childAges.length === 0) {
    return true;
  }

  return childAges.every(ageMonths => {
    if (event.ageMinMonths != null && ageMonths < event.ageMinMonths) {
      return false;
    }

    if (event.ageMaxMonths != null && ageMonths > event.ageMaxMonths) {
      return false;
    }

    return true;
  });
}

function eventMatchesDateFilter(event: BabyrooEvent, dateFilter: DateFilter) {
  const today = parseDateInput(formatDateInput(new Date()));
  const eventStart = parseDateInput(event.startsAt);
  const eventEnd = parseDateInput(event.endsAt);

  if (dateFilter === 'active') {
    return eventEnd >= today;
  }

  if (dateFilter === 'scheduled') {
    return eventStart > today;
  }

  return eventStart <= today && eventEnd >= today;
}

function eventMatchesRegionFilter(
  event: BabyrooEvent,
  regionFilter: RegionFilter,
) {
  if (regionFilter === 'all') {
    return true;
  }

  if (regionFilter === 'seoul') {
    return event.region === '서울';
  }

  if (regionFilter === 'gyeonggi') {
    return event.region === '경기';
  }

  return event.region !== '서울' && event.region !== '경기';
}

function eventMatchesExploreEventTypes(
  event: BabyrooEvent,
  exploreEventTypes: ExploreEventType[],
) {
  return exploreEventTypes.includes(getExploreEventType(event));
}

function toggleExploreEventType(
  selectedEventTypes: ExploreEventType[],
  eventType: ExploreEventType,
) {
  if (selectedEventTypes.includes(eventType)) {
    if (selectedEventTypes.length === 1) {
      return selectedEventTypes;
    }

    return selectedEventTypes.filter(
      selectedEventType => selectedEventType !== eventType,
    );
  }

  return [...selectedEventTypes, eventType];
}

function getExploreEventType(event: BabyrooEvent): ExploreEventType {
  if (eventIsSeoulKidsCafe(event)) {
    return 'seoulKidsCafe';
  }

  if (eventIsPermanentVenue(event)) {
    return 'permanentVenue';
  }

  return 'limitedEvent';
}

function eventIsSeoulKidsCafe(event: BabyrooEvent) {
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
}

function eventIsPermanentVenue(event: BabyrooEvent) {
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
}

function eventMatchesReservationFilter(
  event: BabyrooEvent,
  reservationFilter: ReservationFilter,
) {
  if (reservationFilter === 'all') {
    return true;
  }

  if (reservationFilter === 'required') {
    return event.reservationRequired === true;
  }

  return event.reservationRequired === false;
}

function countActiveExploreFilters(filters: ExploreFilters) {
  return getActiveExploreFilterLabels(filters).length;
}

function getActiveExploreFilterLabels(filters: ExploreFilters) {
  const labels: string[] = [];

  if (filters.ageFit) {
    labels.push('월령 맞춤');
  }

  if (filters.date !== 'active') {
    labels.push(filters.date === 'scheduled' ? '예정' : '진행중');
  }

  if (filters.region !== 'all') {
    const regionLabels: Record<RegionFilter, string> = {
      all: '전체',
      seoul: '서울',
      gyeonggi: '경기',
      other: '기타 지역',
    };
    labels.push(regionLabels[filters.region]);
  }

  if (filters.price !== 'all') {
    labels.push(filters.price === 'free' ? '무료' : '유료');
  }

  if (filters.place !== 'all') {
    labels.push(filters.place === 'indoor' ? '실내' : '야외');
  }

  if (filters.reservation !== 'all') {
    const reservationLabels: Record<ReservationFilter, string> = {
      all: '전체',
      required: '예약 필요',
      notRequired: '예약 불필요',
    };
    labels.push(reservationLabels[filters.reservation]);
  }

  return labels;
}

function formatExploreIntentSummary(
  selectedChildren: Child[],
  activeFilterLabels: string[],
  eventTypeSummary: string,
) {
  const childSubject = formatExploreIntentChildSubject(selectedChildren);

  return {
    title: `${childSubject} 갈 ${eventTypeSummary}`,
    meta:
      activeFilterLabels.length > 0
        ? activeFilterLabels.join(' · ')
        : '기본 필터',
  };
}

function formatExploreEventTypeSummary(selectedEventTypes: ExploreEventType[]) {
  const selectedLabels = exploreEventTypeOptions
    .filter(option => selectedEventTypes.includes(option.value))
    .map(option => option.label);

  if (selectedLabels.length === 0) {
    return '행사 유형 없음';
  }

  if (selectedLabels.length === exploreEventTypeOptions.length) {
    return '전체 유형';
  }

  return selectedLabels.join(' · ');
}

function formatExploreIntentChildSubject(selectedChildren: Child[]) {
  if (selectedChildren.length === 0) {
    return '아이와';
  }

  if (selectedChildren.length === 1) {
    return `${formatChildAge(selectedChildren[0])} 아이와`;
  }

  return `${selectedChildren[0].nickname} 외 ${
    selectedChildren.length - 1
  }명과`;
}

function formatRecommendationCriteriaSummary(selectedChildren: Child[]) {
  if (selectedChildren.length === 0) {
    return '아이 정보 없음';
  }

  if (selectedChildren.length === 1) {
    return `${selectedChildren[0].nickname} · ${formatChildAge(
      selectedChildren[0],
    )} 기준`;
  }

  return `${selectedChildren[0].nickname} 외 ${
    selectedChildren.length - 1
  }명 기준`;
}

function formatAge(event: BabyrooEvent) {
  const minAge = event.ageMinMonths;
  const maxAge = event.ageMaxMonths;

  if (minAge == null && maxAge == null) {
    return '월령 확인필요';
  }
  if (minAge != null && maxAge != null) {
    return formatAgeRange(minAge, maxAge);
  }
  if (minAge != null) {
    return `${formatAgePoint(minAge)} 이상`;
  }

  return `${formatAgePoint(maxAge)} 이하`;
}

function formatAgeRange(minMonths: number, maxMonths: number) {
  if (minMonths < 48 || maxMonths < 48) {
    return `${minMonths}-${maxMonths}개월`;
  }

  if (minMonths === 0) {
    return `${formatAgePoint(maxMonths)} 이하`;
  }

  const minLabel = formatAgePoint(minMonths);
  const maxLabel = formatAgePoint(maxMonths);

  if (minLabel === maxLabel) {
    return minLabel;
  }

  if (isExactYear(minMonths) && isYearRangeEnd(maxMonths)) {
    return `${monthToYear(minMonths)}-${monthToYear(maxMonths)}세`;
  }

  return `${minLabel}-${maxLabel}`;
}

function formatAgePoint(months: number | undefined) {
  if (months == null) {
    return '월령 확인필요';
  }

  if (months < 48 || !isExactYear(months)) {
    return `${months}개월`;
  }

  return `${months / 12}세`;
}

function isExactYear(months: number) {
  return months % 12 === 0;
}

function isYearRangeEnd(months: number) {
  return isExactYear(months) || months % 12 === 11;
}

function monthToYear(months: number) {
  return Math.floor(months / 12);
}

function formatChildAge(child: Child) {
  return `${calculateAgeMonths(child.birthDate)}개월`;
}

function sortChildrenByAge(children: Child[]) {
  return [...children].sort((left, right) => {
    const ageDifference =
      calculateAgeMonths(right.birthDate) - calculateAgeMonths(left.birthDate);

    if (ageDifference !== 0) {
      return ageDifference;
    }

    return left.birthDate.localeCompare(right.birthDate);
  });
}

function formatChildrenNames(children: Child[]) {
  if (children.length === 0) {
    return '아이를 추가하면';
  }

  return children.map(child => child.nickname).join(', ');
}

function formatRecommendationSessionTime(createdAt: string) {
  const createdDate = new Date(createdAt);
  const month = createdDate.getMonth() + 1;
  const day = createdDate.getDate();
  const hours = String(createdDate.getHours()).padStart(2, '0');
  const minutes = String(createdDate.getMinutes()).padStart(2, '0');

  return `${month}/${day} ${hours}:${minutes}`;
}

function formatCreditReason(reason: string) {
  if (reason === 'starting_credits') {
    return '가입 추천권';
  }

  if (
    reason === 'manual_credit_purchase' ||
    reason === 'google_play_credit_purchase'
  ) {
    return '추천권 충전';
  }

  if (reason === 'recommendation_session') {
    return '추천 사용';
  }

  return reason;
}

function googlePlayProductId(
  creditPackage: BabyrooCreditStatus['packages'][number],
) {
  return creditPackage.googlePlayProductId ?? creditPackage.id;
}

function formatKrw(value: number) {
  return `${value.toLocaleString('ko-KR')}원`;
}

function formatVisitWindowForWeatherQuestion(
  visitDay: RecommendationAnswerValue | undefined,
) {
  const today = new Date();

  if (visitDay === 'visit_soon') {
    return `${formatMonthDay(addDays(today, 1))}-${formatMonthDay(
      addDays(today, 2),
    )}`;
  }

  if (visitDay === 'visit_this_weekend') {
    const saturday = nextWeekday(today, 6);
    const sunday = addDays(saturday, 1);

    return `${formatMonthDay(saturday)}-${formatMonthDay(sunday)} 이번 주말`;
  }

  if (visitDay === 'visit_next_week') {
    const nextMonday = addDays(nextWeekday(today, 1), 7);
    const nextSunday = addDays(nextMonday, 6);

    return `${formatMonthDay(nextMonday)}-${formatMonthDay(
      nextSunday,
    )} 다음 주`;
  }

  if (visitDay === 'visit_flexible') {
    return '갈 날짜의';
  }

  return '가는 날의';
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);

  return nextDate;
}

function nextWeekday(date: Date, weekday: number) {
  const daysUntilWeekday = (weekday - date.getDay() + 7) % 7;

  return addDays(date, daysUntilWeekday);
}

function formatMonthDay(date: Date) {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function datePickerValue(target: string, children: Child[]) {
  const child = children.find(candidate => candidate.id === target);

  return child ? parseDateInput(child.birthDate) : defaultBirthDate();
}

function cloneUser(user: User): User {
  return {
    ...user,
    children: user.children.map(child => ({ ...child })),
    activeChildIds: [...user.activeChildIds],
    homeAddress: user.homeAddress ? { ...user.homeAddress } : undefined,
    preferredLocalities: [...user.preferredLocalities],
  };
}

function regionFromAddressSido(sido?: string) {
  if (!sido) {
    return '기타 지역';
  }

  if (sido.includes('서울')) {
    return '서울';
  }

  if (sido.includes('경기')) {
    return '경기';
  }

  return '기타 지역';
}

function regionAnswerValueFromAddress(
  homeAddress: UserHomeAddress,
): RecommendationAnswerValue {
  const region = regionFromAddressSido(homeAddress.sido);

  if (region === '서울') {
    return 'region_seoul';
  }

  if (region === '경기') {
    return 'region_gyeonggi';
  }

  return 'region_other';
}

function formatHomeAddress(homeAddress: UserHomeAddress) {
  return [
    homeAddress.roadAddress || homeAddress.address,
    homeAddress.detailAddress,
  ]
    .filter(Boolean)
    .join(' ');
}

function addressesShareSameBase(
  currentAddress: UserHomeAddress | undefined,
  nextAddress: UserHomeAddress,
) {
  if (!currentAddress) {
    return false;
  }

  return addressBaseKey(currentAddress) === addressBaseKey(nextAddress);
}

function addressBaseKey(homeAddress: UserHomeAddress) {
  return [
    homeAddress.roadAddress || homeAddress.address,
    homeAddress.jibunAddress,
    homeAddress.zonecode,
  ]
    .filter(Boolean)
    .join('|');
}

function formatShortHomeAddress(homeAddress: UserHomeAddress) {
  const localityLabel = [homeAddress.sigungu, homeAddress.bname]
    .filter(Boolean)
    .join(' ');

  return (
    localityLabel ||
    homeAddress.roadAddress ||
    homeAddress.address ||
    homeAddress.sido ||
    '설정 주소'
  );
}

function parsePostcodeSelectionUrl(url: string): UserHomeAddress | undefined {
  if (!url.startsWith('babyroo-postcode://selected?')) {
    return undefined;
  }

  const encodedData = url.match(/[?&]data=([^&]+)/)?.[1];

  if (!encodedData) {
    return undefined;
  }

  try {
    return JSON.parse(decodeURIComponent(encodedData)) as UserHomeAddress;
  } catch {
    return undefined;
  }
}

function parseDateInput(value: string) {
  const [year, month, day] = value.split('-').map(Number);

  return new Date(year, month - 1, day);
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function isValidDateInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = parseDateInput(value);

  return !Number.isNaN(date.getTime()) && date <= new Date();
}

function defaultBirthDate() {
  const today = new Date();

  return new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
}

function calculateAgeMonths(birthDateValue: string) {
  const birthDate = parseDateInput(birthDateValue);
  const today = new Date();
  let ageMonths =
    (today.getFullYear() - birthDate.getFullYear()) * 12 +
    (today.getMonth() - birthDate.getMonth());

  if (today.getDate() < birthDate.getDate()) {
    ageMonths -= 1;
  }

  return Math.max(ageMonths, 0);
}

function formatGender(gender: Child['gender']) {
  if (gender === 'female') {
    return '여아';
  }
  if (gender === 'male') {
    return '남아';
  }
  return '성별 미입력';
}

function formatDateRange(event: BabyrooEvent) {
  return `${event.startsAt} - ${event.endsAt}`;
}

function formatShortDate(value: string) {
  const [, month, day] = value.split('-');
  return `${month}.${day}`;
}

function formatPriceType(priceType: BabyrooEvent['priceType']) {
  if (priceType === 'free') {
    return '무료';
  }
  if (priceType === 'paid') {
    return '유료';
  }
  return '가격 확인필요';
}

function formatReservation(event: BabyrooEvent) {
  if (!event.reservationRequired) {
    return '예약 불필요';
  }
  if (event.reservationStatus === 'limited') {
    return '예약 필요 · 제한';
  }
  if (event.reservationStatus === 'closed') {
    return '예약 마감';
  }
  return '예약 필요';
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  authScreen: {
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
    padding: layout.screenPadding,
  },
  authBrandRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  authLogo: {
    borderRadius: radius.xl,
    height: 56,
    width: 56,
  },
  authEyebrow: {
    ...typography.caption,
    color: colors.primary,
  },
  authTitle: {
    ...typography.display,
    color: colors.text,
  },
  authSubtitle: {
    ...typography.body,
    color: colors.muted,
    marginBottom: spacing.xl,
    marginTop: spacing.md,
  },
  authValuePanel: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderRadius: radius.xl,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: spacing.xl,
    padding: layout.cardPadding,
    ...shadows.card,
  },
  authValueItem: {
    flex: 1,
  },
  authValueNumber: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  authValueLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  authValueDivider: {
    backgroundColor: colors.borderSubtle,
    height: 34,
    marginHorizontal: spacing.lg,
    width: 1,
  },
  browseButton: {
    alignItems: 'center',
    marginTop: spacing.md,
    minHeight: 44,
    justifyContent: 'center',
  },
  authRequiredButton: {
    alignSelf: 'stretch',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: 54,
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  onboardingScreen: {
    padding: layout.screenPadding,
    paddingBottom: spacing.xxxl,
  },
  onboardingStepText: {
    ...typography.caption,
    color: colors.primary,
    marginTop: spacing.xxl,
  },
  onboardingActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  screenWithTabs: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.xl,
    paddingBottom: TAB_SCREEN_BOTTOM_PADDING,
  },
  exploreRoot: {
    flex: 1,
  },
  exploreFixedHeader: {
    backgroundColor: colors.background,
    elevation: 4,
    left: 0,
    overflow: 'hidden',
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.xl,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 4,
  },
  exploreCompactHeader: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderColor: 'rgba(232, 94, 37, 0.12)',
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 68,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    position: 'absolute',
    left: layout.screenPadding,
    right: layout.screenPadding,
    top: spacing.md,
  },
  exploreHiddenHeaderLayer: {
    opacity: 0,
  },
  exploreCompactSummary: {
    flex: 1,
    minWidth: 0,
  },
  exploreCompactTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 17,
  },
  exploreCompactMeta: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 14,
    marginTop: 1,
  },
  exploreCompactIconButton: {
    alignItems: 'center',
    backgroundColor: colors.foreground,
    borderRadius: radius.pill,
    flexShrink: 0,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  exploreCompactIconText: {
    color: colors.inverseText,
    fontSize: 15,
    fontWeight: '900',
  },
  exploreList: {
    flex: 1,
  },
  exploreListContent: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: EXPLORE_HEADER_FULL_HEIGHT + spacing.lg,
    paddingBottom: TAB_SCREEN_BOTTOM_PADDING,
  },
  floatingRecommendationCta: {
    alignItems: 'center',
    backgroundColor: colors.foreground,
    borderRadius: radius.xl,
    bottom: FLOATING_RECOMMENDATION_BOTTOM,
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: spacing.xl,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    position: 'absolute',
    right: spacing.xl,
    ...shadows.elevated,
  },
  exploreFullHeader: {
    paddingBottom: spacing.lg,
  },
  floatingRecommendationTitle: {
    ...typography.caption,
    color: colors.primarySoft,
  },
  floatingRecommendationText: {
    ...typography.body,
    color: colors.inverseText,
    marginTop: 2,
  },
  floatingRecommendationBadge: {
    ...typography.caption,
    color: colors.inverseText,
  },
  headerRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  headerTitleGroup: {
    flex: 1,
  },
  homeMasthead: {
    backgroundColor: colors.background,
    paddingTop: spacing.sm,
  },
  mastheadTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  mastheadIconButton: {
    alignItems: 'center',
    backgroundColor: colors.foreground,
    borderRadius: radius.pill,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  mastheadIconText: {
    color: colors.inverseText,
    fontSize: 17,
    fontWeight: '900',
  },
  exploreTopHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
    paddingTop: spacing.sm,
  },
  babyrooBrandMark: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    minWidth: 0,
  },
  babyrooBrandMarkCompact: {
    flexShrink: 0,
    gap: spacing.xs,
  },
  babyrooBrandIcon: {
    borderColor: 'rgba(232, 94, 37, 0.16)',
    borderRadius: 11,
    borderWidth: 1,
    height: 34,
    width: 34,
  },
  babyrooBrandIconCompact: {
    borderRadius: 9,
    height: 28,
    width: 28,
  },
  babyrooBrandText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 22,
  },
  exploreMasthead: {
    backgroundColor: colors.primarySoft,
    borderColor: 'rgba(232, 94, 37, 0.12)',
    borderWidth: 1,
    borderRadius: radius.xxxl,
    marginTop: spacing.lg,
    padding: spacing.xl,
  },
  eyebrow: {
    ...typography.caption,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  pageTitle: {
    ...typography.display,
    color: colors.text,
  },
  pageSubtitle: {
    ...typography.body,
    color: colors.muted,
    marginTop: spacing.xs,
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    ...shadows.card,
    width: 34,
  },
  iconButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  recommendationSetupCard: {
    backgroundColor: colors.primarySoft,
    borderColor: 'rgba(232, 94, 37, 0.12)',
    borderRadius: radius.xxl,
    borderWidth: 1,
    marginTop: spacing.lg,
    padding: layout.cardPadding,
    ...shadows.elevated,
  },
  recommendationSetupTitle: {
    ...typography.title,
    color: colors.text,
    marginTop: spacing.xs,
  },
  recommendationSetupMeta: {
    ...typography.body,
    color: colors.muted,
    marginTop: spacing.sm,
  },
  recommendationSetupFootnote: {
    ...typography.caption,
    color: colors.muted,
    marginTop: spacing.md,
  },
  recommendationContextRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: 'rgba(232, 94, 37, 0.16)',
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    minHeight: 58,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  recommendationContextLabel: {
    ...typography.caption,
    color: colors.primaryStrong,
  },
  recommendationContextValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
    marginTop: 2,
  },
  creditStatusTextLink: {
    alignSelf: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  creditStatusTextLinkText: {
    ...typography.caption,
    color: colors.primaryStrong,
  },
  recommendationContextAction: {
    ...typography.caption,
    color: colors.primaryStrong,
  },
  recommendationPrimaryButton: {
    marginTop: spacing.lg,
  },
  recommendationConfirmButton: {
    marginTop: spacing.lg,
  },
  recommendationQuestionCard: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderRadius: radius.xl,
    borderWidth: 1,
    marginTop: spacing.lg,
    padding: layout.cardPadding,
    ...shadows.card,
  },
  recommendationQuestionCardInSetup: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    marginTop: 0,
    padding: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  recommendationQuestionHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  recommendationQuestionTitleGroup: {
    flex: 1,
    minWidth: 0,
  },
  recommendationQuestionCloseButton: {
    flexShrink: 0,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
  recommendationOptionList: {
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  recommendationOption: {
    backgroundColor: colors.cream,
    borderColor: colors.borderSubtle,
    borderRadius: radius.lg,
    borderWidth: 1,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  recommendationOptionSelected: {
    backgroundColor: colors.surface,
    borderColor: colors.primary,
  },
  recommendationOptionText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  recommendationOptionTextSelected: {
    color: colors.primaryStrong,
  },
  darkCardLabel: {
    color: colors.primaryStrong,
  },
  darkCardTitle: {
    color: colors.text,
  },
  darkCardMeta: {
    color: colors.muted,
  },
  darkCardLinkText: {
    color: colors.primaryStrong,
  },
  recommendationQuestionActions: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  recommendationBackButton: {
    alignSelf: 'flex-start',
  },
  recommendationNextButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  recommendationNextButtonText: {
    color: colors.inverseText,
    fontSize: 13,
    fontWeight: '900',
  },
  recommendationAnswerSummary: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.borderSubtle,
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: spacing.lg,
    padding: spacing.sm,
  },
  recommendationAnswerSummaryDark: {
    backgroundColor: colors.surface,
    borderColor: 'rgba(232, 94, 37, 0.16)',
    marginTop: spacing.xs,
  },
  recommendationAnswerSummaryLabel: {
    marginBottom: spacing.xs,
    marginTop: 0,
  },
  recommendationAnswerList: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  recommendationAnswerItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  recommendationAnswerQuestion: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
  },
  recommendationAnswerQuestionDark: {
    color: colors.muted,
  },
  recommendationAnswerValue: {
    color: colors.text,
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'right',
  },
  recommendationAnswerValueDark: {
    color: colors.text,
  },
  recommendationAnswerEdit: {
    color: colors.primary,
    flexShrink: 0,
    fontSize: 11,
    fontWeight: '900',
  },
  recommendationAnswerEditDark: {
    color: colors.primaryStrong,
  },
  recommendationDebugPrompt: {
    backgroundColor: colors.text,
    borderRadius: radius.md,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  recommendationDebugHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  recommendationDebugTitle: {
    color: colors.surface,
    fontSize: 12,
    fontWeight: '900',
  },
  recommendationDebugToggle: {
    color: colors.primarySoft,
    fontSize: 12,
    fontWeight: '900',
  },
  recommendationDebugCollapsedText: {
    color: colors.surface,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 16,
    marginTop: spacing.sm,
  },
  recommendationDebugLabel: {
    color: colors.primarySoft,
    fontSize: 11,
    fontWeight: '900',
    marginBottom: spacing.sm,
  },
  recommendationDebugText: {
    color: colors.surface,
    fontFamily: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      default: undefined,
    }),
    fontSize: 11,
    lineHeight: 16,
  },
  recommendationDebugInline: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  recommendationDebugInlineText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
  },
  recommendationEmptyState: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderRadius: radius.lg,
    borderStyle: 'dashed',
    borderWidth: 1,
    marginTop: spacing.md,
    padding: spacing.xl,
  },
  emptyStateTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  emptyStateText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
    marginTop: spacing.sm,
  },
  retryButton: {
    alignSelf: 'flex-start',
    marginTop: spacing.md,
  },
  recommendationHistorySection: {
    marginTop: spacing.xxxl,
  },
  recommendationHistoryEmpty: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderRadius: radius.md,
    borderStyle: 'dashed',
    borderWidth: 1,
    marginTop: spacing.md,
    padding: spacing.lg,
  },
  recommendationHistoryItem: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: spacing.md,
    padding: spacing.lg,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
  },
  recommendationHistoryItemLoading: {
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.primarySoft,
  },
  recommendationHistoryBody: {
    gap: spacing.sm,
  },
  recommendationHistoryHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  recommendationHistoryTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  recommendationHistoryMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  recommendationHistoryPreview: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  recommendationHistoryBadge: {
    color: colors.primaryStrong,
    fontSize: 12,
    fontWeight: '900',
  },
  creditBalanceCard: {
    backgroundColor: colors.primarySoft,
    borderColor: 'rgba(232, 94, 37, 0.16)',
    borderWidth: 1,
    borderRadius: radius.lg,
    marginTop: spacing.xxl,
    padding: spacing.lg,
  },
  creditBalanceValue: {
    color: colors.text,
    fontSize: 36,
    fontWeight: '900',
    marginTop: spacing.xs,
  },
  creditPackageCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    padding: spacing.lg,
  },
  creditPackageTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  creditPackageMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  creditLedgerItem: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    padding: spacing.lg,
  },
  creditLedgerReason: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  creditLedgerDate: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  creditLedgerAmount: {
    color: colors.danger,
    fontSize: 16,
    fontWeight: '900',
  },
  creditLedgerAmountPositive: {
    color: colors.mintText,
  },
  settingsScreen: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxxl + 72,
  },
  settingsCard: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderRadius: radius.xl,
    borderWidth: 1,
    marginTop: spacing.xxl,
    padding: layout.cardPadding,
    ...shadows.card,
  },
  settingsSection: {
    marginTop: spacing.xxxl,
  },
  settingsLabel: {
    ...typography.caption,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  settingsTitle: {
    ...typography.section,
    color: colors.text,
  },
  settingsMeta: {
    ...typography.body,
    color: colors.muted,
    marginTop: spacing.xs,
  },
  settingsRegionRow: {
    marginTop: spacing.lg,
  },
  addressCard: {
    alignItems: 'center',
    backgroundColor: colors.cream,
    borderColor: colors.borderSubtle,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
    minHeight: 68,
    padding: spacing.md,
  },
  addressTextGroup: {
    flex: 1,
    minWidth: 0,
  },
  addressTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 20,
  },
  addressMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: 3,
  },
  addressSearchButton: {
    alignItems: 'center',
    backgroundColor: colors.foreground,
    borderRadius: radius.pill,
    flexShrink: 0,
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  addressSearchButtonText: {
    color: colors.inverseText,
    fontSize: 12,
    fontWeight: '900',
  },
  textInput: {
    backgroundColor: colors.cream,
    borderColor: colors.borderSubtle,
    borderRadius: radius.lg,
    borderWidth: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginTop: spacing.md,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  textInputDisabled: {
    opacity: 0.55,
  },
  datePickerButton: {
    backgroundColor: colors.cream,
    borderColor: colors.borderSubtle,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginTop: spacing.md,
    minHeight: 58,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  datePickerText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  datePickerMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  placeholderText: {
    color: colors.muted,
  },
  childCard: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderRadius: radius.xl,
    borderWidth: 1,
    marginTop: spacing.md,
    padding: spacing.lg,
  },
  childCardSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  childCardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  childActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  childName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  childMeta: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  checkCircle: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  checkCircleSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkText: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: '900',
  },
  checkTextSelected: {
    color: colors.surface,
  },
  editButton: {
    backgroundColor: colors.cream,
    borderColor: colors.borderSubtle,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  editButtonText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
  removeButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderRadius: radius.pill,
    borderWidth: 1,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  removeButtonText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '900',
  },
  resetUserButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: colors.danger,
    borderRadius: radius.pill,
    borderWidth: 1,
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  resetUserButtonText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '900',
  },
  addChildButton: {
    alignItems: 'center',
    backgroundColor: colors.cream,
    borderColor: colors.borderSubtle,
    borderRadius: radius.xl,
    borderStyle: 'dashed',
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 56,
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  addChildPlus: {
    color: colors.primary,
    fontSize: 22,
    fontWeight: '900',
  },
  addChildText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  linkText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '800',
  },
  chipRow: {
    marginHorizontal: -spacing.md,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  chip: {
    alignSelf: 'flex-start',
    backgroundColor: colors.cream,
    borderColor: colors.borderSubtle,
    borderRadius: radius.pill,
    borderWidth: 1,
    marginRight: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipSelected: {
    backgroundColor: colors.foreground,
    borderColor: colors.foreground,
  },
  chipDense: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  chipText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  chipTextSelected: {
    color: colors.inverseText,
  },
  sectionHeader: {
    marginTop: spacing.xxxl,
  },
  sectionHeaderCompact: {
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    ...typography.section,
    color: colors.text,
  },
  sectionMeta: {
    ...typography.body,
    color: colors.muted,
    marginTop: 3,
  },
  eventTypeSelector: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: radius.lg,
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: 0,
  },
  eventTypeOption: {
    alignItems: 'center',
    backgroundColor: colors.cream,
    borderColor: colors.borderSubtle,
    borderRadius: radius.lg,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    height: 44,
    justifyContent: 'center',
    minWidth: 0,
    paddingHorizontal: spacing.xs,
  },
  eventTypeOptionSelected: {
    backgroundColor: colors.foreground,
  },
  eventTypeIcon: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexShrink: 0,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  eventTypeIconSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  eventTypeIconText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '900',
    lineHeight: 13,
  },
  eventTypeIconTextSelected: {
    color: colors.inverseText,
  },
  eventTypeLabel: {
    color: colors.text,
    flexShrink: 1,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '900',
    textAlign: 'center',
  },
  eventTypeLabelSelected: {
    color: colors.inverseText,
  },
  resultCount: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800',
    marginTop: spacing.md,
  },
  exploreControlsHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    minHeight: 32,
  },
  exploreControlsSummaryArea: {
    flex: 1,
    minWidth: 0,
  },
  exploreControlsTitleRow: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  exploreCriteriaSummaryBlock: {
    flex: 1,
    minWidth: 0,
  },
  exploreIntentTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
    lineHeight: 22,
  },
  exploreIntentMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
    marginTop: spacing.xs,
  },
  exploreControlsTitle: {
    ...typography.caption,
    color: colors.text,
    flexShrink: 0,
  },
  exploreControlsTitleInMasthead: {
    color: colors.text,
  },
  exploreControlsSummary: {
    color: colors.muted,
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '700',
  },
  exploreControlsSummaryInMasthead: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 18,
    marginTop: 2,
  },
  exploreControlsChevronButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.56)',
    borderColor: 'rgba(232, 94, 37, 0.16)',
    borderRadius: radius.pill,
    borderWidth: 1,
    flexShrink: 0,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  exploreControlsChevronGlyph: {
    borderBottomColor: colors.primaryStrong,
    borderBottomWidth: 2,
    borderRightColor: colors.primaryStrong,
    borderRightWidth: 2,
    height: 9,
    width: 9,
  },
  exploreControlsChevronGlyphDown: {
    marginTop: -3,
    transform: [{ rotate: '45deg' }],
  },
  exploreControlsChevronGlyphUp: {
    marginTop: 3,
    transform: [{ rotate: '225deg' }],
  },
  exploreControlSection: {
    minHeight: 58,
  },
  exploreFilterSection: {
    minHeight: 50,
  },
  exploreControlDivider: {
    backgroundColor: colors.borderSubtle,
    height: 1,
    marginVertical: spacing.md,
  },
  exploreControlDividerInMasthead: {
    backgroundColor: 'rgba(232, 94, 37, 0.16)',
  },
  exploreControlLabel: {
    ...typography.caption,
    color: colors.muted,
  },
  exploreControlLabelInMasthead: {
    color: colors.primaryStrong,
  },
  childChipRow: {
    marginHorizontal: -spacing.md,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  childContextChip: {
    backgroundColor: colors.cream,
    borderColor: colors.borderSubtle,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginRight: spacing.sm,
    minWidth: 92,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  childContextChipSelected: {
    backgroundColor: colors.foreground,
    borderColor: colors.foreground,
  },
  childContextName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
    maxWidth: 116,
  },
  childContextNameSelected: {
    color: colors.inverseText,
  },
  childContextAge: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
  },
  childContextAgeSelected: {
    color: colors.inverseMuted,
  },
  noResultsCard: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderRadius: radius.xl,
    borderWidth: 1,
    marginTop: spacing.md,
    padding: layout.cardPadding,
  },
  noResultsTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  noResultsText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
    marginTop: spacing.xs,
  },
  eventCard: {
    alignItems: 'stretch',
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderRadius: radius.xl,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: spacing.lg,
    overflow: 'hidden',
    padding: spacing.md,
    ...shadows.card,
  },
  eventCardCompact: {
    flexDirection: 'row',
    marginTop: spacing.sm,
    minHeight: 132,
    overflow: 'visible',
  },
  thumbnail: {
    alignItems: 'center',
    borderRadius: radius.lg,
    height: 84,
    justifyContent: 'center',
    marginRight: spacing.md,
    overflow: 'hidden',
    width: 84,
  },
  thumbnailFeature: {
    borderRadius: radius.lg,
    height: 108,
    marginRight: spacing.md,
    width: 108,
  },
  thumbnailImage: {
    height: '100%',
    width: '100%',
  },
  thumbnailFallback: {
    height: '100%',
    justifyContent: 'flex-end',
    padding: spacing.md,
    width: '100%',
  },
  thumbnailBackdrop: {
    bottom: 0,
    left: 0,
    opacity: 0.9,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  thumbnailTopLine: {
    height: 8,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  thumbnailSourceText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  thumbnailCategoryText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
  },
  cardBody: {
    flex: 1,
  },
  cardBodyFeature: {
    justifyContent: 'center',
    minWidth: 0,
    paddingBottom: spacing.xs,
  },
  cardKickerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: 2,
  },
  cardKickerText: {
    color: colors.primary,
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '900',
  },
  cardKickerDivider: {
    color: colors.border,
    fontSize: 11,
    fontWeight: '900',
  },
  cardTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 20,
  },
  cardMeta: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
    marginTop: 2,
  },
  cardTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.sm,
    rowGap: spacing.xs,
  },
  cardFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  cardDate: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  recommendationReasonBox: {
    backgroundColor: colors.cream,
    borderColor: colors.borderSubtle,
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  recommendationReasonTitle: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
    marginBottom: spacing.xs,
  },
  recommendationCautionTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  recommendationReasonText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  detailRoot: {
    backgroundColor: colors.background,
    bottom: 0,
    elevation: 12,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 12,
  },
  detailContent: {
    paddingBottom: TAB_SCREEN_BOTTOM_PADDING,
  },
  detailHero: {
    backgroundColor: colors.primarySoft,
    height: 260,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    padding: spacing.xl,
  },
  detailHeroImage: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  detailHeroScrim: {
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: radius.pill,
    height: 44,
    justifyContent: 'center',
    left: spacing.xl,
    position: 'absolute',
    top: spacing.xl,
    width: 44,
  },
  backButtonText: {
    color: colors.text,
    fontSize: 34,
    fontWeight: '500',
    lineHeight: 38,
  },
  heroSource: {
    color: colors.inverseText,
    fontSize: 18,
    fontWeight: '900',
    textShadowColor: 'rgba(31, 41, 51, 0.24)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  detailPanel: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    marginTop: -spacing.xxl,
    padding: spacing.xl,
    ...shadows.card,
  },
  recommendationDetailContent: {
    padding: spacing.xl,
  },
  recommendationDetailHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  recommendationDetailBackButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  recommendationDetailBackText: {
    color: colors.text,
    fontSize: 34,
    fontWeight: '500',
    lineHeight: 38,
  },
  recommendationDetailHeaderText: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    minHeight: 44,
  },
  recommendationDetailTitle: {
    ...typography.title,
    color: colors.text,
    flexShrink: 0,
  },
  recommendationDetailTime: {
    color: colors.muted,
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    textAlign: 'right',
  },
  detailPills: {
    marginBottom: spacing.md,
  },
  detailTitle: {
    ...typography.title,
    color: colors.text,
  },
  detailMeta: {
    ...typography.body,
    color: colors.muted,
    marginTop: spacing.sm,
  },
  factGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  fact: {
    backgroundColor: colors.cream,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: radius.lg,
    minHeight: 82,
    padding: spacing.md,
    width: '47.8%',
  },
  factLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
    marginBottom: spacing.xs,
  },
  factValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  bodyText: {
    ...typography.body,
    color: colors.muted,
    marginBottom: spacing.xl,
    marginTop: spacing.sm,
  },
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.sm,
  },
  ctaBar: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderTopWidth: 1,
    bottom: 0,
    left: 0,
    padding: spacing.xl,
    position: 'absolute',
    right: 0,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: 54,
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  primaryButtonText: {
    color: colors.inverseText,
    fontSize: 15,
    fontWeight: '900',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: colors.cream,
    borderColor: colors.borderSubtle,
    borderRadius: radius.pill,
    borderWidth: 1,
    flex: 1,
    height: 54,
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  onboardingActionButton: {
    flex: 1,
  },
  textButton: {
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  emptyState: {
    justifyContent: 'center',
  },
  sheetOverlay: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  sheetDim: {
    backgroundColor: colors.foreground,
    bottom: 0,
    left: 0,
    opacity: 0.22,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    bottom: 0,
    left: 0,
    maxHeight: '88%',
    padding: spacing.xl,
    paddingBottom: spacing.xxxl,
    position: 'absolute',
    right: 0,
  },
  grabber: {
    alignSelf: 'center',
    backgroundColor: colors.border,
    borderRadius: radius.pill,
    height: 5,
    marginBottom: spacing.xxl,
    width: 64,
  },
  sheetTitle: {
    ...typography.title,
    color: colors.text,
  },
  sheetHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sheetSubtitle: {
    ...typography.body,
    color: colors.muted,
    marginTop: spacing.xs,
  },
  sheetScroll: {
    marginTop: spacing.sm,
  },
  fieldLabel: {
    ...typography.caption,
    color: colors.text,
    marginBottom: spacing.sm,
    marginTop: spacing.xxl,
  },
  sheetApplyButton: {
    marginTop: spacing.xxl,
  },
  postcodeModalRoot: {
    backgroundColor: colors.surface,
    flex: 1,
  },
  postcodeModalHeader: {
    alignItems: 'center',
    borderBottomColor: colors.borderSubtle,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  postcodeModalTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  departureAddressBody: {
    flex: 1,
    padding: spacing.lg,
  },
  departureAddressSubmitButton: {
    marginTop: spacing.xxl,
  },
  postcodeWebView: {
    flex: 1,
  },
  stepper: {
    alignItems: 'center',
    backgroundColor: colors.cream,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    height: 54,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
  },
  stepperButton: {
    color: colors.primary,
    fontSize: 24,
    fontWeight: '900',
  },
  stepperValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  bottomTabs: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderRadius: radius.xxl,
    borderWidth: 1,
    bottom: 0,
    flexDirection: 'row',
    height: TAB_BAR_HEIGHT,
    left: spacing.lg,
    paddingTop: spacing.sm,
    position: 'absolute',
    right: spacing.lg,
    ...shadows.card,
  },
  tabButton: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  tabMark: {
    color: colors.muted,
    fontSize: 22,
    fontWeight: '900',
  },
  tabMarkActive: {
    color: colors.primary,
  },
  tabLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },
  tabLabelActive: {
    color: colors.text,
  },
});

export default App;
