import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BabyrooEvent, eventsNewestFirst, recommendedEvents } from './src/data/events';
import { colors, radius, spacing } from './src/theme/tokens';

type Tab = 'home' | 'explore' | 'saved';

function App() {
  const [tab, setTab] = useState<Tab>('home');
  const [selectedEvent, setSelectedEvent] = useState<BabyrooEvent | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);

  const openDetail = (event: BabyrooEvent) => {
    setSelectedEvent(event);
    setFilterOpen(false);
  };

  const closeDetail = () => setSelectedEvent(null);

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      {selectedEvent ? (
        <EventDetail event={selectedEvent} onBack={closeDetail} />
      ) : (
        <>
          {tab === 'home' ? (
            <HomeScreen onOpenEvent={openDetail} />
          ) : tab === 'explore' ? (
            <ExploreScreen
              onOpenEvent={openDetail}
              onOpenFilter={() => setFilterOpen(true)}
            />
          ) : (
            <SavedScreen />
          )}
          <BottomTabs activeTab={tab} onChange={setTab} />
          {filterOpen ? <FilterSheet onClose={() => setFilterOpen(false)} /> : null}
        </>
      )}
    </SafeAreaView>
  );
}

function HomeScreen({ onOpenEvent }: { onOpenEvent: (event: BabyrooEvent) => void }) {
  return (
    <ScrollView contentContainerStyle={styles.screenWithTabs}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.eyebrow}>오늘 아이와 어디 갈까요?</Text>
          <Text style={styles.pageTitle}>이번 주말 추천</Text>
        </View>
        <Pressable style={styles.iconButton} accessibilityLabel="Open filters">
          <Text style={styles.iconButtonText}>≡</Text>
        </Pressable>
      </View>

      <View style={styles.profileCard}>
        <View>
          <Text style={styles.profileTitle}>18개월 · 서울</Text>
          <Text style={styles.profileMeta}>아이 월령과 지역 기준</Text>
        </View>
        <Text style={styles.linkText}>바꾸기</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
        {['실내', '무료', '예약필요', '24개월 이하'].map((chip, index) => (
          <Chip key={chip} label={chip} selected={index === 0} />
        ))}
      </ScrollView>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>바로 고를 만한 후보</Text>
        <Text style={styles.sectionMeta}>월령, 지역, 날짜가 맞는 행사예요</Text>
      </View>

      {recommendedEvents.map((event, index) => (
        <EventCard
          key={event.id}
          event={event}
          compact
          tone={index}
          onPress={() => onOpenEvent(event)}
        />
      ))}

      <View style={styles.latestTeaser}>
        <Text style={styles.sectionTitle}>새로 추가된 행사</Text>
        <Text style={styles.linkText}>전체 보기</Text>
      </View>
    </ScrollView>
  );
}

function ExploreScreen({
  onOpenEvent,
  onOpenFilter,
}: {
  onOpenEvent: (event: BabyrooEvent) => void;
  onOpenFilter: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.screenWithTabs}>
      <Text style={styles.pageTitle}>행사 탐색</Text>
      <Text style={styles.pageSubtitle}>새로 추가된 순서로 보여드려요</Text>

      <View style={styles.searchField}>
        <Text style={styles.searchText}>제목, 장소, 지역 검색</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
        {['18개월', '서울', '이번 주말'].map(chip => (
          <Chip key={chip} label={chip} selected />
        ))}
        <Pressable onPress={onOpenFilter}>
          <Chip label="필터" />
        </Pressable>
      </ScrollView>

      <Text style={styles.resultCount}>5개 행사 · 최신 추가순 · 순번 5, 4, 3, 2, 1</Text>

      {eventsNewestFirst.map((event, index) => (
        <EventCard
          key={event.id}
          event={event}
          tone={index}
          showSequence
          onPress={() => onOpenEvent(event)}
        />
      ))}
    </ScrollView>
  );
}

function EventDetail({
  event,
  onBack,
}: {
  event: BabyrooEvent;
  onBack: () => void;
}) {
  const recommendation = useMemo(() => getRecommendationReason(event), [event]);

  return (
    <View style={styles.detailRoot}>
      <ScrollView contentContainerStyle={styles.detailContent}>
        <View style={styles.detailHero}>
          <Pressable style={styles.backButton} onPress={onBack} accessibilityLabel="Go back">
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
            <Fact label="가격" value={event.priceText || formatPriceType(event.priceType)} />
            <Fact label="예약" value={formatReservation(event)} />
            <Fact label="장소" value={event.venueName} />
          </View>

          <View style={styles.reasonBox}>
            <Text style={styles.reasonTitle}>추천 판단</Text>
            <Text style={styles.reasonText}>{recommendation}</Text>
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

      <View style={styles.ctaBar}>
        <Pressable style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>원문 / 예약 페이지 열기</Text>
        </Pressable>
      </View>
    </View>
  );
}

function SavedScreen() {
  return (
    <View style={[styles.screenWithTabs, styles.emptyState]}>
      <Text style={styles.pageTitle}>저장한 행사</Text>
      <Text style={styles.pageSubtitle}>관심 있는 행사를 저장하면 여기에 모입니다.</Text>
    </View>
  );
}

function FilterSheet({ onClose }: { onClose: () => void }) {
  return (
    <View style={styles.sheetOverlay}>
      <Pressable style={styles.sheetDim} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.grabber} />
        <Text style={styles.sheetTitle}>Filter</Text>

        <Text style={styles.fieldLabel}>Baby age</Text>
        <View style={styles.stepper}>
          <Text style={styles.stepperButton}>−</Text>
          <Text style={styles.stepperValue}>18 months</Text>
          <Text style={styles.stepperButton}>+</Text>
        </View>

        <Text style={styles.fieldLabel}>Theme</Text>
        <View style={styles.wrapRow}>
          <Chip label="Indoor" selected />
          <Chip label="Outdoor" />
          <Chip label="Class" />
        </View>

        <Pressable style={styles.primaryButton} onPress={onClose}>
          <Text style={styles.primaryButtonText}>Apply filters</Text>
        </Pressable>
      </View>
    </View>
  );
}

function EventCard({
  event,
  compact,
  showSequence,
  tone,
  onPress,
}: {
  event: BabyrooEvent;
  compact?: boolean;
  showSequence?: boolean;
  tone: number;
  onPress: () => void;
}) {
  const color = [colors.primarySoft, colors.blue, colors.mint, colors.lilac][tone % 4];

  return (
    <Pressable style={[styles.eventCard, compact && styles.eventCardCompact]} onPress={onPress}>
      {showSequence ? (
        <View style={styles.sequenceBadge}>
          <Text style={styles.sequenceText}>{event.csvSequence}</Text>
        </View>
      ) : null}
      <View style={[styles.thumbnail, { backgroundColor: color }]}>
        <Text style={styles.thumbnailText}>{event.category.slice(0, 2).toUpperCase()}</Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={compact ? 2 : 3}>
          {event.title}
        </Text>
        <Text style={styles.cardMeta} numberOfLines={2}>
          {event.venueName} · {formatAge(event)}
        </Text>
        <View style={styles.cardFooter}>
          <Chip label={event.indoor ? '실내' : '확인필요'} dense />
          <Text style={styles.cardDate}>{formatShortDate(event.startsAt)}</Text>
        </View>
      </View>
    </Pressable>
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
    <View style={[styles.chip, selected && styles.chipSelected, dense && styles.chipDense]}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
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
  onChange,
}: {
  activeTab: Tab;
  onChange: (tab: Tab) => void;
}) {
  const tabs: Array<{ id: Tab; label: string; mark: string }> = [
    { id: 'home', label: '추천', mark: '⌂' },
    { id: 'explore', label: '탐색', mark: '⌕' },
    { id: 'saved', label: '저장', mark: '♡' },
  ];

  return (
    <View style={styles.bottomTabs}>
      {tabs.map(tab => {
        const active = tab.id === activeTab;
        return (
          <Pressable key={tab.id} style={styles.tabButton} onPress={() => onChange(tab.id)}>
            <Text style={[styles.tabMark, active && styles.tabMarkActive]}>{tab.mark}</Text>
            <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function formatAge(event: BabyrooEvent) {
  if (event.ageMinMonths == null && event.ageMaxMonths == null) {
    return '월령 확인필요';
  }
  if (event.ageMinMonths != null && event.ageMaxMonths != null) {
    return `${event.ageMinMonths}-${event.ageMaxMonths}개월`;
  }
  if (event.ageMinMonths != null) {
    return `${event.ageMinMonths}개월 이상`;
  }
  return `${event.ageMaxMonths}개월 이하`;
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

function getRecommendationReason(event: BabyrooEvent) {
  if (event.ageMinMonths != null && event.ageMinMonths > 18) {
    return `18개월 아이에게는 월령이 맞지 않을 수 있어요. 원문에서 대상 연령 ${formatAge(event)}을 확인해 주세요.`;
  }
  if (event.indoor) {
    return `${formatAge(event)} 아이에게 맞고, 실내에서 진행돼요. 날씨 영향을 적게 받는 후보입니다.`;
  }
  return '월령과 지역 조건을 먼저 확인한 뒤 원문에서 상세 운영 정보를 확인해 주세요.';
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screenWithTabs: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: 112,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  eyebrow: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  pageTitle: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
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
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  iconButtonText: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '700',
  },
  profileCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xxl,
    padding: spacing.lg,
  },
  profileTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  profileMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  linkText: {
    color: colors.primaryStrong,
    fontSize: 14,
    fontWeight: '800',
  },
  chipRow: {
    marginHorizontal: -spacing.xl,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  chip: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    marginRight: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primarySoft,
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
  latestTeaser: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xxl,
  },
  searchField: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    marginTop: spacing.xxl,
    paddingHorizontal: spacing.lg,
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
    marginTop: spacing.xl,
  },
  eventCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: spacing.md,
    minHeight: 152,
    padding: spacing.lg,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
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
    left: spacing.md,
    position: 'absolute',
    top: spacing.md,
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
    borderRadius: radius.lg,
    height: 88,
    justifyContent: 'center',
    marginRight: spacing.lg,
    width: 88,
  },
  thumbnailText: {
    color: colors.primaryStrong,
    fontSize: 14,
    fontWeight: '900',
  },
  cardBody: {
    flex: 1,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
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
  detailRoot: {
    flex: 1,
    backgroundColor: colors.background,
  },
  detailContent: {
    paddingBottom: 112,
  },
  detailHero: {
    backgroundColor: colors.primarySoft,
    height: 260,
    justifyContent: 'flex-end',
    padding: spacing.xl,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
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
    color: colors.primaryStrong,
    fontSize: 18,
    fontWeight: '900',
  },
  detailPanel: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    marginTop: -spacing.xxl,
    padding: spacing.xl,
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
  reasonBox: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    marginVertical: spacing.xl,
    padding: spacing.lg,
  },
  reasonTitle: {
    color: colors.primaryStrong,
    fontSize: 13,
    fontWeight: '900',
    marginBottom: spacing.xs,
  },
  reasonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 21,
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
    borderColor: colors.border,
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
    borderRadius: radius.lg,
    height: 54,
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: '900',
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
    backgroundColor: '#000000',
    bottom: 0,
    left: 0,
    opacity: 0.18,
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
  fieldLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: spacing.sm,
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
    borderColor: colors.border,
    borderTopWidth: 1,
    bottom: 0,
    flexDirection: 'row',
    height: 82,
    left: 0,
    paddingTop: spacing.sm,
    position: 'absolute',
    right: 0,
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
