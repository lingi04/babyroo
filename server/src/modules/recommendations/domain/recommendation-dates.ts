import type { RecommendationPreferences, VisitDateRange } from './recommendation.entity';

const seoulDateFormatter = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
});

export function seoulDate(timestamp: string): string {
  return seoulDateFormatter.format(new Date(timestamp));
}

export function isDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function addDays(day: string, days: number): string {
  const date = new Date(day);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function resolveVisitDateRange(
  window: RecommendationPreferences['visitWindow'],
  today: string,
): VisitDateRange | undefined {
  const weekday = new Date(today).getUTCDay();
  const daysUntilSunday = (7 - weekday) % 7;
  switch (window) {
    case 'soon':
      return { start: addDays(today, 1), end: addDays(today, 2) };
    case 'this_weekend':
      return {
        start: addDays(today, weekday >= 5 || weekday === 0 ? 0 : 6 - weekday),
        end: addDays(today, daysUntilSunday),
      };
    case 'next_week':
      return { start: addDays(today, daysUntilSunday + 1), end: addDays(today, daysUntilSunday + 7) };
    default:
      return undefined;
  }
}

export function completedMonths(birthDate: string, day: string): number {
  const [year, month, date] = day.split('-').map(Number);
  const [birthYear, birthMonth, birthDay] = birthDate.split('-').map(Number);
  return (year - birthYear) * 12 + month - birthMonth - Number(date < birthDay);
}

// The first date on which completedMonths reaches the threshold.
export function ageThresholdDate(birthDate: string, months: number): string {
  const date = new Date(birthDate);
  const birthDay = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const month = date.getUTCMonth();
  date.setUTCDate(birthDay);
  if (date.getUTCMonth() !== month) date.setUTCDate(1);
  return date.toISOString().slice(0, 10);
}
