import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  BackHandler,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Image,
  Linking,
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
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import {
  BabyrooEvent,
  eventsNewestFirst,
} from './src/data/events';
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
  createRecommendationService,
  Preferences,
  RecommendationAnswerMap,
  RecommendationAnswerValue,
  RecommendationDebugInfo,
  RecommendationErrorCode,
  RecommendationQuestion,
  RecommendationQuestionId,
  RecommendationResult,
  RecommendationSession,
} from './src/recommendation';
import { AuthSession } from './src/auth/types';
import {
  signInWithGoogle,
  signOutFromGoogle,
} from './src/auth/GoogleAuthService';
import {
  Child,
  ChildGender,
  createUserProfile,
  currentUser,
  getSelectedChildren,
  isUserProfileComplete,
  User,
} from './src/data/user';
import {
  clearAuthSession,
  loadAuthSession,
  saveAuthSession,
} from './src/storage/authStorage';
import { clearSavedUser, loadUser, saveUser } from './src/storage/userStorage';
import { colors, radius, spacing } from './src/theme/tokens';

type Tab = 'home' | 'explore' | 'saved';
type PriceFilter = 'all' | 'free' | 'paid';
type PlaceFilter = 'all' | 'indoor' | 'outdoor';
type ReservationFilter = 'all' | 'required' | 'notRequired';
type DateFilter = 'active' | 'scheduled' | 'ongoing';
type RegionFilter = 'all' | 'seoul' | 'gyeonggi' | 'other';

type ExploreFilters = {
  ageFit: boolean;
  date: DateFilter;
  region: RegionFilter;
  place: PlaceFilter;
  price: PriceFilter;
  reservation: ReservationFilter;
};

const defaultExploreFilters: ExploreFilters = {
  ageFit: false,
  date: 'active',
  region: 'all',
  place: 'all',
  price: 'all',
  reservation: 'all',
};

function buildWeatherPlanQuestion(
  visitDay: RecommendationAnswerValue | undefined,
): RecommendationQuestion {
  return {
    id: 'weather',
    prompt: `${formatVisitWindowForWeatherQuestion(
      visitDay,
    )} 날씨를 어떻게 반영할까요?`,
    options: [
      { label: '날씨 괜찮으면 야외도 좋아요', value: 'weather_outdoor_if_suitable' },
      { label: '날씨 상관없이 실내로 갈래요', value: 'weather_prefer_indoor' },
      { label: '날씨 상관없이 야외가 좋아요', value: 'weather_prefer_outdoor' },
    ],
  };
}

function coreRecommendationQuestions(answers: RecommendationAnswerMap) {
  return [
    {
      id: 'startRegion',
      prompt: '오늘 어디에서 출발하세요?',
      options: [
        { label: '서울', value: 'region_seoul' },
        { label: '경기', value: 'region_gyeonggi' },
        { label: '기타 지역', value: 'region_other' },
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

const TAB_ORDER: Tab[] = ['home', 'explore', 'saved'];
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
  const [selectedRecommendationSession, setSelectedRecommendationSession] =
    useState<RecommendationSession | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [exploreFilters, setExploreFilters] = useState<ExploreFilters>(
    defaultExploreFilters,
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const skipNextUserSaveRef = useRef(false);
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
          user={user}
          onOpenRecommendationDetail={openRecommendationDetail}
          onOpenSettings={openSettings}
          bottomInset={bottomInset}
        />
      );
    }

    if (screenTab === 'explore') {
      return (
        <ExploreScreen
          user={user}
          filters={exploreFilters}
          onOpenEvent={openDetail}
          onOpenFilter={() => setFilterOpen(true)}
          onOpenRecommendation={() => {
            navigateToTab('home');
          }}
          onOpenSettings={openSettings}
          onToggleChild={toggleActiveChild}
          bottomInset={bottomInset}
        />
      );
    }

    if (!authSession) {
      return (
        <AuthRequiredScreen
          bottomInset={bottomInset}
          onSignIn={handleGoogleSignIn}
        />
      );
    }

    return <SavedScreen bottomInset={bottomInset} />;
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
  }, [filterOpen, selectedEvent, selectedRecommendationSession, settingsOpen, tab]);

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

  const closeRecommendationDetail = () => setSelectedRecommendationSession(null);

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

    await saveAuthSession(result.session);
    await saveUser(nextUser);
    setAuthSession(result.session);
    setBrowsingAsGuest(false);
    setUser(nextUser);
  };

  const completeOnboarding = async (nextUser: User) => {
    await saveUser(nextUser);
    setUser(nextUser);
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

  const updateHomeRegion = (homeRegion: string) => {
    setUser(previousUser => ({ ...previousUser, homeRegion }));
  };

  const updateDisplayName = (displayName: string) => {
    setUser(previousUser => ({ ...previousUser, displayName }));
  };

  const addChild = (child: Omit<Child, 'id'>) => {
    const id = `child-${Date.now()}`;

    setUser(previousUser => {
      return {
        ...previousUser,
        children: [...previousUser.children, { id, ...child }],
        activeChildIds: [...previousUser.activeChildIds, id],
      };
    });

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
      ) : settingsOpen ? (
        <SettingsScreen
          user={user}
          onBack={closeSettings}
          onAddChild={addChild}
          onRemoveChild={removeChild}
          onUpdateChild={updateChild}
          onUpdateDisplayName={updateDisplayName}
          onToggleChild={toggleActiveChild}
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
              events={eventsNewestFirst}
              questions={buildRecommendationQuestions(
                eventsNewestFirst,
                sortChildrenByAge(getSelectedChildren(user)),
                preferencesToAnswers(selectedRecommendationSession.preferences),
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
  onBrowse,
  onSignIn,
}: {
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
        Google 계정으로 시작하고, 추천에 필요한 가족 정보를 이어서
        설정합니다.
      </Text>
      <View style={styles.authValuePanel}>
        <View style={styles.authValueItem}>
          <Text style={styles.authValueNumber}>{eventsNewestFirst.length}</Text>
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
        추천과 저장 기능은 Google 로그인 후 사용할 수 있어요.
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
          <Text style={styles.settingsTitle}>앱에서 사용할 이름을 알려주세요</Text>
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
                <Chip label={formatGender(gender)} selected={gender === childGender} />
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {step === 2 ? (
        <View style={styles.settingsCard}>
          <Text style={styles.settingsLabel}>거주지</Text>
          <Text style={styles.settingsTitle}>
            추천에 우선 반영할 지역을 선택해주세요
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

      <View style={styles.onboardingActions}>
        {step > 0 ? (
          <Pressable
            style={[styles.secondaryButton, styles.onboardingActionButton]}
            onPress={() => setStep(previousStep => Math.max(previousStep - 1, 0))}
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
  user,
  onOpenRecommendationDetail,
  onOpenSettings,
  bottomInset,
}: {
  user: User;
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
  const [recommendationFlowStep, setRecommendationFlowStep] = useState<
    'idle' | 'interview' | 'confirming'
  >('idle');
  const [recommendationQuestionIndex, setRecommendationQuestionIndex] =
    useState(0);
  const [returnToConfirmationAfterAnswer, setReturnToConfirmationAfterAnswer] =
    useState(false);
  const recommendationQuestions = useMemo(
    () =>
      buildRecommendationQuestions(
        eventsNewestFirst,
        selectedChildren,
        recommendationAnswers,
      ),
    [recommendationAnswers, selectedChildren],
  );
  const recommendationService = useMemo(
    () =>
      createRecommendationService({
        provider: 'mock',
        mockOptions: {
          delayMs: 0,
          getLocalContext: () => ({
            events: eventsNewestFirst,
            selectedChildren,
            user,
          }),
        },
      }),
    [selectedChildren, user],
  );
  const currentRecommendationQuestion =
    recommendationQuestions[recommendationQuestionIndex];
  const latestRecommendationSession = recommendationSessions[0];
  const selectedRecommendationSession =
    recommendationSessions.find(
      session => session.id === selectedRecommendationSessionId,
    ) ?? latestRecommendationSession;
  const storedRecommendationSessions = recommendationSessions.filter(
    session => session.status === 'success' && session.results.length > 0,
  );

  const startRecommendationInterview = () => {
    setRecommendationAnswers({});
    setRecommendationQuestionIndex(0);
    setReturnToConfirmationAfterAnswer(false);
    setRecommendationFlowStep('interview');
  };

  const requestRecommendation = async (answers: RecommendationAnswerMap) => {
    const sessionId = `recommendation-${Date.now()}`;
    const preferences = answersToPreferences(answers);
    const loadingSession: RecommendationSession = {
      id: sessionId,
      createdAt: new Date().toISOString(),
      userId: user.id,
      selectedChildIds: selectedChildren.map(child => child.id),
      preferences,
      status: 'loading',
      results: [],
      credit: {
        policy: 'none',
        cost: 0,
        consumed: false,
      },
    };

    setRecommendationFlowStep('idle');
    setRecommendationSessions(previousSessions => [
      loadingSession,
      ...previousSessions,
    ]);
    setSelectedRecommendationSessionId(sessionId);

    const response = await recommendationService.recommend({
      sessionId,
      userId: user.id,
      selectedChildIds: selectedChildren.map(child => child.id),
      preferences,
      client: {
        locale: 'ko-KR',
        timezone: 'Asia/Seoul',
        requestedAt: loadingSession.createdAt,
      },
      debug: __DEV__,
    });

    const resolvedSession: RecommendationSession =
      response.status === 'success'
        ? {
            ...loadingSession,
            status: 'success',
            results: response.results,
            debug: response.debug,
          }
        : {
            ...loadingSession,
            status: 'failed',
            results: [],
            debug: response.debug,
            error: {
              code: response.errorCode,
              message: response.errorMessage,
              retryable: response.retryable,
            },
          };

    setRecommendationSessions(previousSessions =>
      previousSessions.map(session => {
        if (session.id !== sessionId) {
          return session;
        }

        return resolvedSession;
      }),
    );

    if (resolvedSession.status === 'success' && resolvedSession.results.length > 0) {
      onOpenRecommendationDetail(resolvedSession);
    }
  };

  const answerRecommendationQuestion = (
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
    <ScrollView
      contentContainerStyle={[
        styles.screenWithTabs,
        tabScreenBottomPadding(bottomInset),
      ]}
    >
        <View style={styles.headerRow}>
          <View style={styles.headerTitleGroup}>
            <Text style={styles.eyebrow}>오늘 아이와 어디 갈까요?</Text>
            <Text style={styles.pageTitle}>맞춤 추천</Text>
          </View>
          <Pressable
            style={styles.iconButton}
            onPress={onOpenSettings}
            accessibilityLabel="Open user settings"
          >
            <Text style={styles.iconButtonText}>⚙</Text>
          </Pressable>
        </View>

      <View style={styles.recommendationSetupCard}>
        <Text style={styles.settingsLabel}>추천 준비</Text>
        <Text style={styles.settingsTitle}>조건에 맞는 후보만 추려볼까요?</Text>
        <Text style={styles.settingsMeta}>
          선택한 조건을 기준으로 아이에게 맞는 후보를 먼저 보여드립니다.
        </Text>

        <View style={styles.recommendationCriteriaGroup}>
          <Text style={styles.fieldLabel}>기준</Text>
          <View style={styles.wrapRow}>
            <Pressable
              onPress={onOpenSettings}
              accessibilityLabel="Edit recommendation children"
            >
              <Chip label={formatChildrenAges(selectedChildren)} selected />
            </Pressable>
            <Pressable
              onPress={onOpenSettings}
              accessibilityLabel="Edit recommendation residence"
            >
              <Chip label={user.homeRegion} selected />
            </Pressable>
          </View>
        </View>

        <Pressable
          style={styles.primaryButton}
          onPress={startRecommendationInterview}
          accessibilityLabel="Request recommendation"
        >
          <Text style={styles.primaryButtonText}>
            {latestRecommendationSession
              ? '다시 추천 받기 · 1회 사용'
              : '추천 받기 · 1회 사용'}
          </Text>
        </Pressable>
        {latestRecommendationSession ? (
          <Text style={styles.settingsMeta}>
            최근 추천{' '}
            {formatRecommendationSessionTime(
              latestRecommendationSession.createdAt,
            )}{' '}
            · 총 {recommendationSessions.length}회 사용
          </Text>
        ) : null}
      </View>

      {recommendationFlowStep === 'interview' &&
      currentRecommendationQuestion ? (
        <RecommendationQuestionCard
          answers={recommendationAnswers}
          question={currentRecommendationQuestion}
          questionIndex={recommendationQuestionIndex}
          questionCount={recommendationQuestions.length}
          questions={recommendationQuestions}
          onAnswer={answerRecommendationQuestion}
          onBack={() =>
            setRecommendationQuestionIndex(previousIndex =>
              Math.max(previousIndex - 1, 0),
            )
          }
          onClose={() => setRecommendationFlowStep('idle')}
        />
      ) : null}

      {recommendationFlowStep === 'confirming' ? (
        <RecommendationConfirmationCard
          answers={recommendationAnswers}
          questions={recommendationQuestions}
          onConfirm={() => requestRecommendation(recommendationAnswers)}
          onEditAnswer={editRecommendationAnswer}
        />
      ) : null}

      <View style={styles.recommendationHistorySection}>
        <View style={styles.sectionHeaderCompact}>
          <Text style={styles.sectionTitle}>추천 기록</Text>
          <Text style={styles.sectionMeta}>
            추천받은 결과를 조건별로 다시 볼 수 있어요
          </Text>
        </View>
        {storedRecommendationSessions.length > 0 ? (
          storedRecommendationSessions.map(session => (
            <RecommendationSessionCard
              key={session.id}
              events={eventsNewestFirst}
              questions={recommendationQuestions}
              session={session}
              onPress={() => {
                setSelectedRecommendationSessionId(session.id);
                onOpenRecommendationDetail(session);
              }}
            />
          ))
        ) : (
          <View style={styles.recommendationHistoryEmpty}>
            <Text style={styles.emptyStateTitle}>아직 추천 기록이 없어요</Text>
            <Text style={styles.emptyStateText}>
              추천을 받으면 조건과 결과가 여기에 쌓입니다.
            </Text>
          </View>
        )}
      </View>

      {selectedRecommendationSession?.status === 'loading' ? (
        <View style={styles.recommendationEmptyState}>
          <Text style={styles.emptyStateTitle}>
            아이에게 맞는 후보를 고르고 있어요
          </Text>
          <Text style={styles.emptyStateText}>
            조건과 행사 정보를 비교하는 중입니다.
          </Text>
        </View>
      ) : selectedRecommendationSession?.status === 'failed' ? (
        <RecommendationFailureState
          errorCode={selectedRecommendationSession.error?.code ?? 'unknown'}
          retryable={selectedRecommendationSession.error?.retryable ?? true}
          onRetry={() => requestRecommendation(recommendationAnswers)}
        />
      ) : selectedRecommendationSession?.status === 'success' &&
        selectedRecommendationSession.results.length === 0 ? (
        <View style={styles.recommendationEmptyState}>
          <Text style={styles.emptyStateTitle}>조건에 맞는 추천이 없어요</Text>
          <Text style={styles.emptyStateText}>
            일정이나 장소 조건을 넓혀서 다시 추천받아 보세요.
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

function RecommendationQuestionCard({
  answers,
  question,
  questionIndex,
  questionCount,
  questions,
  onAnswer,
  onBack,
  onClose,
}: {
  answers: RecommendationAnswerMap;
  question: RecommendationQuestion;
  questionIndex: number;
  questionCount: number;
  questions: RecommendationQuestion[];
  onAnswer: (
    questionId: RecommendationQuestionId,
    value: RecommendationAnswerValue,
  ) => void;
  onBack: () => void;
  onClose: () => void;
}) {
  return (
    <View style={styles.recommendationQuestionCard}>
      <View style={styles.recommendationQuestionHeader}>
        <View>
          <Text style={styles.settingsLabel}>
            질문 {questionIndex + 1}/{questionCount}
          </Text>
          <Text style={styles.settingsTitle}>{question.prompt}</Text>
        </View>
        <Pressable onPress={onClose} accessibilityLabel="Close recommendation questions">
          <Text style={styles.linkText}>닫기</Text>
        </Pressable>
      </View>

      <RecommendationAnswerSummary answers={answers} questions={questions} />

      <View style={styles.recommendationOptionList}>
        {question.options.map(option => (
          <Pressable
            key={option.value}
            style={styles.recommendationOption}
            onPress={() => onAnswer(question.id, option.value)}
            accessibilityLabel={`Answer recommendation ${option.label}`}
          >
            <Text style={styles.recommendationOptionText}>
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {questionIndex > 0 ? (
        <Pressable
          style={styles.recommendationBackButton}
          onPress={onBack}
          accessibilityLabel="Previous recommendation question"
        >
          <Text style={styles.linkText}>이전 질문</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function RecommendationAnswerSummary({
  answers,
  questions,
  onEditAnswer,
}: {
  answers: RecommendationAnswerMap;
  questions: RecommendationQuestion[];
  onEditAnswer?: (questionId: RecommendationQuestionId) => void;
}) {
  const answeredQuestions = questions.filter(question =>
    Boolean(answers[question.id]),
  );

  if (answeredQuestions.length === 0) {
    return null;
  }

  return (
    <View style={styles.recommendationAnswerSummary}>
      <Text style={styles.fieldLabel}>선택한 답변</Text>
      <View style={styles.recommendationAnswerList}>
        {answeredQuestions.map(question => (
          <Pressable
            key={question.id}
            style={styles.recommendationAnswerItem}
            onPress={
              onEditAnswer ? () => onEditAnswer(question.id) : undefined
            }
            accessibilityLabel={`Edit answer ${recommendationQuestionLabel(
              question,
            )}`}
          >
            <Text style={styles.recommendationAnswerQuestion}>
              {recommendationQuestionLabel(question)}
            </Text>
            <Text style={styles.recommendationAnswerValue}>
              {recommendationAnswerLabel(question, answers[question.id])}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function RecommendationConfirmationCard({
  answers,
  onConfirm,
  onEditAnswer,
  questions,
}: {
  answers: RecommendationAnswerMap;
  onConfirm: () => void;
  onEditAnswer: (questionId: RecommendationQuestionId) => void;
  questions: RecommendationQuestion[];
}) {
  return (
    <View style={styles.recommendationQuestionCard}>
      <Text style={styles.settingsLabel}>추천 확인</Text>
      <Text style={styles.settingsTitle}>이 조건으로 추천 받을까요?</Text>
      <Text style={styles.settingsMeta}>
        지금은 추천권이 차감되지 않아요. 추천 결과가 있으면 나중에 1회가
        사용될 수 있어요.
      </Text>
      <RecommendationAnswerSummary
        answers={answers}
        questions={questions}
        onEditAnswer={onEditAnswer}
      />
      {__DEV__ ? (
        <View style={styles.recommendationDebugInline}>
          <Text style={styles.recommendationDebugInlineText}>
            DEBUG · maxPromptCandidates=20 · maxInitialResults=3
          </Text>
        </View>
      ) : null}
      <Pressable
        style={styles.primaryButton}
        onPress={onConfirm}
        accessibilityLabel="Confirm recommendation request"
      >
        <Text style={styles.primaryButtonText}>추천 받기</Text>
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
  return (
    <Pressable
      style={styles.recommendationHistoryItem}
      onPress={onPress}
      accessibilityLabel="Open stored recommendation"
    >
      <View style={styles.recommendationHistoryBody}>
        <View style={styles.recommendationHistoryHeader}>
          <Text style={styles.recommendationHistoryTitle}>
            {formatRecommendationSessionTime(session.createdAt)} 추천
          </Text>
          <Text style={styles.recommendationHistoryBadge}>보기</Text>
        </View>
        <Text style={styles.recommendationHistoryMeta} numberOfLines={1}>
          {formatRecommendationSessionAnswerSummary(session, questions)}
        </Text>
        <Text style={styles.recommendationHistoryPreview} numberOfLines={2}>
          {formatRecommendationSessionEventPreview(session, events)}
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
  user,
  filters,
  onOpenEvent,
  onOpenFilter,
  onOpenRecommendation,
  onOpenSettings,
  onToggleChild,
  bottomInset,
}: {
  user: User;
  filters: ExploreFilters;
  onOpenEvent: (event: BabyrooEvent) => void;
  onOpenFilter: () => void;
  onOpenRecommendation: () => void;
  onOpenSettings: () => void;
  onToggleChild: (childId: string) => void;
  bottomInset: number;
}) {
  const selectedChildren = sortChildrenByAge(getSelectedChildren(user));
  const childrenByAge = sortChildrenByAge(user.children);
  const [searchQuery, setSearchQuery] = useState('');
  const [recommendationCtaVisible, setRecommendationCtaVisible] =
    useState(false);
  const [exploreControlsCollapsed, setExploreControlsCollapsed] =
    useState(true);
  const activeFilterCount = countActiveExploreFilters(filters);
  const filteredEvents = useMemo(
    () =>
      filterEvents(eventsNewestFirst, searchQuery, filters, selectedChildren),
    [filters, searchQuery, selectedChildren],
  );
  const activeFilterLabels = getActiveExploreFilterLabels(filters);
  const exploreCriteriaSummary = formatExploreCriteriaSummary(
    selectedChildren,
    activeFilterLabels,
  );

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextVisible = event.nativeEvent.contentOffset.y > 420;

    if (nextVisible !== recommendationCtaVisible) {
      setRecommendationCtaVisible(nextVisible);
    }
  };

  return (
    <View style={styles.exploreRoot}>
      <ScrollView
        contentContainerStyle={[
          styles.screenWithTabs,
          tabScreenBottomPadding(bottomInset),
        ]}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerTitleGroup}>
            <Text style={styles.pageTitle}>행사 탐색</Text>
          </View>
          <Pressable
            style={styles.iconButton}
            onPress={onOpenSettings}
            accessibilityLabel="Open user settings"
          >
            <Text style={styles.iconButtonText}>⚙</Text>
          </Pressable>
        </View>

        <View style={styles.searchField}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="행사 제목 검색"
            placeholderTextColor={colors.muted}
            returnKeyType="search"
            autoCorrect={false}
          />
        </View>

        <View
          style={[
            styles.exploreControlsPanel,
            exploreControlsCollapsed && styles.exploreControlsPanelCollapsed,
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
            <View>
              <View style={styles.exploreControlsTitleRow}>
                <Text style={styles.exploreControlsTitle}>탐색 기준</Text>
                <Text style={styles.exploreControlsSummary} numberOfLines={1}>
                  {exploreCriteriaSummary}
                </Text>
              </View>
            </View>
            <View style={styles.exploreControlsActions}>
              <Text style={styles.exploreControlsToggle}>
                {exploreControlsCollapsed ? '펼치기' : '접기'}
              </Text>
            </View>
          </Pressable>

          {exploreControlsCollapsed ? null : (
            <>
              <View style={styles.exploreControlDivider} />

              <View style={styles.exploreControlSection}>
                <Text style={styles.exploreControlLabel}>아이 월령 기준</Text>
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

              <View style={styles.exploreControlDivider} />

              <View
                style={[
                  styles.exploreControlSection,
                  styles.exploreFilterSection,
                ]}
              >
                <Text style={styles.exploreControlLabel}>필터</Text>
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
        </View>

        <Text style={styles.resultCount}>
          {filteredEvents.length}개 행사 · 최신 추가순
        </Text>

        {filteredEvents.length > 0 ? (
          filteredEvents.map((event, index) => (
            <EventCard
              key={event.id}
              event={event}
              tone={index}
              showSequence
              onPress={() => onOpenEvent(event)}
            />
          ))
        ) : (
          <View style={styles.noResultsCard}>
            <Text style={styles.noResultsTitle}>조건에 맞는 행사가 없어요</Text>
            <Text style={styles.noResultsText}>
              검색어를 줄이거나 필터를 넓혀서 다시 찾아보세요.
            </Text>
          </View>
        )}
      </ScrollView>

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
    .map(result => events.find(event => event.id === result.eventId))
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

function SavedScreen({ bottomInset }: { bottomInset: number }) {
  return (
    <View
      style={[
        styles.screenWithTabs,
        tabScreenBottomPadding(bottomInset),
        styles.emptyState,
      ]}
    >
      <Text style={styles.pageTitle}>저장한 행사</Text>
      <Text style={styles.pageSubtitle}>
        관심 있는 행사를 저장하면 여기에 모입니다.
      </Text>
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
  onSelectRegion,
  onResetUser,
  onSignOut,
}: {
  user: User;
  onBack: () => void;
  onAddChild: (child: Omit<Child, 'id'>) => string;
  onRemoveChild: (childId: string) => void;
  onUpdateChild: (
    childId: string,
    childPatch: Partial<Omit<Child, 'id'>>,
  ) => void;
  onUpdateDisplayName: (displayName: string) => void;
  onToggleChild: (childId: string) => void;
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

  const handleAddChild = () => {
    const newChildId = onAddChild({
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
          <Text style={styles.eyebrow}>추천 기준 관리</Text>
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
        <View style={styles.wrapRow}>
          {regions.map(region => (
            <Pressable key={region} onPress={() => onSelectRegion(region)}>
              <Chip label={region} selected={region === user.homeRegion} />
            </Pressable>
          ))}
        </View>
      </View>

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
  const updateFilter = <Key extends keyof ExploreFilters>(
    key: Key,
    value: ExploreFilters[Key],
  ) => {
    onChangeFilters({ ...filters, [key]: value });
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
          <Pressable onPress={() => onChangeFilters(defaultExploreFilters)}>
            <Text style={styles.linkText}>초기화</Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.sheetScroll}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.fieldLabel}>아이 월령</Text>
          <View style={styles.wrapRow}>
            <Pressable onPress={() => updateFilter('ageFit', !filters.ageFit)}>
              <Chip
                label="선택한 아이에게 맞는 행사"
                selected={filters.ageFit}
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
                    filters.date === 'active' || filters.date === value
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
                <Chip label={label} selected={filters.region === value} />
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
                <Chip label={label} selected={filters.price === value} />
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
                <Chip label={label} selected={filters.place === value} />
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
                <Chip label={label} selected={filters.reservation === value} />
              </Pressable>
            ))}
          </View>

          <Pressable
            style={[styles.primaryButton, styles.sheetApplyButton]}
            onPress={onClose}
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
      {showSequence ? (
        <View style={styles.sequenceBadge}>
          <Text style={styles.sequenceText}>{event.csvSequence}</Text>
        </View>
      ) : null}
      <View style={[styles.thumbnail, { backgroundColor: color }]}>
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
      <View style={styles.cardBody}>
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
          <Text style={styles.cardDate}>{formatShortDate(event.startsAt)}</Text>
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
                <Text style={styles.recommendationCautionTitle}>
                  확인할 점
                </Text>
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
    [colors.primary, colors.mint, colors.blue],
    [colors.blueText, colors.primarySoft, colors.lilac],
    [colors.mintText, colors.blue, colors.primarySoft],
    [colors.lilacText, colors.mint, colors.blue],
  ][tone % 4];

  return (
    <View style={styles.thumbnailFallback}>
      <View
        style={[styles.thumbnailBackdrop, { backgroundColor: palette[1] }]}
      />
      <View
        style={[styles.thumbnailAccentLarge, { backgroundColor: palette[0] }]}
      />
      <View
        style={[styles.thumbnailAccentSmall, { backgroundColor: palette[2] }]}
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
    { id: 'saved', label: '저장', mark: '♡' },
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
) {
  return [
    ...coreRecommendationQuestions(answers),
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

function formatRecommendationSessionEventPreview(
  session: RecommendationSession,
  events: BabyrooEvent[],
) {
  const recommendedEvents = session.results
    .map(result => events.find(event => event.id === result.eventId))
    .filter((event): event is BabyrooEvent => Boolean(event));
  const previewTitles = recommendedEvents
    .slice(0, 2)
    .map(event => event.title);
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

function answersToPreferences(answers: RecommendationAnswerMap): Preferences {
  return {
    startRegion:
      answers.startRegion === 'region_seoul'
        ? 'seoul'
        : answers.startRegion === 'region_gyeonggi'
          ? 'gyeonggi'
          : answers.startRegion === 'region_other'
            ? 'other'
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

function preferencesToAnswers(preferences: Preferences): RecommendationAnswerMap {
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

function formatExploreCriteriaSummary(
  selectedChildren: Child[],
  activeFilterLabels: string[],
) {
  const childSummary =
    selectedChildren.length === 0
      ? '아이 정보 없음'
      : selectedChildren.length === 1
        ? `${selectedChildren[0].nickname} · ${formatChildAge(
            selectedChildren[0],
          )}`
        : `${selectedChildren[0].nickname} 외 ${selectedChildren.length - 1}명`;
  const filterSummary =
    activeFilterLabels.length > 0
      ? activeFilterLabels.slice(0, 2).join(', ')
      : '기본 필터';
  const remainingFilterCount = Math.max(activeFilterLabels.length - 2, 0);

  if (remainingFilterCount > 0) {
    return `${childSummary} · ${filterSummary} 외 ${remainingFilterCount}`;
  }

  return `${childSummary} · ${filterSummary}`;
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

function formatChildrenAges(children: Child[]) {
  if (children.length === 0) {
    return '아이 정보 없음';
  }

  const uniqueAges = [...new Set(children.map(formatChildAge))];

  return uniqueAges.join(', ');
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

    return `${formatMonthDay(nextMonday)}-${formatMonthDay(nextSunday)} 다음 주`;
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
    preferredLocalities: [...user.preferredLocalities],
  };
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
    padding: spacing.xl,
  },
  authBrandRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  authLogo: {
    borderRadius: radius.lg,
    height: 56,
    width: 56,
  },
  authEyebrow: {
    color: colors.primaryStrong,
    fontSize: 16,
    fontWeight: '900',
  },
  authTitle: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 37,
  },
  authSubtitle: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 21,
    marginBottom: spacing.xl,
    marginTop: spacing.md,
  },
  authValuePanel: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: spacing.xl,
    padding: spacing.lg,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 22,
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
    borderRadius: radius.lg,
    height: 54,
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  onboardingScreen: {
    padding: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  onboardingStepText: {
    color: colors.primaryStrong,
    fontSize: 12,
    fontWeight: '900',
    marginTop: spacing.xxl,
  },
  onboardingActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  screenWithTabs: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: TAB_SCREEN_BOTTOM_PADDING,
  },
  exploreRoot: {
    flex: 1,
  },
  floatingRecommendationCta: {
    alignItems: 'center',
    backgroundColor: colors.primaryStrong,
    borderRadius: radius.md,
    bottom: FLOATING_RECOMMENDATION_BOTTOM,
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    position: 'absolute',
    right: spacing.xl,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
  },
  floatingRecommendationTitle: {
    color: colors.primarySoft,
    fontSize: 12,
    fontWeight: '900',
  },
  floatingRecommendationText: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: '900',
    marginTop: 2,
  },
  floatingRecommendationBadge: {
    color: colors.surface,
    fontSize: 12,
    fontWeight: '900',
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
  eyebrow: {
    color: colors.primaryStrong,
    fontSize: 12,
    fontWeight: '900',
    marginBottom: spacing.xs,
  },
  pageTitle: {
    color: colors.text,
    fontSize: 27,
    fontWeight: '900',
    lineHeight: 33,
  },
  pageSubtitle: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderRadius: radius.lg,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    width: 44,
  },
  iconButtonText: {
    color: colors.primaryStrong,
    fontSize: 20,
    fontWeight: '700',
  },
  recommendationSetupCard: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginTop: spacing.xl,
    padding: spacing.lg,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
  },
  recommendationCriteriaGroup: {
    marginTop: spacing.lg,
  },
  recommendationQuestionCard: {
    backgroundColor: colors.surface,
    borderColor: '#B9DED8',
    borderRadius: radius.lg,
    borderWidth: 1,
    marginTop: spacing.lg,
    padding: spacing.lg,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
  },
  recommendationQuestionHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  recommendationOptionList: {
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  recommendationOption: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.borderSubtle,
    borderRadius: radius.md,
    borderWidth: 1,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  recommendationOptionText: {
    color: colors.primaryStrong,
    fontSize: 14,
    fontWeight: '900',
  },
  recommendationBackButton: {
    alignSelf: 'flex-start',
    marginTop: spacing.md,
  },
  recommendationAnswerSummary: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.borderSubtle,
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: spacing.lg,
    padding: spacing.md,
  },
  recommendationAnswerList: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  recommendationAnswerItem: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  recommendationAnswerQuestion: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  recommendationAnswerValue: {
    color: colors.text,
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'right',
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
  settingsScreen: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  settingsCard: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginTop: spacing.xxl,
    padding: spacing.lg,
  },
  settingsSection: {
    marginTop: spacing.xxxl,
  },
  settingsLabel: {
    color: colors.primaryStrong,
    fontSize: 12,
    fontWeight: '900',
    marginBottom: spacing.xs,
  },
  settingsTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  settingsMeta: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
    marginTop: spacing.xs,
  },
  textInput: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.borderSubtle,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginTop: spacing.md,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  datePickerButton: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.borderSubtle,
    borderRadius: radius.md,
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
    borderRadius: radius.lg,
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
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.borderSubtle,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  editButtonText: {
    color: colors.primaryStrong,
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
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.borderSubtle,
    borderRadius: radius.lg,
    borderStyle: 'dashed',
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 56,
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  addChildPlus: {
    color: colors.primaryStrong,
    fontSize: 22,
    fontWeight: '900',
  },
  addChildText: {
    color: colors.primaryStrong,
    fontSize: 14,
    fontWeight: '900',
  },
  linkText: {
    color: colors.primaryStrong,
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
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.borderSubtle,
    borderRadius: radius.pill,
    borderWidth: 1,
    marginRight: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: '#B9DED8',
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
    color: colors.primaryStrong,
  },
  sectionHeader: {
    marginTop: spacing.xxxl,
  },
  sectionHeaderCompact: {
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
  },
  sectionMeta: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 3,
  },
  searchField: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    justifyContent: 'center',
    marginTop: spacing.xl,
    paddingHorizontal: spacing.md,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
  },
  searchIcon: {
    color: colors.primaryStrong,
    fontSize: 20,
    fontWeight: '900',
    marginRight: spacing.sm,
  },
  searchInput: {
    color: colors.text,
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    height: '100%',
    padding: 0,
  },
  searchText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '600',
  },
  resultCount: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800',
    marginTop: spacing.md,
  },
  exploreControlsPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
  },
  exploreControlsPanelCollapsed: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  exploreControlsHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    minHeight: 32,
  },
  exploreControlsTitleRow: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  exploreControlsTitle: {
    color: colors.text,
    flexShrink: 0,
    fontSize: 13,
    fontWeight: '900',
  },
  exploreControlsSummary: {
    color: colors.muted,
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '700',
  },
  exploreControlsToggle: {
    color: colors.primaryStrong,
    fontSize: 12,
    fontWeight: '900',
  },
  exploreControlsActions: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 0,
    gap: spacing.md,
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
  exploreControlLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  childChipRow: {
    marginHorizontal: -spacing.md,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  childContextChip: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.borderSubtle,
    borderRadius: radius.md,
    borderWidth: 1,
    marginRight: spacing.sm,
    minWidth: 92,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  childContextChipSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: '#B9DED8',
  },
  childContextName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
    maxWidth: 116,
  },
  childContextNameSelected: {
    color: colors.primaryStrong,
  },
  childContextAge: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
  },
  childContextAgeSelected: {
    color: colors.primaryStrong,
  },
  noResultsCard: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginTop: spacing.md,
    padding: spacing.xl,
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
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: spacing.sm,
    minHeight: 140,
    padding: spacing.md,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
  },
  eventCardCompact: {
    minHeight: 132,
  },
  sequenceBadge: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: 28,
    justifyContent: 'center',
    left: spacing.sm,
    position: 'absolute',
    top: spacing.sm,
    width: 28,
    zIndex: 1,
  },
  sequenceText: {
    color: colors.surface,
    fontSize: 13,
    fontWeight: '900',
  },
  thumbnail: {
    alignItems: 'center',
    borderRadius: radius.md,
    height: 84,
    justifyContent: 'center',
    marginRight: spacing.md,
    overflow: 'hidden',
    width: 84,
  },
  thumbnailImage: {
    height: '100%',
    width: '100%',
  },
  thumbnailFallback: {
    height: '100%',
    justifyContent: 'flex-end',
    padding: spacing.sm,
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
  thumbnailAccentLarge: {
    borderRadius: 28,
    height: 58,
    opacity: 0.85,
    position: 'absolute',
    right: -18,
    top: -14,
    width: 58,
  },
  thumbnailAccentSmall: {
    borderRadius: 16,
    bottom: 30,
    height: 32,
    left: -10,
    opacity: 0.9,
    position: 'absolute',
    width: 32,
  },
  thumbnailSourceText: {
    color: colors.text,
    fontSize: 17,
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
  cardTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 22,
  },
  cardMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
    marginTop: spacing.xs,
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
    marginTop: spacing.md,
  },
  cardDate: {
    color: colors.primaryStrong,
    fontSize: 12,
    fontWeight: '800',
  },
  recommendationReasonBox: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.borderSubtle,
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  recommendationReasonTitle: {
    color: colors.primaryStrong,
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
    backgroundColor: 'rgba(24, 33, 47, 0.24)',
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
    color: colors.surface,
    fontSize: 18,
    fontWeight: '900',
    textShadowColor: 'rgba(31, 41, 51, 0.24)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  detailPanel: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    marginTop: -spacing.xxl,
    padding: spacing.xl,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.05,
    shadowRadius: 18,
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
    color: colors.text,
    flexShrink: 0,
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 28,
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
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 31,
  },
  detailMeta: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
    marginTop: spacing.sm,
  },
  factGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  fact: {
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: radius.md,
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
    color: colors.muted,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 22,
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
    borderRadius: radius.md,
    height: 54,
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  primaryButtonText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: '900',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderRadius: radius.md,
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
    backgroundColor: colors.text,
    bottom: 0,
    left: 0,
    opacity: 0.22,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
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
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  sheetHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sheetSubtitle: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  sheetScroll: {
    marginTop: spacing.sm,
  },
  fieldLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: spacing.sm,
    marginTop: spacing.xxl,
  },
  sheetApplyButton: {
    marginTop: spacing.xxl,
  },
  stepper: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    height: 54,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
  },
  stepperButton: {
    color: colors.primaryStrong,
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
    borderTopWidth: 1,
    bottom: 0,
    flexDirection: 'row',
    height: TAB_BAR_HEIGHT,
    left: 0,
    paddingTop: spacing.sm,
    position: 'absolute',
    right: 0,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
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
    color: colors.primaryStrong,
  },
  tabLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },
  tabLabelActive: {
    color: colors.primaryStrong,
  },
});

export default App;
