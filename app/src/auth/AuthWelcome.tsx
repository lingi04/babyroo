import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors } from '../theme/tokens';

type Props = {
  recommendation?: boolean;
  bottomPadding: number;
  onSignIn: () => Promise<void>;
  onBrowse?: () => void;
};

/** Native, scalable content over decorative artwork shared by both auth entries. */
export function AuthWelcome({
  recommendation = false,
  bottomPadding,
  onSignIn,
  onBrowse,
}: Props) {
  const [signingIn, setSigningIn] = useState(false);
  const signingInRef = useRef(false);
  const mountedRef = useRef(true);
  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const signIn = async () => {
    if (signingInRef.current) {
      return;
    }
    signingInRef.current = true;
    setSigningIn(true);
    try {
      // The app handler presents expected provider/API errors and cancellation.
      await onSignIn();
    } catch {
      // Native press handlers do not consume rejected promises. Configuration
      // and local persistence can still fail outside the app's expected paths.
      if (mountedRef.current) {
        Alert.alert(
          '로그인 실패',
          '로그인을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.',
        );
      }
    } finally {
      signingInRef.current = false;
      if (mountedRef.current) {
        setSigningIn(false);
      }
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }]}
      keyboardShouldPersistTaps="handled"
      testID={recommendation ? 'guest-welcome' : 'login-welcome'}
    >
      <ImageBackground
        source={require('../../assets/auth/peach-curves-gradient.png')}
        style={styles.hero}
        resizeMode="stretch"
        accessible={false}
      >
        {!recommendation && <Text style={styles.wordmark}>babyroo</Text>}
        <Image
          source={require('../../assets/auth/family-pin.png')}
          style={[
            styles.illustration,
            recommendation && styles.guestIllustration,
          ]}
          resizeMode="contain"
          resizeMethod="resize"
          accessible={false}
          importantForAccessibility="no"
        />
        <Text style={styles.title} accessibilityRole="header">
          {recommendation
            ? '우리 아이에게 맞는\n나들이를 찾아볼까요?'
            : '우리 아이들에게 맞는\n나들이를 찾아볼까요?'}
        </Text>
        <Text style={styles.subtitle}>
          {'아이의 나이와 관심사에 맞춰\n갈 만한 곳을 함께 골라드려요.'}
        </Text>
      </ImageBackground>
      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [
            styles.googleButton,
            (signingIn || pressed) && styles.pressed,
          ]}
          onPress={signIn}
          disabled={signingIn}
          accessibilityRole="button"
          accessibilityLabel={
            recommendation
              ? 'Sign in for personalization'
              : 'Continue with Google'
          }
          accessibilityState={{ disabled: signingIn, busy: signingIn }}
        >
          {signingIn ? (
            <ActivityIndicator color={colors.text} accessible={false} />
          ) : (
            <Image
              source={require('../../assets/auth/google-g.png')}
              style={styles.googleIcon}
              accessible={false}
              resizeMode="contain"
              resizeMethod="resize"
            />
          )}
          <Text style={styles.googleText}>
            {signingIn ? '로그인 중...' : 'Google로 계속하기'}
          </Text>
        </Pressable>
        {onBrowse && (
          <Pressable
            style={styles.browseButton}
            onPress={onBrowse}
            accessibilityRole="button"
            accessibilityLabel="Browse without login"
          >
            <Text style={styles.browseText}>로그인 없이 둘러보기</Text>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { flexGrow: 1 },
  hero: { paddingHorizontal: 20, paddingBottom: 64 },
  wordmark: {
    fontFamily: 'Dosis-ExtraBold',
    color: colors.primaryStrong,
    fontSize: 26,
    lineHeight: 32,
    marginTop: 24,
  },
  illustration: {
    width: 184,
    height: 184,
    alignSelf: 'center',
    marginTop: 48,
    marginBottom: 40,
  },
  guestIllustration: { marginTop: 24 },
  title: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 28,
    lineHeight: 36,
    color: colors.text,
  },
  subtitle: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 14,
    lineHeight: 22,
    color: '#39312C',
    marginTop: 16,
  },
  actions: { paddingHorizontal: 20, paddingTop: 32, paddingBottom: 24 },
  googleButton: {
    minHeight: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#332F2C',
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  googleIcon: { width: 24, height: 24 },
  googleText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
    flexShrink: 1,
  },
  pressed: { opacity: 0.6 },
  browseButton: {
    minHeight: 48,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  browseText: {
    fontFamily: 'Pretendard-SemiBold',
    color: colors.exploreSelectedLabel,
    fontSize: 15,
    lineHeight: 22,
  },
});
