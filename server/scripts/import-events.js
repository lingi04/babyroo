const { readFileSync } = require('fs');
const { resolve } = require('path');
const { config: loadEnvFile } = require('dotenv');
const { PrismaNeon } = require('@prisma/adapter-neon');
const { PrismaClient } = require('../src/generated/prisma/client');

loadEnvFile({ path: '.env.development.local' });
loadEnvFile({ path: '.env.local' });
loadEnvFile({ path: '.env' });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL is required to import events.');
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

  return new Date(`${value}T00:00:00.000Z`);
}

function toEventData(event, csvSequence) {
  return {
    id: event.id,
    csvSequence,
    title: requiredText(event.title),
    venueName: requiredText(event.venue_name),
    venueDetail: nullable(event.venue_detail),
    address: nullable(event.address),
    imageUrl: nullable(event.image_url),
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
  const events = Array.isArray(payload.events) ? payload.events : [];

  for (const [index, event] of events.entries()) {
    const data = toEventData(event, index + 1);
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
