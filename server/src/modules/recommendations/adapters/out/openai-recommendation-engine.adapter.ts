import { debugLog } from '../../../../common/debug-log';
import {
  RecommendationEngineInput,
  RecommendationEnginePort,
} from '../../application/ports/out/recommendation-engine.port';
import { RecommendationResult } from '../../domain/recommendation.entity';
import {
  buildRecommendationPrompt,
  childToContext,
  eventToCandidate,
  formatUserHomeAddress,
} from './openai-recommendation-prompt';
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
    const candidates = input.events
      .slice(0, this.options.maxCandidates)
      .map(eventToCandidate);
    const prompt = buildRecommendationPrompt({
      candidates,
      children: input.children.map(childToContext),
      preferences: input.preferences,
      requestedAt: input.requestedAt,
      userHomeAddress: formatUserHomeAddress(input.userHomeAddress),
      userHomeRegion: input.userHomeRegion,
    });

    debugLog('recommendations.openai.start', {
      model: this.options.model,
      candidateCount: candidates.length,
    });
    debugLog('recommendations.openai.prompt', {
      prompt,
    });

    const rawResponse = await this.createResponse(prompt);
    debugLog('recommendations.openai.rawResponse', {
      rawResponse,
    });
    const parsed = parseRecommendationResponse(
      rawResponse,
      new Set(candidates.map(candidate => candidate.id)),
      { maxResults: this.options.maxResults },
    );

    if (!parsed.ok) {
      debugLog('recommendations.openai.invalidResponse', {
        errorMessage: parsed.errorMessage,
      });
      return [];
    }

    debugLog('recommendations.openai.success', {
      resultCount: parsed.results.length,
    });
    return parsed.results;
  }

  private async createResponse(prompt: string): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(this.responsesUrl, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.options.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.options.model,
          input: [
            {
              role: 'user',
              content: [
                {
                  type: 'input_text',
                  text: prompt,
                },
              ],
            },
          ],
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
                    maxItems: 3,
                    items: {
                      type: 'object',
                      additionalProperties: false,
                      properties: {
                        eventId: { type: 'string' },
                        reasons: {
                          type: 'array',
                          minItems: 1,
                          maxItems: 3,
                          items: { type: 'string' },
                        },
                        caution: {
                          type: ['string', 'null'],
                        },
                      },
                      required: ['eventId', 'reasons', 'caution'],
                    },
                  },
                },
                required: ['results'],
              },
            },
          },
        }),
      });
      const payload = (await response.json().catch(() => null)) as OpenAiResponsePayload | null;
      debugLog('recommendations.openai.responsePayload', {
        payload: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(
          `OpenAI recommendation request failed with ${response.status}: ${JSON.stringify(payload)}`,
        );
      }

      return extractOutputText(payload);
    } catch (error) {
      if (isAbortError(error)) {
        throw new Error(
          `OpenAI recommendation request timed out after ${this.timeoutMs}ms.`,
        );
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

function isAbortError(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === 'AbortError' || error.message.includes('aborted'))
  );
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
