import { BabyrooEvent, ReservationStatus } from '../../../events/domain/event.entity';
import {
  RecommendationPreferences,
} from '../../domain/recommendation.entity';
import { Child, ChildGender, UserHomeAddress } from '../../../users/domain/user.entity';

export type RecommendationChildContext = {
  id: string;
  nickname: string;
  ageMonths: number;
  gender: ChildGender;
};

export type Candidate = {
  id: string;
  title: string;
  venueName: string;
  region: string;
  locality: string;
  startsAt: string;
  endsAt: string;
  ageMinMonths?: number;
  ageMaxMonths?: number;
  indoor?: boolean;
  priceType: BabyrooEvent['priceType'];
  reservationRequired?: boolean;
  reservationStatus: ReservationStatus;
  category: string;
  tags: string[];
  summary: string;
};

export function buildRecommendationPrompt({
  candidates,
  children,
  preferences,
  requestedAt,
  userHomeAddress,
  userHomeRegion,
}: {
  candidates: Candidate[];
  children: RecommendationChildContext[];
  preferences: RecommendationPreferences;
  requestedAt: string;
  userHomeAddress?: string;
  userHomeRegion: string;
}) {
  const childLines =
    children.length > 0
      ? children.map(
          child =>
            `- ${child.nickname}: ${child.ageMonths}개월, ${child.gender}`,
        )
      : ['- 아이 정보 없음'];
  const preferenceLines = Object.entries(preferences).map(
    ([key, value]) => `- ${key}: ${value}`,
  );
  const candidateLines =
    candidates.length > 0
      ? candidates.map(candidate =>
          JSON.stringify({
            id: candidate.id,
            title: candidate.title,
            venueName: candidate.venueName,
            region: candidate.region,
            locality: candidate.locality,
            date: `${candidate.startsAt} - ${candidate.endsAt}`,
            ageMinMonths: candidate.ageMinMonths,
            ageMaxMonths: candidate.ageMaxMonths,
            indoor: candidate.indoor,
            priceType: candidate.priceType,
            reservationRequired: candidate.reservationRequired,
            reservationStatus: candidate.reservationStatus,
            category: candidate.category,
            tags: candidate.tags,
            summary: truncatePromptText(candidate.summary, 120),
          }),
        )
      : ['후보 없음'];

  return [
    'You are Babyroo, a recommendation assistant for parents choosing outings for babies and toddlers.',
    '',
    'Goal:',
    'Rank the candidate events and explain why each one fits this family. Use only the provided event data. Do not invent facts.',
    '',
    'Output requirements:',
    '- Return 3 recommendations at most.',
    '- Return JSON with a top-level "results" array.',
    '- For each recommendation, include: eventId, reasons, and optional caution.',
    '- Write reasons and caution in Korean.',
    '',
    `Requested at: ${requestedAt}`,
    `User home region: ${userHomeRegion}`,
    `User home address: ${userHomeAddress ?? '주소 미설정'}`,
    `Departure address: ${
      preferences.departureAddress ?? userHomeAddress ?? '주소 미설정'
    }`,
    '',
    'Selected children:',
    ...childLines,
    '',
    'Preferences:',
    ...(preferenceLines.length > 0 ? preferenceLines : ['- preferences 없음']),
    '',
    'Candidate events:',
    ...candidateLines,
  ].join('\n');
}

export function childToContext(child: Child): RecommendationChildContext {
  return {
    id: child.id,
    nickname: child.nickname,
    ageMonths: ageMonths(child.birthDate),
    gender: child.gender,
  };
}

export function eventToCandidate(event: BabyrooEvent): Candidate {
  return {
    id: event.id,
    title: event.title,
    venueName: event.venueName,
    region: event.region,
    locality: event.locality,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    ageMinMonths: event.ageMinMonths,
    ageMaxMonths: event.ageMaxMonths,
    indoor: event.indoor,
    priceType: event.priceType,
    reservationRequired: event.reservationRequired,
    reservationStatus: event.reservationStatus,
    category: event.category,
    tags: event.tags,
    summary: event.summary,
  };
}

export function formatUserHomeAddress(address?: UserHomeAddress): string | undefined {
  if (!address) {
    return undefined;
  }

  return [
    address.roadAddress || address.address || address.jibunAddress,
    address.detailAddress,
  ]
    .filter(Boolean)
    .join(' ');
}

function truncatePromptText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}...`;
}

function ageMonths(birthDate: string): number {
  const birth = new Date(`${birthDate}T00:00:00.000Z`);
  const now = new Date();
  return (
    (now.getUTCFullYear() - birth.getUTCFullYear()) * 12 +
    now.getUTCMonth() -
    birth.getUTCMonth()
  );
}
