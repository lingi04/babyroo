import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors } from '../theme/tokens';
import { AppPolicy, fetchPolicy, readCachedPolicy } from './policy';

type GateState =
  | { status: 'checking' | 'allowed' | 'invalid-build' }
  | { status: 'blocked'; policy: AppPolicy };

export function AppUpdateGate({
  nativeBuild,
  children,
}: React.PropsWithChildren<{ nativeBuild?: string }>) {
  const [state, setState] = useState<GateState>({ status: 'checking' });
  const [error, setError] = useState('');
  const retry = useRef<() => void>(() => {});

  useEffect(() => {
    let active = true;
    let inFlight = false;
    let lastPolicy: AppPolicy | null = null;
    const platform = Platform.OS;
    const build = Number(nativeBuild);
    const validBuild =
      !!nativeBuild &&
      /^\d+$/.test(nativeBuild) &&
      Number.isSafeInteger(build) &&
      build > 0;
    const apply = (policy: AppPolicy | null) => {
      if (active)
        setState(
          policy && build < policy.minimumBuild
            ? { status: 'blocked', policy }
            : { status: 'allowed' },
        );
    };
    const check = async () => {
      if (inFlight || !active) return;
      if (platform !== 'android' && platform !== 'ios') {
        apply(null);
        return;
      }
      if (!validBuild) {
        setState({ status: 'invalid-build' });
        return;
      }
      inFlight = true;
      setError('');
      try {
        lastPolicy = lastPolicy ?? (await readCachedPolicy(platform));
        if (lastPolicy && build < lastPolicy.minimumBuild) apply(lastPolicy);
        lastPolicy = await fetchPolicy(platform);
        apply(lastPolicy);
      } catch {
        apply(lastPolicy);
        if (active)
          setError('버전 정보를 확인하지 못했어요. 다시 시도해 주세요.');
      } finally {
        inFlight = false;
      }
    };
    retry.current = () => {
      check();
    };
    check();
    const subscription = AppState.addEventListener('change', next => {
      if (next === 'active') check();
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, [nativeBuild]);

  if (state.status === 'allowed') return <>{children}</>;

  const openStore = async () => {
    if (state.status !== 'blocked') return;
    try {
      await Linking.openURL(state.policy.storeUrl);
    } catch {
      setError('스토어를 열지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
  };

  return (
    <View style={styles.container}>
      {state.status === 'checking' ? (
        <ActivityIndicator
          accessibilityLabel="Checking app version"
          color={colors.primary}
        />
      ) : (
        <>
          <Text style={styles.title}>
            {state.status === 'blocked'
              ? '업데이트가 필요해요'
              : '앱 버전을 확인할 수 없어요'}
          </Text>
          <Text style={styles.message}>
            {state.status === 'blocked'
              ? state.policy.message
              : '앱을 다시 실행해 주세요.'}
          </Text>
          {state.status === 'blocked' && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Update Babyroo"
              style={styles.button}
              onPress={() => {
                openStore();
              }}
            >
              <Text style={styles.buttonText}>업데이트하기</Text>
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry version check"
            style={styles.retry}
            onPress={() => retry.current()}
          >
            <Text style={styles.message}>다시 확인</Text>
          </Pressable>
          {!!error && (
            <Text accessibilityRole="alert" style={styles.message}>
              {error}
            </Text>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  message: { color: colors.muted, fontSize: 16, textAlign: 'center' },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    padding: 18,
    marginTop: 28,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  buttonText: { color: colors.inverseText, fontSize: 16, fontWeight: '700' },
  retry: { padding: 20 },
});
