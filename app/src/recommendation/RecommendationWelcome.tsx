import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

type ChildSummary = { id: string; name: string; age: string };

export function RecommendationWelcome({
  children,
  label,
  loading,
  onStart,
  onEditChildren,
  onCredits,
}: {
  children: ChildSummary[];
  label: string;
  loading: boolean;
  onStart: () => void;
  onEditChildren: () => void;
  onCredits: () => void;
}) {
  return (
    <View testID="recommendation-welcome">
      <Text style={styles.title} accessibilityRole="header">
        이번엔 어디로{'\n'}떠날까요?
      </Text>
      <Text style={styles.description}>
        8가지 질문으로 이번 외출에 맞는{'\n'}곳을 골라보세요.
      </Text>
      <View style={styles.heroFrame}>
        <Image
          source={require('../../assets/recommendation-home.png')}
          style={styles.heroImage}
          resizeMode="contain"
          accessible={false}
        />
      </View>
      <Pressable
        style={({ pressed }) => [styles.childrenRow, pressed && styles.pressed]}
        onPress={onEditChildren}
        accessibilityRole="button"
        accessibilityLabel="Edit recommendation children"
      >
        {children.length === 1 && (
          <View style={styles.avatar} accessible={false}>
            <Image
              source={require('../../assets/recommendation-home.png')}
              style={styles.avatarImage}
            />
          </View>
        )}
        <View style={styles.childNames}>
          {children.length ? (
            children.map(child => (
              <Text key={child.id} style={styles.childText}>
                {`${child.name} · ${child.age}`}
              </Text>
            ))
          ) : (
            <Text style={styles.childText}>함께 갈 아이를 선택해 주세요</Text>
          )}
        </View>
        <Text style={styles.change}>변경 ›</Text>
      </Pressable>
      <Pressable
        style={({ pressed }) => [
          styles.start,
          pressed && styles.pressed,
          loading && styles.loading,
        ]}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel="Request recommendation"
        accessibilityState={{ disabled: loading }}
        onPress={onStart}
      >
        <Text style={styles.startText}>{label}</Text>
      </Pressable>
      <Pressable
        style={styles.creditLink}
        onPress={onCredits}
        accessibilityRole="button"
        accessibilityLabel="Open recommendation credit purchases and history"
      >
        <Text style={styles.creditText}>추천권 구매 · 사용 기록</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 28,
    lineHeight: 36,
    color: '#000000',
    marginTop: 8,
  },
  description: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 14,
    lineHeight: 20,
    color: '#57534E',
    marginTop: 12,
  },
  heroFrame: {
    width: '100%',
    aspectRatio: 2.3,
    marginTop: 8,
    marginBottom: 12,
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  childrenRow: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: '#E5E1DD',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
  },
  childNames: { flex: 1, minWidth: 0, gap: 4 },
  childText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 14,
    lineHeight: 20,
    color: '#211E1B',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFF0E7',
    overflow: 'hidden',
  },
  avatarImage: {
    position: 'absolute',
    width: 140,
    height: 61,
    left: -67,
    top: -18,
  },
  change: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 13,
    lineHeight: 18,
    color: '#57534E',
  },
  start: {
    minHeight: 52,
    marginTop: 16,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FA6A2E',
  },
  startText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 16,
    lineHeight: 24,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  creditLink: {
    alignSelf: 'center',
    minHeight: 44,
    paddingVertical: 12,
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  creditText: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 13,
    lineHeight: 18,
    color: '#716B65',
    textDecorationLine: 'underline',
  },
  pressed: { opacity: 0.75 },
  loading: { opacity: 0.5 },
});
