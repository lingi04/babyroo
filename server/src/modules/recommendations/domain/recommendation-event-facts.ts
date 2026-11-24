import type { BabyrooEvent } from '../../events/domain/event.entity';
import { departureArea } from './recommendation-departure';
import type { RecommendationPreferences } from './recommendation.entity';

const interestFacts = {
  interest_transport: { match: /기차|열차|철도|자동차|교통체험|전차|\b(?:train|railway|cars?)\b/i, text: '기차나 자동차와 관련된 나들이예요.' },
  interest_animals: { match: /동물|곤충|생태|공룡|동물원|아쿠아리움|\b(?:animals?|insects?|zoo|aquarium)\b/i, text: '동물이나 생물을 주제로 한 나들이예요.' },
  interest_water: { match: /물놀이|물놀이터|수영|아쿠아리움|워터파크|\b(?:aquarium|splash park|water play|water park)\b/i, text: '물과 관련된 나들이예요.' },
  interest_music: { match: /음악|악기|연주|오케스트라|콘서트|음악회|\b(?:music|musical|orchestra|concert)\b/i, text: '음악이나 악기와 관련된 나들이예요.' },
};

export function recommendationEventFacts(event: BabyrooEvent, preferences: RecommendationPreferences) {
  const facts: Record<string, string> = { published: '베이비루에 등록된 나들이예요.' };
  const area = departureArea(event.region, event.locality);
  const departure = preferences.departureArea;
  let practical = 0;
  let interest = 0;
  let activity = 0;

  if (preferences.mobility === 'nearby' && departure?.locality &&
      area?.region === departure.region && area.locality === departure.locality) {
    practical += 30;
    facts.district = area.locality + '에 있어 출발지와 같은 지역이에요.';
  }
  const preferredPlace = preferences.place === 'indoor' || preferences.place === 'outdoor'
    ? preferences.place
    : preferences.weatherPlan === 'prefer_indoor' ? 'indoor'
      : preferences.weatherPlan === 'prefer_outdoor' ? 'outdoor' : undefined;
  if (event.indoor !== undefined) {
    const place = event.indoor ? 'indoor' : 'outdoor';
    if (place === preferredPlace) practical += 20;
    facts.place = event.indoor ? '실내에서 즐길 수 있어요.' : '야외에서 진행해요.';
  }
  if (event.priceType === 'free') {
    if (preferences.price === 'free' || preferences.price === 'low') practical += 15;
    facts.free = '입장료가 무료로 안내돼 있어요.';
  }
  if (event.reservationRequired === false) {
    if (preferences.reservation === 'no_reservation') practical += 15;
    facts.noReservation = '예약 없이 방문할 수 있다고 안내돼 있어요.';
  } else if (preferences.reservation === 'reservation_ok' &&
      (event.reservationStatus === 'available' || event.reservationStatus === 'limited')) {
    practical += 10;
    facts.reservation = '예약이 가능한 것으로 안내돼 있어요.';
  }

  const chosenInterest = preferences.interest;
  if (chosenInterest && chosenInterest !== 'interest_any' && Object.hasOwn(interestFacts, chosenInterest)) {
    const fact = interestFacts[chosenInterest];
    if (fact.match.test([event.title, ...event.tags, event.summary].join(' '))) {
      interest = 1;
      facts.interest = fact.text;
    }
  }

  const duration = listedDuration(event);
  if (preferences.duration === 'short' && duration !== undefined && duration <= 60) {
    activity = 1;
    facts.duration = '안내된 소요 시간은 약 ' + duration + '분이에요.';
  }
  if (preferences.activity === 'experience' && event.category === 'experience') {
    activity = 1;
    facts.activity = '직접 체험하는 프로그램이에요.';
  } else if (preferences.activity === 'exhibition' && event.category === 'exhibition') {
    activity = 1;
    facts.activity = '전시를 관람할 수 있어요.';
  }
  return { practical, interest, activity, facts };
}

const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
const weekdayList = '([일월화수목금토](?:요일)?(?:\\s*[,·/및]\\s*[일월화수목금토](?:요일)?)*)';

export function listedClosedWeekdays(event: BabyrooEvent): Set<number> {
  const days = new Set<number>();
  const notes = [event.summary, ...event.tags].join('\n');
  const closing = new RegExp('매주\\s*' + weekdayList + '\\s*(?:정기\\s*)?(?:휴관|휴무|운영하지 않)', 'g');
  for (const [, list] of notes.matchAll(closing)) {
    weekdayNumbers(list).forEach(day => days.add(day));
  }
  const closureHeading = new RegExp('(?:휴관일|휴무일)\\s*[:：]?\\s*매주\\s*' + weekdayList, 'g');
  for (const [, list] of notes.matchAll(closureHeading)) {
    weekdayNumbers(list).forEach(day => days.add(day));
  }
  const open = new Set<number>();
  const exclusive = new RegExp('매주\\s*' + weekdayList + '\\s*에?만\\s*(?:운영|진행)', 'g');
  const classSchedule = new RegExp('수업시간\\s*[:：]?\\s*매주\\s*' + weekdayList + '\\s*\\d{1,2}:\\d{2}', 'g');
  for (const [, list] of [...notes.matchAll(exclusive), ...notes.matchAll(classSchedule)]) {
    weekdayNumbers(list).forEach(day => open.add(day));
  }
  if (open.size > 0) {
    weekdays.forEach((_, day) => { if (!open.has(day)) days.add(day); });
  }
  return days;
}

function weekdayNumbers(list: string): number[] {
  return (list.replace(/요일/g, '').match(/[일월화수목금토]/g) ?? []).map(day => weekdays.indexOf(day));
}

function listedDuration(event: BabyrooEvent): number | undefined {
  const matches = [event.summary, ...event.tags].join('\n').matchAll(
    /(?:소요\s*시간|러닝\s*타임|공연\s*시간)\s*[:：]?\s*(?:약\s*)?(\d{1,3})\s*분(?!\s*[~～–-])|수업시간[^\n()]*\((\d{1,3})\s*분\)/g,
  );
  const durations = new Set(Array.from(matches, match => Number(match[1] ?? match[2])));
  const [duration] = durations;
  return durations.size === 1 && duration > 0 ? duration : undefined;
}
