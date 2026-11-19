import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
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
      ? colors.mintText
      : data?.level === '보통'
      ? colors.amberText
      : data?.level === '약간 붐빔'
      ? colors.coralText
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
  return (
    <View style={styles.card}>
      <View style={styles.heading}>
        <Text style={styles.title} accessibilityRole="header">
          주변 혼잡도
        </Text>
        <Text style={styles.area}>{data?.area.name ?? area.name}</Text>
      </View>
      {!accessToken || visible?.authRequired ? (
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
        <View style={styles.reading}>
          <View style={styles.value}>
            <Text style={styles.caption}>
              {data?.quality === 'Y'
                ? '참고 혼잡도'
                : data?.state === 'last_known'
                ? '마지막 관측'
                : '현재 혼잡도'}
            </Text>
            {data?.level ? (
              <Text style={[styles.level, { color: tint }]}>{data.level}</Text>
            ) : (
              <Text style={styles.unavailable}>
                {loading ? '불러오는 중…' : '현재 정보 없음'}
              </Text>
            )}
            {observed ? (
              <Text style={styles.caption}>{observed} 기준</Text>
            ) : null}
            {data?.quality === 'Y' ? (
              <Text style={styles.caption}>
                대체값 · 최근 4주 같은 요일·시간 평균
              </Text>
            ) : null}
            {visible?.error || data?.refreshFailed ? (
              <Text style={styles.caption}>갱신하지 못했어요</Text>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="주변 혼잡도 새로고침"
            disabled={loading}
            onPress={() => {
              load();
            }}
            style={styles.refresh}
          >
            <Text style={styles.refreshText}>
              {loading ? '갱신 중…' : '새로고침'}
            </Text>
          </Pressable>
        </View>
      )}
      {loginError && (!accessToken || visible?.authRequired) ? (
        <Text style={styles.caption}>
          로그인하지 못했어요. 다시 시도해 주세요.
        </Text>
      ) : null}
      <Text style={styles.scope}>지역 기준 · 매장 내부 혼잡도 아님</Text>
      <Pressable
        accessibilityRole="link"
        onPress={() => {
          setSourceError(false);
          Linking.openURL(sourceUrl).catch(() => setSourceError(true));
        }}
        style={styles.source}
      >
        <Text style={styles.caption}>
          서울특별시 공공데이터 ↗ · 원본 무료 제공
        </Text>
      </Pressable>
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
  title: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '900',
    color: colors.text,
  },
  area: { ...typography.caption, color: colors.muted, flexShrink: 1 },
  reading: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  value: {
    flexGrow: 1,
    flexShrink: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
  },
  level: { fontSize: 20, lineHeight: 26, fontWeight: '900' },
  caption: { fontSize: 12, lineHeight: 17, color: colors.muted },
  unavailable: { ...typography.body, color: colors.muted },
  scope: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.muted,
    marginTop: spacing.xs,
  },
  refresh: {
    minHeight: 48,
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
    minHeight: 48,
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
});
