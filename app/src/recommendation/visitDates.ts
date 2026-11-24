import type { Preferences, RecommendationSession } from './types';

const seoulDateFormatter = new Intl.DateTimeFormat('en', {
  timeZone: 'Asia/Seoul', calendar: 'gregory', numberingSystem: 'latn',
  year: 'numeric', month: '2-digit', day: '2-digit',
});

function seoulCalendarDay(date: Date): string {
  const parts = seoulDateFormatter.formatToParts(date);
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)?.value).join('-');
}

export function nextRecommendationDayBoundary(now: Date) {
  const localMidnight = new Date(now);
  localMidnight.setHours(24, 0, 0, 0);
  const seoulMidnight = new Date(seoulCalendarDay(now) + 'T00:00:00+09:00');
  seoulMidnight.setUTCDate(seoulMidnight.getUTCDate() + 1);
  return Math.min(localMidnight.getTime(), seoulMidnight.getTime());
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function recommendationVisitRange(
  window: Preferences['visitWindow'],
  requestedAt: Date,
) {
  if (!Number.isFinite(requestedAt.getTime())) {
    return null;
  }

  const weekday = requestedAt.getDay();
  if (window === 'soon') {
    return { start: addDays(requestedAt, 1), end: addDays(requestedAt, 2) };
  }
  if (window === 'this_weekend') {
    const daysUntilSunday = (7 - weekday) % 7;
    const daysUntilStart = weekday >= 5 || weekday === 0 ? 0 : 6 - weekday;
    return {
      start: addDays(requestedAt, daysUntilStart),
      end: addDays(requestedAt, daysUntilSunday),
    };
  }
  if (window === 'next_week') {
    const start = addDays(requestedAt, ((7 - weekday) % 7) + 1);
    return { start, end: addDays(start, 6) };
  }
  return null;
}

export function localDayStart(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start.getTime();
}

export function isPastVisitRange(
  range: ReturnType<typeof recommendationVisitRange>,
  today: Date,
) {
  return range !== null && localDayStart(range.end) < localDayStart(today);
}

export function isPastRecommendationSession(
  session: Pick<RecommendationSession, 'status' | 'createdAt' | 'preferences'>,
  today: Date,
) {
  const savedRange = session.preferences.resolvedVisitRange;
  if (savedRange) {
    const seoulToday = seoulCalendarDay(today);
    return session.status === 'success' && savedRange.end < seoulToday;
  }
  return session.status === 'success' && isPastVisitRange(
    recommendationVisitRange(session.preferences.visitWindow, new Date(session.createdAt)),
    today,
  );
}

export function recommendationSessionVisitRange(
  session: Pick<RecommendationSession, 'createdAt' | 'preferences'>,
) {
  const range = session.preferences.resolvedVisitRange;
  if (range) {
    const dateOnly = (day: string) => {
      const [year, month, date] = day.split('-').map(Number);
      return new Date(year, month - 1, date);
    };
    return { start: dateOnly(range.start), end: dateOnly(range.end) };
  }
  return recommendationVisitRange(session.preferences.visitWindow, new Date(session.createdAt));
}

const weekdays = ['일', '월', '화', '수', '목', '금', '토'];

export function formatVisitDate(date: Date) {
  return `${date.getMonth() + 1}월 ${date.getDate()}일 (${weekdays[date.getDay()]})`;
}

export function formatVisitRange(
  range: NonNullable<ReturnType<typeof recommendationVisitRange>>,
) {
  const start = formatVisitDate(range.start);
  return localDayStart(range.start) === localDayStart(range.end)
    ? start
    : `${start}~${formatVisitDate(range.end)}`;
}
