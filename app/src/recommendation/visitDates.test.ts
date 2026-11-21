import {
  formatVisitRange,
  isPastVisitRange,
  isPastRecommendationSession,
  recommendationVisitRange,
} from './visitDates';

test('session past status matches history badges, including undated and pending records', () => {
  const past = {
    status: 'success' as const,
    createdAt: '2020-01-01T00:00:00Z',
    preferences: { visitWindow: 'soon' as const },
  };
  const today = new Date(2026, 10, 21);
  expect(isPastRecommendationSession(past, today)).toBe(true);
  expect(isPastRecommendationSession({...past,status:'loading'},today)).toBe(false);
  expect(isPastRecommendationSession({...past,status:'failed'},today)).toBe(false);
  expect(isPastRecommendationSession({...past,preferences:{visitWindow:'flexible'}},today)).toBe(false);
  expect(isPastRecommendationSession({...past,createdAt:'2026-11-20T00:00:00Z'},today)).toBe(false);
});

test('anchors a saved weekend to its request and keeps Sunday current', () => {
  const range = recommendationVisitRange('this_weekend', new Date(2026, 10, 12, 18));

  expect(range && formatVisitRange(range)).toBe('11월 14일 (토)~11월 15일 (일)');
  expect(isPastVisitRange(range, new Date(2026, 10, 15, 23, 59))).toBe(false);
  expect(isPastVisitRange(range, new Date(2026, 10, 16))).toBe(true);
});

test('uses the upcoming Monday for a next-week request made on Sunday', () => {
  const range = recommendationVisitRange('next_week', new Date(2026, 10, 15));

  expect(range && formatVisitRange(range)).toBe('11월 16일 (월)~11월 22일 (일)');
});

test('formats a single-day window and handles dates across year end', () => {
  const sunday = recommendationVisitRange('this_weekend', new Date(2026, 10, 15));
  const soon = recommendationVisitRange('soon', new Date(2026, 11, 31));

  expect(sunday && formatVisitRange(sunday)).toBe('11월 15일 (일)');
  expect(soon && formatVisitRange(soon)).toBe('1월 1일 (금)~1월 2일 (토)');
});

test('leaves flexible, missing, and malformed dates unmarked', () => {
  const today = new Date(2026, 10, 16);

  expect(recommendationVisitRange('flexible', today)).toBeNull();
  expect(recommendationVisitRange(undefined, today)).toBeNull();
  expect(recommendationVisitRange('soon', new Date('invalid'))).toBeNull();
  expect(isPastVisitRange(null, today)).toBe(false);
});
