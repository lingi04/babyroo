import { debugLog } from '../../../../common/debug-log';
import type {
  RecommendationEngineInput,
  RecommendationEnginePort,
} from '../../application/ports/out/recommendation-engine.port';
import type { RecommendationResult } from '../../domain/recommendation.entity';
import {
  rankRecommendations,
  type RecommendationOption,
  renderRecommendationResults,
  SHARED_RESULT_LIMIT,
} from '../../domain/rule-based-recommender';
import { buildRecommendationPrompt } from './openai-recommendation-prompt';
import { parseRecommendationResponse } from './openai-recommendation-response';

type OpenAiRecommendationEngineOptions = {
  apiKey: string;
  model: string;
  maxCandidates: number;
  maxResults: number;
  responsesUrl?: string;
  timeoutMs?: number;
};

type OpenAiResponsePayload = {
  output_text?: unknown;
  output?: unknown;
};

export class OpenAiRecommendationEngineAdapter implements RecommendationEnginePort {
  private readonly responsesUrl: string;
  private readonly timeoutMs: number;

  constructor(private readonly options: OpenAiRecommendationEngineOptions) {
    this.responsesUrl = options.responsesUrl ?? 'https://api.openai.com/v1/responses';
    this.timeoutMs = options.timeoutMs ?? 120000;
  }

  async recommend(input: RecommendationEngineInput): Promise<RecommendationResult[]> {
    const { mode, groups } = rankRecommendations(input);
    const budget = positiveLimit(this.options.maxCandidates, 20);
    const shortlist = shortlistGroups(groups, budget);
    if (shortlist.size === 0) return [];

    const maxResults = mode === 'shared'
      ? Math.min(SHARED_RESULT_LIMIT, positiveLimit(this.options.maxResults, SHARED_RESULT_LIMIT))
      : shortlist.size;
    const prompt = buildRecommendationPrompt(shortlist, input.preferences, mode, maxResults);
    debugLog('recommendations.openai.start', { model: this.options.model, assignmentCount: shortlist.size });

    const response = await this.createResponse(prompt, maxResults);
    const picks = parseRecommendationResponse(response, shortlist, mode, maxResults);
    if (picks.size === 0) throw new Error('Recommendation provider returned no usable choices.');

    debugLog('recommendations.openai.success', { acceptedChoices: picks.size });
    if (mode === 'shared') return renderRecommendationResults(Array.from(picks.values()));

    // Every covered child retains a deterministic pick if the model omits them.
    return renderRecommendationResults(Array.from(groups, ([label, options]) =>
      picks.get(label) ?? { option: options[0] },
    ));
  }

  private async createResponse(prompt: string, maxResults: number): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(this.responsesUrl, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: 'Bearer ' + this.options.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.options.model,
          input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }] }],
          text: {
            format: {
              type: 'json_schema',
              name: 'babyroo_recommendations',
              strict: true,
              schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  results: {
                    type: 'array',
                    maxItems: maxResults,
                    items: {
                      type: 'object',
                      additionalProperties: false,
                      properties: {
                        eventId: { type: 'string' },
                        assignment: { type: 'string' },
                        fact: { type: 'string' },
                      },
                      required: ['eventId', 'assignment', 'fact'],
                    },
                  },
                },
                required: ['results'],
              },
            },
          },
        }),
      });
      if (!response.ok) {
        debugLog('recommendations.openai.httpError', { status: response.status });
        throw new Error('Recommendation provider request failed.');
      }
      return extractOutputText(await response.json() as OpenAiResponsePayload);
    } catch {
      if (controller.signal.aborted) throw new Error('Recommendation provider request timed out.');
      throw new Error('Recommendation provider request failed.');
    } finally {
      clearTimeout(timeout);
    }
  }
}

function positiveLimit(value: number, fallback: number): number {
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

function shortlistGroups(groups: Map<string, RecommendationOption[]>, budget: number) {
  const eventIds = new Set<string>();
  const groupOptions = [...groups.values()];
  // Spend the shortlist budget on first choices across groups before adding alternatives.
  for (let rank = 0; eventIds.size < budget && groupOptions.some(options => rank < options.length); rank++) {
    for (const options of groupOptions) {
      if (options[rank]) eventIds.add(options[rank].ranked.event.id);
      if (eventIds.size >= budget) break;
    }
  }

  const shortlisted = new Map<string, RecommendationOption[]>();
  for (const [label, options] of groups) {
    const matches = options.filter(option => eventIds.has(option.ranked.event.id));
    if (matches.length > 0) shortlisted.set(label, matches);
  }
  return shortlisted;
}

function extractOutputText(payload: OpenAiResponsePayload | null): string {
  if (typeof payload?.output_text === 'string') {
    return payload.output_text;
  }

  if (!Array.isArray(payload?.output)) {
    return '';
  }

  const textParts: string[] = [];
  for (const outputItem of payload.output) {
    if (
      typeof outputItem !== 'object' ||
      outputItem == null ||
      !('content' in outputItem) ||
      !Array.isArray((outputItem as { content?: unknown }).content)
    ) {
      continue;
    }

    for (const contentItem of (outputItem as { content: unknown[] }).content) {
      if (
        typeof contentItem === 'object' &&
        contentItem != null &&
        'text' in contentItem &&
        typeof (contentItem as { text?: unknown }).text === 'string'
      ) {
        textParts.push((contentItem as { text: string }).text);
      }
    }
  }

  return textParts.join('');
}
