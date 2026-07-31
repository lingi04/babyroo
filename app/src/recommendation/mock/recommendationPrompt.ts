import type {
  Candidate,
  Preferences,
  RecommendationChildContext,
} from '../types';

export function buildRecommendationPrompt({
  candidates,
  children,
  preferences,
  requestedAt,
  userHomeRegion,
}: {
  candidates: Candidate[];
  children: RecommendationChildContext[];
  preferences: Preferences;
  requestedAt: string;
  userHomeRegion: string;
}) {
  const childLines =
    children.length > 0
      ? children.map(
          child => `- ${child.nickname}: ${child.ageMonths}개월, ${child.gender}`,
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

function truncatePromptText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}...`;
}
