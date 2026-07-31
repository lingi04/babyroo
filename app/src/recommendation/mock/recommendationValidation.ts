import type { RecommendationResult } from '../types';

type RawRecommendationResult = Partial<RecommendationResult>;

export type ParseRecommendationResult =
  | {
      ok: true;
      results: RecommendationResult[];
      rawResponse: string;
    }
  | {
      ok: false;
      errorMessage: string;
      rawResponse?: string;
    };

export function parseRecommendationResponse(
  rawResponse: string,
  validEventIds: Set<string>,
  { maxResults }: { maxResults: number },
): ParseRecommendationResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawResponse);
  } catch {
    return {
      ok: false,
      errorMessage: 'Recommendation response is not valid JSON.',
      rawResponse,
    };
  }

  const rawResults = Array.isArray(parsed)
    ? parsed
    : typeof parsed === 'object' && parsed != null && 'results' in parsed
      ? (parsed as { results?: unknown }).results
      : null;

  if (!Array.isArray(rawResults)) {
    return {
      ok: false,
      errorMessage: 'Recommendation response does not contain results.',
      rawResponse,
    };
  }

  const seenEventIds = new Set<string>();
  const results: RecommendationResult[] = [];

  for (const rawResult of rawResults as RawRecommendationResult[]) {
    if (
      typeof rawResult !== 'object' ||
      rawResult == null ||
      typeof rawResult.eventId !== 'string' ||
      !validEventIds.has(rawResult.eventId) ||
      seenEventIds.has(rawResult.eventId)
    ) {
      continue;
    }

    const reasons = Array.isArray(rawResult.reasons)
      ? rawResult.reasons.filter(
          reason => typeof reason === 'string' && reason.trim().length > 0,
        )
      : [];

    if (reasons.length === 0) {
      continue;
    }

    seenEventIds.add(rawResult.eventId);
    results.push({
      eventId: rawResult.eventId,
      reasons,
      caution:
        typeof rawResult.caution === 'string' &&
        rawResult.caution.trim().length > 0
          ? rawResult.caution
          : undefined,
    });

    if (results.length >= maxResults) {
      break;
    }
  }

  if (results.length === 0) {
    return {
      ok: false,
      errorMessage: 'Recommendation response has no valid results.',
      rawResponse,
    };
  }

  return {
    ok: true,
    results,
    rawResponse,
  };
}
