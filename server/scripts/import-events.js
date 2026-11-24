const { readFileSync } = require('fs');
const { resolve } = require('path');
const { config: loadEnvFile } = require('dotenv');
const { PrismaNeon } = require('@prisma/adapter-neon');
const { PrismaClient } = require('../src/generated/prisma/client');

loadEnvFile({ path: '.env.development.local' });
loadEnvFile({ path: '.env.local' });
loadEnvFile({ path: '.env' });

const databaseUrl =
  process.env.DATABASE_URL ||
  process.env.babyroo_DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.babyroo_POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL ||
  process.env.babyroo_POSTGRES_URL;

if (!databaseUrl) {
  console.error('A database URL env var is required to import events.');
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString: databaseUrl }),
});

function nullable(value) {
  return value === undefined || value === null ? null : value;
}

function requiredText(value, fallback = '') {
  return value === undefined || value === null ? fallback : String(value);
}

function optionalBoolean(value) {
  return typeof value === 'boolean' ? value : null;
}

function optionalNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function dateOnly(value, fieldName, eventId) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Event ${eventId} is missing required date field: ${fieldName}`);
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)
      || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`Event ${eventId} has invalid date field: ${fieldName}`);
  }
  return parsed;
}

function toEventData(event, csvSequence) {
  return {
    id: event.id,
    csvSequence,
    title: requiredText(event.title),
    venueName: requiredText(event.venue_name),
    venueDetail: nullable(event.venue_detail),
    address: nullable(event.address),
    // Omitted image fields are outside the Git baseline; preserve existing DB images.
    ...(Object.prototype.hasOwnProperty.call(event, 'image_url')
      ? { imageUrl: nullable(event.image_url) }
      : {}),
    locality: requiredText(event.locality),
    region: requiredText(event.region),
    category: requiredText(event.category, 'unknown'),
    source: requiredText(event.source),
    sourceEventId: nullable(event.source_event_id),
    startsAt: dateOnly(event.starts_at, 'starts_at', event.id),
    endsAt: dateOnly(event.ends_at, 'ends_at', event.id),
    ageMinMonths: optionalNumber(event.age_min_months),
    ageMaxMonths: optionalNumber(event.age_max_months),
    indoor: optionalBoolean(event.indoor),
    priceText: nullable(event.price_text),
    priceType: requiredText(event.price_type, 'unknown'),
    reservationRequired: optionalBoolean(event.reservation_required),
    reservationStatus: requiredText(event.reservation_status, 'unknown'),
    guardianRequired: optionalBoolean(event.guardian_required),
    strollerFriendly: optionalBoolean(event.stroller_friendly),
    nursingRoom: optionalBoolean(event.nursing_room),
    parking: optionalBoolean(event.parking),
    tags: Array.isArray(event.tags) ? event.tags : [],
    summary: requiredText(event.summary),
    sourceUrl: requiredText(event.source_url),
    lastCheckedAt: event.last_checked_at
      ? dateOnly(event.last_checked_at, 'last_checked_at', event.id)
      : null,
  };
}

async function main() {
  const eventsPath = resolve(process.cwd(), 'data/events.json');
  const payload = JSON.parse(readFileSync(eventsPath, 'utf8'));
  if (!Array.isArray(payload.events) || payload.events.length === 0
      || payload.count !== payload.events.length) {
    throw new Error('Expected a nonempty event catalog with a matching count.');
  }
  const events = payload.events;
  // Validate the entire input before the first write. This is not a DB transaction.
  const ids = new Set();
  const sequences = new Set();
  const identities = new Set();
  const rows = events.map((event, index) => {
    if (!event || typeof event.id !== 'string' || !event.id.trim()) {
      throw new Error('Every event must have an id.');
    }
    const sequence = event.csv_sequence === undefined || event.csv_sequence === null
      ? index + 1 : event.csv_sequence;
    if (!Number.isInteger(sequence) || sequence < 1) {
      throw new Error('csv_sequence must be a positive integer.');
    }
    const data = toEventData(event, sequence);
    const identity = data.sourceEventId ? JSON.stringify([data.source, data.sourceEventId]) : null;
    if (ids.has(data.id) || sequences.has(sequence) || (identity && identities.has(identity))) {
      throw new Error('Duplicate event id, sequence, or source identity.');
    }
    ids.add(data.id);
    sequences.add(sequence);
    if (identity) identities.add(identity);
    return data;
  });

  for (const data of rows) {
    await prisma.event.upsert({
      where: { id: data.id },
      update: data,
      create: data,
    });
  }

  console.log(`Imported ${events.length} events from ${eventsPath}`);
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
