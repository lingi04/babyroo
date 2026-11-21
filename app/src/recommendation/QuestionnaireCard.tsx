import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type {
  RecommendationAnswerMap,
  RecommendationAnswerValue,
  RecommendationQuestion,
} from './types';

export function QuestionnaireCard({
  active,
  answers,
  question,
  questionIndex,
  questionCount,
  onAnswer,
  onBack,
  onClose,
}: {
  active: boolean;
  answers: RecommendationAnswerMap;
  question: RecommendationQuestion;
  questionIndex: number;
  questionCount: number;
  onAnswer: (
    id: RecommendationQuestion['id'],
    value: RecommendationAnswerValue,
  ) => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const [pending, setPending] = useState<RecommendationAnswerValue>();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const entrance = useRef(new Animated.Value(0)).current;
  const [screenReaderEnabled, setScreenReaderEnabled] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isScreenReaderEnabled().then(enabled => {
      if (mounted) setScreenReaderEnabled(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener(
      'screenReaderChanged',
      setScreenReaderEnabled,
    );
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);
  useEffect(() => {
    const animation = Animated.timing(entrance, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [entrance]);
  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setPending(undefined);
  }, []);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  useEffect(() => {
    if (!active) cancel();
  }, [active, cancel]);
  const selectedValue = pending ?? answers[question.id];
  const icons: Partial<Record<RecommendationAnswerValue, number>> = {
    interest_transport: 0,
    interest_animals: 1,
    interest_water: 2,
    interest_music: 3,
  };
  const choose = (value: RecommendationAnswerValue) => {
    if (!active || timer.current) return;
    if (value === 'departure_input') {
      onAnswer(question.id, value);
      return;
    }
    setPending(value);
    timer.current = setTimeout(
      () => {
        timer.current = null;
        onAnswer(question.id, value);
      },
      screenReaderEnabled ? 900 : 250,
    );
  };
  return (
    <View>
      <View style={styles.toolbar}>
        <Pressable
          accessibilityLabel="Previous recommendation question"
          disabled={questionIndex === 0}
          onPress={() => {
            cancel();
            onBack();
          }}
          style={styles.toolbarButton}
        >
          <Text
            style={[styles.toolbarText, questionIndex === 0 && styles.disabled]}
          >
            ‹ 이전
          </Text>
        </Pressable>
        <Text
          style={styles.step}
          accessibilityLabel={`질문 ${questionIndex + 1} / ${questionCount}`}
        >
          <Text style={styles.stepCurrent}>{questionIndex + 1}</Text>/
          {questionCount}
        </Text>
        <Pressable
          accessibilityLabel="Close recommendation questions"
          onPress={() => {
            cancel();
            onClose();
          }}
          style={styles.toolbarButton}
        >
          <Text style={styles.toolbarText}>닫기</Text>
        </Pressable>
      </View>
      <View
        style={styles.progress}
        accessibilityRole="progressbar"
        accessibilityValue={{
          min: 0,
          max: questionCount,
          now: questionIndex + 1,
        }}
      >
        <View
          style={[
            styles.progressFill,
            { width: `${((questionIndex + 1) / questionCount) * 100}%` },
          ]}
        />
      </View>
      <Animated.View
        style={{
          opacity: entrance,
          transform: [
            {
              translateY: entrance.interpolate({
                inputRange: [0, 1],
                outputRange: [8, 0],
              }),
            },
          ],
        }}
      >
        <Text style={styles.title} accessibilityRole="header">
          {question.prompt}
        </Text>
        <View style={styles.options} accessibilityRole="radiogroup">
          {question.options.map(option => {
            const selected = option.value === selectedValue;
            const icon = icons[option.value];
            return (
              <Pressable
                key={option.value}
                onPress={() => choose(option.value)}
                accessibilityLabel={`Answer recommendation ${option.label}`}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected, disabled: !!pending }}
                style={({ pressed }) => [
                  styles.option,
                  icon != null && styles.illustratedOption,
                  selected && styles.selected,
                  pressed && styles.pressed,
                ]}
              >
                {icon != null && (
                  <View style={styles.icon} accessible={false}>
                    <Image
                      source={require('../../assets/recommendation-interests.png')}
                      style={[
                        styles.atlas,
                        {
                        left: -(icon % 2) * 70 - 7,
                        top: -Math.floor(icon / 2) * 70 - 7,
                        },
                      ]}
                    />
                  </View>
                )}
                <Text style={styles.optionText}>{option.label}</Text>
                {selected && (
                  <Text accessible={false} style={styles.check}>
                    ✓
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  toolbarButton: { minHeight: 44, minWidth: 56, justifyContent: 'center' },
  toolbarText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 16,
    lineHeight: 24,
    color: '#57534E',
  },
  disabled: { opacity: 0.35 },
  step: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 20,
    lineHeight: 28,
    color: '#57534E',
  },
  stepCurrent: { fontFamily: 'Pretendard-Bold', color: '#E85E25' },
  progress: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EAE8E5',
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#FA6A2E', borderRadius: 3 },
  title: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 28,
    lineHeight: 36,
    color: '#000000',
    marginTop: 32,
    marginBottom: 28,
  },
  options: { gap: 12 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    minHeight: 56,
    borderWidth: 1,
    borderColor: '#D9D4CF',
    borderRadius: 16,
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  illustratedOption: { minHeight: 80 },
  selected: { backgroundColor: '#FFF0E7', borderColor: '#FA6A2E' },
  pressed: { opacity: 0.8 },
  optionText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 18,
    lineHeight: 26,
    color: '#000000',
    flex: 1,
    minWidth: 0,
  },
  check: { fontSize: 24, color: '#E85E25' },
  icon: { width: 56, height: 56, overflow: 'hidden', flexShrink: 0 },
  atlas: { position: 'absolute', width: 140, height: 140 },
});
