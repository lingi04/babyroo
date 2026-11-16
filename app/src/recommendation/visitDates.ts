import type { Preferences } from './types';

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
