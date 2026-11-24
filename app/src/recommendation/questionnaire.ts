import type { RecommendationQuestion } from './types';

export const recommendationInterestQuestion: RecommendationQuestion = {
  id: 'interest',
  prompt: '요즘 아이가 뭘 보면 발걸음을 멈추나요?',
  options: [
    { value: 'interest_transport', label: '기차나 자동차를 좋아해요' },
    { value: 'interest_animals', label: '동물이나 곤충을 좋아해요' },
    { value: 'interest_water', label: '물을 보거나 물놀이하는 걸 좋아해요' },
    { value: 'interest_music', label: '음악을 듣거나 악기를 연주하는 걸 좋아해요' },
    { value: 'interest_any', label: '특별히 떠오르는 건 없어요' },
  ],
};

// UI wording is independent of stored session summaries.
export function buildQuestionnaire(
  legacyQuestions: RecommendationQuestion[],
  youngestAgeMonths: number | null,
): RecommendationQuestion[] {
  const question = (id: RecommendationQuestion['id']) =>
    legacyQuestions.find(item => item.id === id)!;
  const withLabels = (
    id: RecommendationQuestion['id'],
    prompt: string,
    labels: string[],
  ): RecommendationQuestion => ({
    ...question(id),
    prompt,
    options: question(id).options.map((option, index) => ({
      ...option,
      label: labels[index],
    })),
  });
  return [
    {
      ...question('startRegion'),
      prompt: '어디에서 출발하세요?',
      options: question('startRegion').options.map(option => ({
        ...option,
        label:
          option.value === 'departure_input'
            ? '출발지를 직접 입력할게요'
            : '저장한 집 주소에서 출발할게요',
      })),
    },
    withLabels('visitDay', '언제쯤 갈 생각인가요?', [
      '1~2일 안에 갈 거예요',
      '이번 주말에 갈 거예요',
      '다음 주에 갈 거예요',
      '날짜는 유연하게 정할 수 있어요',
    ]),
    recommendationInterestQuestion,
    question('mobility'),
    withLabels('weather', '날씨가 좋다면 야외로 나가는 것도 괜찮으세요?', [
      '날씨가 좋으면 야외도 괜찮아요',
      '날씨와 상관없이 실내로 가고 싶어요',
      '날씨와 상관없이 야외로 가고 싶어요',
    ]),
    withLabels('priceComfort', '입장료는 어느 정도 괜찮으세요?', [
      '무료인 곳을 위주로 보고 싶어요',
      '입장료가 저렴하면 괜찮아요',
      '유료인 곳도 괜찮아요',
    ]),
    withLabels('reservationComfort', '예약이 필요한 행사도 괜찮으세요?', [
      '예약 없이 갈 수 있는 곳이 좋아요',
      '미리 예약할 수 있다면 괜찮아요',
      '예약이 필요한지는 상관없어요',
    ]),
    youngestAgeMonths != null && youngestAgeMonths < 24
      ? {
          id: 'duration',
          prompt: '짧게 둘러볼 수 있는 곳이 좋으세요?',
          options: [
            {
              value: 'duration_short',
              label: '짧게 둘러볼 수 있는 곳이 좋아요',
            },
            { value: 'duration_any', label: '머무는 시간은 상관없어요' },
          ],
        }
      : {
          id: 'activityStyle',
          prompt: '어떤 활동이 더 끌리세요?',
          options: [
            {
              value: 'activity_experience',
              label: '아이가 직접 체험하는 활동이 좋아요',
            },
            {
              value: 'activity_exhibition',
              label: '아이와 함께 전시를 보는 게 좋아요',
            },
            { value: 'activity_any', label: '체험이든 전시든 상관없어요' },
          ],
        },
  ];
}
