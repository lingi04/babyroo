import React from 'react';
import { AccessibilityInfo } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { QuestionnaireCard } from './QuestionnaireCard';
import { buildQuestionnaire } from './questionnaire';
import type { RecommendationQuestion } from './types';

const legacy: RecommendationQuestion[] = [
  {
    id: 'startRegion',
    prompt: '',
    options: [
      { value: 'region_seoul', label: '집' },
      { value: 'departure_input', label: '직접' },
    ],
  },
  {
    id: 'visitDay',
    prompt: '',
    options: [
      { value: 'visit_soon', label: '' },
      { value: 'visit_this_weekend', label: '' },
      { value: 'visit_next_week', label: '' },
      { value: 'visit_flexible', label: '' },
    ],
  },
  {
    id: 'weather',
    prompt: '',
    options: [
      { value: 'weather_outdoor_if_suitable', label: '' },
      { value: 'weather_prefer_indoor', label: '' },
      { value: 'weather_prefer_outdoor', label: '' },
    ],
  },
  {
    id: 'mobility',
    prompt: '차로 이동할 수 있나요?',
    options: [{ value: 'mobility_car', label: '가능해요' }],
  },
  {
    id: 'priceComfort',
    prompt: '',
    options: [
      { value: 'price_free', label: '' },
      { value: 'price_low', label: '' },
      { value: 'price_any', label: '' },
    ],
  },
  {
    id: 'reservationComfort',
    prompt: '',
    options: [
      { value: 'reservation_none', label: '' },
      { value: 'reservation_ok', label: '' },
      { value: 'reservation_any', label: '' },
    ],
  },
  { id: 'vibe', prompt: '', options: [] },
];

test('questionnaire uses eight questions with interest third and the age-dependent final question', () => {
  expect(buildQuestionnaire(legacy, 23).map(item => item.id)).toEqual([
    'startRegion',
    'visitDay',
    'interest',
    'mobility',
    'weather',
    'priceComfort',
    'reservationComfort',
    'duration',
  ]);
  expect(buildQuestionnaire(legacy, 24)[7].id).toBe('activityStyle');
  expect(buildQuestionnaire(legacy, null)[7].id).toBe('activityStyle');
  expect(buildQuestionnaire(legacy, 23)[2].options).toHaveLength(5);
  expect(legacy[6].id).toBe('vibe');
});

test('allows extra selection feedback time with a screen reader', async () => {
  jest.useFakeTimers();
  const screenReader = jest
    .spyOn(AccessibilityInfo, 'isScreenReaderEnabled')
    .mockResolvedValue(true);
  const onAnswer = jest.fn();
  let renderer: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      renderer = create(
        <QuestionnaireCard
          active
          answers={{}}
          question={buildQuestionnaire(legacy, 23)[2]}
          questionIndex={2}
          questionCount={8}
          onAnswer={onAnswer}
          onBack={jest.fn()}
          onClose={jest.fn()}
        />,
      );
    });
    act(() =>
      renderer!.root
        .findByProps({
          accessibilityLabel: 'Answer recommendation 기차나 자동차를 좋아해요',
        })
        .props.onPress(),
    );
    act(() => {
      jest.advanceTimersByTime(250);
    });
    expect(onAnswer).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(650);
    });
    expect(onAnswer).toHaveBeenCalledTimes(1);
  } finally {
    act(() => renderer?.unmount());
    screenReader.mockRestore();
    jest.useRealTimers();
  }
});

test('selection is highlighted before one advance and navigation cancels pending advances', () => {
  jest.useFakeTimers();
  const screenReader = jest
    .spyOn(AccessibilityInfo, 'isScreenReaderEnabled')
    .mockResolvedValue(false);
  const onAnswer = jest.fn(),
    onBack = jest.fn(),
    onClose = jest.fn();
  const props = {
    active: true,
    answers: {},
    question: buildQuestionnaire(legacy, 23)[2],
    questionIndex: 2,
    questionCount: 8,
    onAnswer,
    onBack,
    onClose,
  };
  let renderer: ReactTestRenderer;
  act(() => {
    renderer = create(<QuestionnaireCard {...props} />);
  });
  const answer = () =>
    renderer.root.findByProps({
      accessibilityLabel: 'Answer recommendation 기차나 자동차를 좋아해요',
    });
  try {
    act(() => {
      answer().props.onPress();
      answer().props.onPress();
    });
    expect(answer().props.accessibilityState.checked).toBe(true);
    expect(onAnswer).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(250);
    });
    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(onAnswer).toHaveBeenCalledWith('interest', 'interest_transport');
    onAnswer.mockClear();
    act(() => {
      answer().props.onPress();
    });
    act(() => {
      renderer.update(<QuestionnaireCard {...props} active={false} />);
    });
    act(() => {
      jest.runOnlyPendingTimers();
    });
    expect(onAnswer).not.toHaveBeenCalled();
    act(() => {
      renderer.update(<QuestionnaireCard {...props} />);
      answer().props.onPress();
    });
    act(() => {
      renderer.root
        .findByProps({ accessibilityLabel: 'Previous recommendation question' })
        .props.onPress();
      jest.runOnlyPendingTimers();
    });
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onAnswer).not.toHaveBeenCalled();
    act(() => {
      answer().props.onPress();
    });
    act(() => {
      renderer.root
        .findByProps({ accessibilityLabel: 'Close recommendation questions' })
        .props.onPress();
      jest.runOnlyPendingTimers();
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onAnswer).not.toHaveBeenCalled();
  } finally {
    act(() => {
      renderer.unmount();
    });
    screenReader.mockRestore();
    jest.useRealTimers();
  }
});
