import type { RecommendationOption, RecommendationPick } from '../../domain/rule-based-recommender';

export function parseRecommendationResponse(
  rawResponse: string,
  groups: Map<string, RecommendationOption[]>,
  mode: 'shared' | 'individual',
  maxResults: number,
): Map<string, RecommendationPick> {
  const picks = new Map<string, RecommendationPick>();
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawResponse);
  } catch {
    return picks;
  }

  if (typeof parsed !== 'object' || parsed === null ||
      !('results' in parsed) || !Array.isArray(parsed.results)) return picks;
  for (const row of parsed.results) {
    if (typeof row !== 'object' || row === null ||
        typeof row.eventId !== 'string' || typeof row.assignment !== 'string') continue;
    const option = groups.get(row.assignment)?.find(candidate => candidate.ranked.event.id === row.eventId);
    const key = mode === 'shared' ? row.eventId : row.assignment;
    if (!option || picks.has(key)) continue;

    const fact = typeof row.fact === 'string' && Object.hasOwn(option.ranked.facts.facts, row.fact)
      ? row.fact
      : undefined;
    picks.set(key, { option, fact });
    if (picks.size >= maxResults) break;
  }
  return picks;
}
