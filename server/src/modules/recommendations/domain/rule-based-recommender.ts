import type { BabyrooEvent } from '../../events/domain/event.entity';
import type { Child } from '../../users/domain/user.entity';
import type { RecommendationEngineInput } from '../application/ports/out/recommendation-engine.port';
import { addDays, ageThresholdDate, completedMonths, isDateOnly, resolveVisitDateRange, seoulDate } from './recommendation-dates';
import type { RecommendationResult, VisitDateRange } from './recommendation.entity';
import { listedClosedWeekdays, recommendationEventFacts } from './recommendation-event-facts';

export const SHARED_RESULT_LIMIT = 3;

const categories = new Set(['performance', 'experience', 'play_space', 'exhibition']);

type Attendance = {
  start: string;
  end: string;
  ageLimited: boolean;
};

type SelectedChild = { label: string; child: Child };
type RankedEvent = {
  event: BabyrooEvent;
  facts: ReturnType<typeof recommendationEventFacts>;
  closedWeekdays: Set<number>;
};
export type RecommendationOption = {
  ranked: RankedEvent;
  children: SelectedChild[];
  attendance: Attendance;
};
type RecommendationPlan = {
  mode: 'shared' | 'individual';
  groups: Map<string, RecommendationOption[]>;
  today: string;
};
export type RecommendationPick = { option: RecommendationOption; fact?: string };

export class RuleBasedRecommender {
  recommend(input: RecommendationEngineInput): RecommendationResult[] {
    const plan = rankRecommendations(input);
    return renderRecommendationResults(deterministicPicks(plan));
  }
}

export function rankRecommendations(input: RecommendationEngineInput): RecommendationPlan {
  const { events, children, preferences, requestedAt } = input;
  const today = seoulDate(requestedAt);
  const visit = preferences.resolvedVisitRange ?? resolveVisitDateRange(preferences.visitWindow, today);
  const requestedStart = visit?.start ?? today;
  const ids = [...new Set(input.selectedChildIds ?? children.map(child => child.id))];
  const snapshot = new Map(children.map(child => [child.id, child]));
  const selected = ids.flatMap((id, index) => {
    const child = snapshot.get(id);
    return child && isDateOnly(child.birthDate) && child.birthDate <= today
      ? [{ label: 'child-' + (index + 1), child }]
      : [];
  });
  const region = preferences.startRegion === 'seoul' ? '서울'
    : preferences.startRegion === 'gyeonggi' ? '경기' : undefined;
  const shared: RecommendationOption[] = [];
  const individual = new Map(selected.map(({ label }) => [label, [] as RecommendationOption[]]));

  for (const event of events) {
    if (!categories.has(event.category) || event.reservationStatus === 'closed' ||
        (region && event.region !== region) ||
        (event.publicationStatus && event.publicationStatus !== 'published')) continue;
    if (!isDateOnly(event.startsAt) || !isDateOnly(event.endsAt)) continue;
    const start = event.startsAt > requestedStart ? event.startsAt : requestedStart;
    const end = visit && visit.end < event.endsAt ? visit.end : event.endsAt;
    if (start > end) continue;

    const closedWeekdays = listedClosedWeekdays(event);
    const calendar = openInterval({ start, end }, closedWeekdays);
    if (!calendar) continue;
    const ranked = { event, facts: recommendationEventFacts(event, preferences), closedWeekdays };
    if (ids.length === 0) {
      shared.push({ ranked, children: [], attendance: { ...calendar, ageLimited: false } });
      continue;
    }

    const eligible = selected.flatMap(child => {
      const attendance = ageInterval(event, child.child.birthDate, calendar, closedWeekdays);
      return attendance ? [{ ranked, children: [child], attendance }] : [];
    });
    if (eligible.length === ids.length) {
      const common = eligible.reduce<VisitDateRange>((range, { attendance }) => ({
        start: attendance.start > range.start ? attendance.start : range.start,
        end: attendance.end < range.end ? attendance.end : range.end,
      }), calendar);
      if (common.start <= common.end) {
        shared.push({
          ranked,
          children: selected,
          attendance: {
            ...common,
            ageLimited: common.start !== calendar.start || common.end !== calendar.end,
          },
        });
        continue;
      }
    }
    for (const option of eligible) {
      individual.get(option.children[0].label)!.push(option);
    }
  }

  if (shared.length > 0 || ids.length === 0) {
    return { mode: 'shared', groups: new Map([['all', shared.sort(compareOptions)]]), today };
  }
  for (const [label, options] of individual) {
    if (options.length === 0) individual.delete(label);
    else options.sort(compareOptions);
  }
  return { mode: 'individual', groups: individual, today };
}

function openInterval(
  { start, end }: VisitDateRange,
  closedWeekdays: Set<number>,
): VisitDateRange | undefined {
  if (closedWeekdays.size === 7) return undefined;
  while (start <= end && closedWeekdays.has(new Date(start).getUTCDay())) start = addDays(start, 1);
  while (start <= end && closedWeekdays.has(new Date(end).getUTCDay())) end = addDays(end, -1);
  return start <= end ? { start, end } : undefined;
}

function ageInterval(
  event: BabyrooEvent,
  birthDate: string,
  calendar: VisitDateRange,
  closedWeekdays: Set<number>,
): Attendance | undefined {
  const min = event.ageMinMonths;
  const max = event.ageMaxMonths;
  if (min === undefined && max === undefined) return undefined;
  if ((min !== undefined && (!Number.isSafeInteger(min) || min < 0)) ||
      (max !== undefined && (!Number.isSafeInteger(max) || max < 0))) return undefined;
  if ((min !== undefined && completedMonths(birthDate, calendar.end) < min) ||
      (max !== undefined && completedMonths(birthDate, calendar.start) > max)) return undefined;

  const start = min !== undefined && completedMonths(birthDate, calendar.start) < min
    ? ageThresholdDate(birthDate, min) : calendar.start;
  const end = max !== undefined && completedMonths(birthDate, calendar.end) > max
    ? addDays(ageThresholdDate(birthDate, max + 1), -1) : calendar.end;
  const open = openInterval({ start, end }, closedWeekdays);
  return open && { ...open, ageLimited: open.start !== calendar.start || open.end !== calendar.end };
}

function compareOptions(a: RecommendationOption, b: RecommendationOption) {
  const left = a.ranked.facts;
  const right = b.ranked.facts;
  return right.practical - left.practical || right.interest - left.interest ||
    right.activity - left.activity || (b.ranked.event.csvSequence ?? 0) - (a.ranked.event.csvSequence ?? 0);
}

export function deterministicPicks(plan: RecommendationPlan): RecommendationPick[] {
  return Array.from(plan.groups.values()).flatMap(options =>
    options.slice(0, plan.mode === 'shared' ? SHARED_RESULT_LIMIT : 1).map(option => ({ option })),
  );
}

// Booking availability can change, so it is not a default benefit.
const reasonFactPriority = ['district', 'interest', 'duration', 'free', 'noReservation', 'activity', 'place'];

export function renderRecommendationResults(picks: RecommendationPick[]): RecommendationResult[] {
  const byEvent = new Map<string, RecommendationPick[]>();
  for (const pick of picks) {
    const id = pick.option.ranked.event.id;
    const group = byEvent.get(id) ?? [];
    group.push(pick);
    byEvent.set(id, group);
  }

  return Array.from(byEvent, ([eventId, group]) => {
    const { event, facts, closedWeekdays } = group[0].option.ranked;
    const attendanceReasons = group.flatMap(({ option }) => attendanceReason(option));
    const selectedFact = group.find(({ fact }) => fact && fact !== 'published' && fact !== 'place' &&
      Object.hasOwn(facts.facts, fact))?.fact;
    const reasonFact = selectedFact ?? reasonFactPriority.find(key => Object.hasOwn(facts.facts, key));
    const reasons = Array.from(new Set(attendanceReasons));
    if (reasonFact) reasons.unshift(facts.facts[reasonFact]);
    if (reasons.length === 0) reasons.push(facts.facts.published);

    const cautions = [];
    if (attendanceReasons.length === 0) cautions.push('아이의 참여 가능 연령을 확인해 주세요.');
    if (closedWeekdays.size > 0) {
      const days = [...closedWeekdays].map(day => ['일', '월', '화', '수', '목', '금', '토'][day] + '요일');
      cautions.push('매주 ' + days.join(', ') + '은 운영하지 않는다고 안내돼 있어요.');
    }
    if (event.reservationStatus === 'unknown' && event.reservationRequired !== false) {
      cautions.push('원문에서 예약 가능 여부를 확인해 주세요.');
    }
    return { eventId, reasons, caution: cautions.join(' ') || undefined };
  });
}

function attendanceReason({ attendance, children }: RecommendationOption): string[] {
  if (children.length === 0) return [];
  const { start, end, ageLimited } = attendance;
  const namesAndAges = children.map(({ child }) =>
    child.nickname + '(' + completedMonths(child.birthDate, start) + '개월)',
  );
  const eligibleChildren = namesAndAges.join(', ') + (children.length > 1 ? ' 모두' : '도');
  const visit = koreanDate(start) + ' 기준으로 ' + eligibleChildren + ' 연령 조건을 충족해요.';
  if (!ageLimited) return [visit];
  const dates = start === end ? koreanDate(start) : koreanDate(start) + '~' + koreanDate(end);
  return [visit + ' 연령 기준으로 가능한 날짜는 ' + dates + '이에요.'];
}

function koreanDate(day: string): string {
  const [, month, date] = day.split('-').map(Number);
  return month + '월 ' + date + '일';
}
