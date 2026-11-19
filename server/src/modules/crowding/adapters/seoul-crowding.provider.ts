import {
  Area,
  CROWDING_LEVELS,
  CrowdingLevel,
  Observation,
} from '../domain/crowding';
import { CrowdingProvider } from '../application/ports';

const MAX_BYTES = 4 * 1024 * 1024;

// This is a bounded leaf-field reader for OA-21285, not a general XML parser.
// No DTD, external/custom entity, namespace or nested field evaluation is performed.
function field(xml: string, name: string): string {
  const value = new RegExp('<' + name + '>([\\s\\S]*?)</' + name + '>')
    .exec(xml)?.[1]
    ?.trim();
  if (value == null) throw new Error('INVALID_SOURCE');
  const leaf =
    value.startsWith('<![CDATA[') && value.endsWith(']]>')
      ? value.slice(9, -3)
      : value;
  if (leaf.includes('<') || /&(?!(?:amp|lt|gt|quot|apos);)/.test(leaf))
    throw new Error('INVALID_SOURCE');
  return leaf.replace(
    /&(amp|lt|gt|quot|apos);/g,
    (_, entity: string) =>
      ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[entity]!),
  );
}

export function parseSeoulObservation(
  xml: string,
  expectedAreaId: string,
  now: Date,
): Observation {
  if (Buffer.byteLength(xml) > MAX_BYTES || /<!DOCTYPE|<!ENTITY/i.test(xml))
    throw new Error('INVALID_SOURCE');
  if (field(xml, 'AREA_CD') !== expectedAreaId)
    throw new Error('WRONG_SOURCE_AREA');
  const level = field(xml, 'AREA_CONGEST_LVL');
  if (!CROWDING_LEVELS.includes(level as CrowdingLevel))
    throw new Error('INVALID_SOURCE_LEVEL');
  const raw = field(xml, 'PPLTN_TIME');
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(?::\d{2})?$/.test(raw))
    throw new Error('INVALID_SOURCE_TIME');
  const normalized = raw.length === 16 ? raw + ':00' : raw;
  const observedAt = new Date(normalized.replace(' ', 'T') + '+09:00');
  if (
    !Number.isFinite(observedAt.getTime()) ||
    observedAt > now ||
    new Date(observedAt.getTime() + 9 * 3_600_000)
      .toISOString()
      .slice(0, 19) !== normalized.replace(' ', 'T')
  ) {
    throw new Error('INVALID_SOURCE_TIME');
  }
  let quality: string | null = null;
  if (xml.includes('<REPLACE_YN>')) {
    quality = field(xml, 'REPLACE_YN');
    if (quality !== 'Y' && quality !== 'N')
      throw new Error('INVALID_SOURCE_QUALITY');
  }
  return { level: level as CrowdingLevel, observedAt, quality };
}

export class SeoulCrowdingProvider implements CrowdingProvider {
  async read(area: Area, now: Date): Promise<Observation> {
    const template =
      process.env.BABYROO_SEOUL_CITYDATA_URL ??
      'http://openapi.seoul.go.kr:8088/{key}/xml/citydata/1/5/{area}';
    const key = process.env.BABYROO_SEOUL_API_KEY;
    if (!key || !template.includes('{key}') || !template.includes('{area}')) {
      throw new Error('SOURCE_NOT_CONFIGURED');
    }
    const url = new URL(
      template
        .replace('{key}', encodeURIComponent(key))
        .replace('{area}', encodeURIComponent(area.id)),
    );
    // Seoul explicitly documents HTTP-only transport. Allow plaintext only for
    // that exact official host/port; custom proxy URLs must use HTTPS.
    const officialHttp =
      url.protocol === 'http:' &&
      url.hostname === 'openapi.seoul.go.kr' &&
      url.port === '8088';
    if (
      (!officialHttp && url.protocol !== 'https:') ||
      url.username ||
      url.password ||
      !url.pathname.includes('/xml/citydata/')
    ) {
      throw new Error('INVALID_SOURCE_CONFIGURATION');
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4_000);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        redirect: 'error',
      });
      if (!response.ok || !response.body) throw new Error('SOURCE_UNAVAILABLE');
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.byteLength;
        if (size > MAX_BYTES) {
          await reader.cancel();
          throw new Error('SOURCE_TOO_LARGE');
        }
        chunks.push(part.value);
      }
      return parseSeoulObservation(
        Buffer.concat(chunks).toString('utf8'),
        area.id,
        new Date(Math.max(now.getTime(), Date.now())),
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
