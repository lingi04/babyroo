import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { getCurrentCrowdingFromBabyrooApi } from '../api/babyrooApi';
import { colors, radius, spacing, typography } from '../theme/tokens';
import type { CrowdingArea, CurrentCrowding } from './types';

const sourceUrl =
  'https://data.seoul.go.kr/dataList/OA-21285/A/1/datasetView.do';
type State = {
  identity: string;
  data?: CurrentCrowding;
  loading: boolean;
  error: boolean;
  authRequired?: boolean;
};

export function CurrentCrowdingCard({
  eventId,
  area,
  accessToken,
  onSignIn,
}: {
  eventId: string;
  area: CrowdingArea;
  accessToken?: string;
  onSignIn: () => Promise<void>;
}) {
  const identity = JSON.stringify([
    eventId,
    area.id,
    area.revision,
    accessToken,
  ]);
  const identityRef = useRef(identity);
  identityRef.current = identity;
  const generation = useRef(0);
  const [state, setState] = useState<State>({
    identity,
    loading: Boolean(accessToken),
    error: false,
  });
  const [signingIn, setSigningIn] = useState(false);
  const [sourceError, setSourceError] = useState(false);
  const [loginError, setLoginError] = useState(false);
  const { width, fontScale } = useWindowDimensions();
  const stacked = width < 350 || fontScale >= 1.4;
  const load = useCallback(async () => {
    if (!accessToken) return;
    const currentGeneration = ++generation.current;
    setState(previous => ({
      identity,
      data: previous.identity === identity ? previous.data : undefined,
      loading: true,
      error: false,
    }));
    try {
      const data = await getCurrentCrowdingFromBabyrooApi(eventId, accessToken);
      if (
        identityRef.current === identity &&
        generation.current === currentGeneration
      ) {
        setState({ identity, data, loading: false, error: false });
      }
    } catch (error) {
      if (
        identityRef.current === identity &&
        generation.current === currentGeneration
      ) {
        const authRequired = Boolean(
          error &&
            typeof error === 'object' &&
            'statusCode' in error &&
            error.statusCode === 401,
        );
        setState(previous => ({
          ...previous,
          data: authRequired ? undefined : previous.data,
          identity,
          loading: false,
          error: true,
          authRequired,
        }));
      }
    }
  }, [eventId, accessToken, identity]);
  useEffect(() => {
    setSourceError(false);
    setLoginError(false);
    if (accessToken) load();
    return () => {
      generation.current += 1;
    };
  }, [accessToken, load]);

  // Never reuse a previous user's/venue's reading, even before an effect cleans it up.
  const visible =
    state.identity === identity && accessToken ? state : undefined;
  const loading = Boolean(accessToken) && (!visible || visible.loading);
  const data = visible?.data?.supported ? visible.data : undefined;
  if (visible?.data?.supported === false) return null;
  const tint =
    data?.level === '여유'
      ? '#2FA56A'
      : data?.level === '보통'
      ? '#FFB300'
      : data?.level === '약간 붐빔'
      ? colors.coral
      : colors.danger;
  const observed = data?.observedAt
    ? new Date(data.observedAt).toLocaleString('ko-KR', {
        timeZone: 'Asia/Seoul',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      })
    : null;
  const areaName = data?.area.name ?? area.name;
  const needsLogin = !accessToken || visible?.authRequired;
  const showScope = () =>
    Alert.alert(
      `${areaName} 지역 기준`,
      '해당 지역의 혼잡도예요. 시설 내부 혼잡도와 다를 수 있어요.',
    );
  const showSource = () => {
    const sourceIdentity = identity;
    setSourceError(false);
    Alert.alert('데이터 출처', '서울특별시 공공데이터\n원본 데이터 무료 제공', [
      { text: '닫기', style: 'cancel' },
      {
        text: '원본 보기',
        onPress: () => {
          Linking.openURL(sourceUrl).catch(() => {
            if (identityRef.current === sourceIdentity) setSourceError(true);
          });
        },
      },
    ]);
  };
  return (
    <View style={styles.card}>
      <View style={styles.heading}>
        <View style={styles.headingText}>
          <Text style={styles.title} accessibilityRole="header">
            주변 혼잡도
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${areaName} 지역 기준 안내`}
            accessibilityHint="시설 내부 혼잡도와의 차이를 확인합니다"
            hitSlop={{ top: 12, bottom: 12, left: 4, right: 4 }}
            onPress={showScope}
            style={styles.scope}
          >
            <Text style={styles.area}>{areaName}</Text>
            <View accessible={false} style={styles.infoIcon}>
              <Text allowFontScaling={false} style={styles.infoText}>
                i
              </Text>
            </View>
          </Pressable>
        </View>
        {!needsLogin && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="주변 혼잡도 새로고침"
            accessibilityState={{ disabled: loading }}
            disabled={loading}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            onPress={() => {
              load();
            }}
            style={styles.refresh}
          >
            <Text style={styles.refreshText}>
              {loading ? '갱신 중…' : '새로고침'}
            </Text>
          </Pressable>
        )}
      </View>
      {needsLogin ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="로그인하고 주변 혼잡도 확인"
          disabled={signingIn}
          onPress={async () => {
            setSigningIn(true);
            setLoginError(false);
            try {
              await onSignIn();
            } catch {
              setLoginError(true);
            } finally {
              setSigningIn(false);
            }
          }}
          style={styles.login}
        >
          <Text style={styles.loginText}>
            {signingIn ? '로그인 중…' : '로그인하고 확인'}
          </Text>
        </Pressable>
      ) : (
        <View style={[styles.reading, stacked && styles.readingStacked]}>
          <View style={styles.observation}>
            <Text style={styles.caption}>
              {data?.quality === 'Y'
                ? '참고 혼잡도'
                : data?.state === 'last_known'
                ? '마지막 관측'
                : '현재 혼잡도'}
            </Text>
            {observed ? (
              <Text style={styles.caption}>{observed} 기준</Text>
            ) : null}
          </View>
          <View style={[styles.status, stacked && styles.statusStacked]}>
            {data?.level ? (
              <>
                <View
                  accessible={false}
                  style={[styles.statusDot, { backgroundColor: tint }]}
                />
                <Text style={styles.level}>{data.level}</Text>
              </>
            ) : (
              <Text style={styles.unavailable}>
                {loading ? '불러오는 중…' : '현재 정보 없음'}
              </Text>
            )}
          </View>
        </View>
      )}
      {!needsLogin && data?.quality === 'Y' && (
        <Text style={styles.note}>대체값 · 최근 4주 같은 요일·시간 평균</Text>
      )}
      {!needsLogin && (visible?.error || data?.refreshFailed) && (
        <Text style={styles.note}>갱신하지 못했어요</Text>
      )}
      {loginError && (!accessToken || visible?.authRequired) ? (
        <Text style={styles.caption}>
          로그인하지 못했어요. 다시 시도해 주세요.
        </Text>
      ) : null}
      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="서울시 제공 데이터 출처"
          hitSlop={{ top: 15, bottom: 15, left: 4, right: 4 }}
          onPress={showSource}
          style={styles.source}
        >
          <Text style={styles.footerText}>서울시 제공 ›</Text>
        </Pressable>
      </View>
      {sourceError ? (
        <Text style={styles.caption}>출처 페이지를 열 수 없어요</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.xxl,
    padding: spacing.md,
    paddingBottom: spacing.xs,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
  },
  heading: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headingText: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '900',
    color: colors.text,
  },
  area: { ...typography.caption, color: colors.muted, flexShrink: 1 },
  reading: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    padding: spacing.md,
    minHeight: 64,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  readingStacked: { flexDirection: 'column', alignItems: 'stretch' },
  observation: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  status: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    borderLeftWidth: 1,
    borderColor: colors.border,
    paddingLeft: spacing.md,
    marginLeft: spacing.md,
    minHeight: 32,
  },
  statusStacked: {
    flex: 0,
    borderLeftWidth: 0,
    borderTopWidth: 1,
    paddingLeft: 0,
    marginLeft: 0,
    paddingTop: spacing.sm,
    marginTop: spacing.sm,
    justifyContent: 'flex-start',
  },
  statusDot: { width: 12, height: 12, borderRadius: radius.pill },
  level: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '900',
    color: colors.text,
    flexShrink: 1,
  },
  caption: { fontSize: 12, lineHeight: 17, color: colors.muted },
  unavailable: { ...typography.body, color: colors.muted },
  note: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.muted,
    marginTop: spacing.xs,
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.lg,
    marginTop: spacing.xs,
  },
  scope: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    gap: spacing.xs,
    paddingVertical: 1,
  },
  footerText: { fontSize: 11, lineHeight: 16, color: colors.muted },
  infoIcon: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '700',
    color: colors.muted,
  },
  refresh: {
    minHeight: 32,
    minWidth: 64,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xs,
  },
  refreshText: { ...typography.caption, color: colors.coralText },
  login: {
    marginTop: spacing.md,
    minHeight: 48,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginText: { ...typography.body, color: colors.coralText },
  source: {
    justifyContent: 'center',
    paddingVertical: 1,
  },
});
