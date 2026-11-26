-- No schema changes (DDL) required; apply existing Prisma migrations first.

-- Review before executing. New events are published; existing DB-owned fields are preserved.

BEGIN;

UPDATE public.events
SET
  "price_text" = 'R석 50,000원 S석 40,000원 A석 30,000원',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'discovery-05fc74a3d5c243dbc0718be7';

UPDATE public.events
SET
  "price_text" = '30,000',
  "summary" = '금요일과 크리스마스이브 19:30, 토·일요일과 크리스마스 13:00 및 16:00. 12월 5~6일 공연 없음. 12월 4일 단체 관람으로 예매 마감.',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'discovery-83f1620860592cbe1c4cdeb5';

UPDATE public.events
SET
  "address" = '이태원로 274',
  "price_text" = '무료',
  "summary" = '아트마켓과 상시 체험은 상시 운영하며, 문화예술 프로그램은 사전예약 필수.',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'discovery-06574c2afa42d6e9073a9bd1';

INSERT INTO public.events (
  "id",
  "csv_sequence",
  "title",
  "venue_name",
  "venue_detail",
  "address",
  "locality",
  "region",
  "category",
  "source",
  "source_event_id",
  "starts_at",
  "ends_at",
  "age_min_months",
  "age_max_months",
  "indoor",
  "price_text",
  "price_type",
  "reservation_required",
  "reservation_status",
  "guardian_required",
  "stroller_friendly",
  "nursing_room",
  "parking",
  "tags",
  "summary",
  "source_url",
  "last_checked_at",
  publication_status,
  updated_at)
VALUES (
  'discovery-06010f7c5df144464c2ee450',
  258,
  '서울윈터페스티벌',
  '광화문 광장 외 6곳',
  NULL,
  NULL,
  '종로구',
  '서울',
  'festival',
  'external:festival.seoul.go.kr',
  '06010f7c5df144464c2ee450',
  DATE '2026-12-11',
  DATE '2027-01-31',
  NULL,
  NULL,
  NULL,
  NULL,
  'unknown',
  NULL,
  'unknown',
  NULL,
  NULL,
  NULL,
  NULL,
  ARRAY[]::text[],
  '서울 도심 곳곳에서 빛을 주제로 한 전시와 체험 프로그램이 열린다.',
  'https://festival.seoul.go.kr/festival/main/festivalView.do?festacode=373',
  DATE '2026-11-26',
  'published',
  CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.events (
  "id",
  "csv_sequence",
  "title",
  "venue_name",
  "venue_detail",
  "address",
  "locality",
  "region",
  "category",
  "source",
  "source_event_id",
  "starts_at",
  "ends_at",
  "age_min_months",
  "age_max_months",
  "indoor",
  "price_text",
  "price_type",
  "reservation_required",
  "reservation_status",
  "guardian_required",
  "stroller_friendly",
  "nursing_room",
  "parking",
  "tags",
  "summary",
  "source_url",
  "last_checked_at",
  publication_status,
  updated_at)
VALUES (
  'discovery-f46361a2166ff859ffc1598e',
  259,
  '2026년 종로구립합창단 크리스마스 콘서트',
  'JCC재능문화센터 콘서트홀',
  NULL,
  '종로구 창경궁로35길 29',
  NULL,
  NULL,
  'performance',
  'external:www.jfac.or.kr',
  'f46361a2166ff859ffc1598e',
  DATE '2026-12-10',
  DATE '2026-12-10',
  NULL,
  NULL,
  NULL,
  '무료',
  'free',
  NULL,
  'unknown',
  NULL,
  NULL,
  NULL,
  NULL,
  ARRAY[]::text[],
  '종로구민 대상 무료 공연으로, 종로문화재단 전화 접수 안내는 변동될 수 있다.',
  'https://www.jfac.or.kr/site/main/program/perf_show_list_view?pgIdx=2891',
  DATE '2026-11-26',
  'published',
  CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

UPDATE public.events
SET publication_status = 'archived',
    ends_at = DATE '2018-02-09',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'dikidiki-0213c7908aa6' AND publication_status = 'published';

UPDATE public.events
SET publication_status = 'archived',
    ends_at = DATE '2024-11-17',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'dikidiki-037ea44996ef' AND publication_status = 'published';

UPDATE public.events
SET publication_status = 'archived',
    ends_at = DATE '2018-02-25',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'dikidiki-1074acec7e34' AND publication_status = 'published';

UPDATE public.events
SET publication_status = 'archived',
    ends_at = DATE '2023-05-13',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'dikidiki-28c9679e96ba' AND publication_status = 'published';

UPDATE public.events
SET publication_status = 'archived',
    ends_at = DATE '2023-05-13',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'dikidiki-30984b600fd8' AND publication_status = 'published';

UPDATE public.events
SET publication_status = 'archived',
    ends_at = DATE '2023-05-07',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'dikidiki-350f1ab5d126' AND publication_status = 'published';

UPDATE public.events
SET publication_status = 'archived',
    ends_at = DATE '2023-05-12',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'dikidiki-54b08b82e004' AND publication_status = 'published';

UPDATE public.events
SET publication_status = 'archived',
    ends_at = DATE '2024-11-24',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'dikidiki-57127c8f2031' AND publication_status = 'published';

UPDATE public.events
SET publication_status = 'archived',
    ends_at = DATE '2023-05-10',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'dikidiki-57208c3c7743' AND publication_status = 'published';

UPDATE public.events
SET publication_status = 'archived',
    ends_at = DATE '2023-05-12',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'dikidiki-78e4f72165fc' AND publication_status = 'published';

UPDATE public.events
SET publication_status = 'archived',
    ends_at = DATE '2023-05-11',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'dikidiki-7f20a8e4713a' AND publication_status = 'published';

UPDATE public.events
SET publication_status = 'archived',
    ends_at = DATE '2023-05-12',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'dikidiki-8c03782949e3' AND publication_status = 'published';

UPDATE public.events
SET publication_status = 'archived',
    ends_at = DATE '2019-03-31',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'dikidiki-971c6c710891' AND publication_status = 'published';

UPDATE public.events
SET publication_status = 'archived',
    ends_at = DATE '2024-12-31',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'dikidiki-98e6fbea7eb1' AND publication_status = 'published';

UPDATE public.events
SET publication_status = 'archived',
    ends_at = DATE '2021-05-01',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'dikidiki-c1d01c45d0ca' AND publication_status = 'published';

UPDATE public.events
SET publication_status = 'archived',
    ends_at = DATE '2023-05-13',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'dikidiki-d614d8a312c8' AND publication_status = 'published';

UPDATE public.events
SET publication_status = 'archived',
    ends_at = DATE '2023-05-13',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'dikidiki-e5f2bd7cd321' AND publication_status = 'published';

UPDATE public.events
SET publication_status = 'archived',
    ends_at = DATE '2019-05-30',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'dikidiki-e6a9b60f2b20' AND publication_status = 'published';

UPDATE public.events
SET publication_status = 'archived',
    ends_at = DATE '2023-07-25',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'dikidiki-e75a66cffc9b' AND publication_status = 'published';

UPDATE public.events
SET publication_status = 'archived',
    ends_at = DATE '2018-02-22',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'dikidiki-fa7b7eb962b3' AND publication_status = 'published';

UPDATE public.events
SET publication_status = 'archived',
    ends_at = DATE '2018-02-06',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'dikidiki-ff2552427e49' AND publication_status = 'published';

UPDATE public.events
SET publication_status = 'archived',
    ends_at = DATE '2025-12-31',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'discovery-05e7776596dc6fa0546eff8d' AND publication_status = 'published';

UPDATE public.events
SET publication_status = 'archived',
    ends_at = DATE '2026-11-15',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'namu-42c0585c0e10' AND publication_status = 'published';

UPDATE public.events
SET publication_status = 'archived',
    ends_at = DATE '2026-11-14',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'namu-5410a38908a1' AND publication_status = 'published';

UPDATE public.events
SET publication_status = 'archived',
    ends_at = DATE '2026-11-15',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'namu-7c330f1517b6' AND publication_status = 'published';

UPDATE public.events
SET publication_status = 'archived',
    ends_at = DATE '2026-11-14',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'namu-8c3081e5ec4c' AND publication_status = 'published';

UPDATE public.events
SET publication_status = 'archived',
    ends_at = DATE '2026-10-18',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'namu-b363e6842d83' AND publication_status = 'published';

UPDATE public.events
SET publication_status = 'archived',
    ends_at = DATE '2026-08-30',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'namu-d226790fd0bb' AND publication_status = 'published';

UPDATE public.events
SET publication_status = 'archived',
    ends_at = DATE '2026-11-14',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'namu-d37fd214e650' AND publication_status = 'published';

UPDATE public.events
SET publication_status = 'archived',
    ends_at = DATE '2026-11-14',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'namu-d4bd54bb9af6' AND publication_status = 'published';

UPDATE public.events
SET publication_status = 'archived',
    ends_at = DATE '2026-06-26',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'nfm-kids-121ab7253a3e' AND publication_status = 'published';

UPDATE public.events
SET publication_status = 'archived',
    ends_at = DATE '2026-11-19',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'nfm-kids-1ba6be3101a8' AND publication_status = 'published';

UPDATE public.events
SET publication_status = 'archived',
    ends_at = DATE '2026-11-04',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'nfm-kids-5439d0e8d577' AND publication_status = 'published';

UPDATE public.events
SET publication_status = 'archived',
    ends_at = DATE '2026-07-19',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'nfm-kids-7347fa2032a6' AND publication_status = 'published';

UPDATE public.events
SET publication_status = 'archived',
    ends_at = DATE '2026-11-10',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'nfm-kids-b44e49748984' AND publication_status = 'published';

UPDATE public.events
SET publication_status = 'archived',
    ends_at = DATE '2026-01-30',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'nfm-kids-e4cc979856f8' AND publication_status = 'published';

UPDATE public.events
SET publication_status = 'archived',
    ends_at = DATE '2026-06-17',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'nfm-kids-f533809b0364' AND publication_status = 'published';

UPDATE public.events
SET publication_status = 'archived',
    ends_at = DATE '2026-11-15',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-culture-48efa31c7b29' AND publication_status = 'published';

UPDATE public.events
SET publication_status = 'archived',
    ends_at = DATE '2026-09-20',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-culture-c2b432d53114' AND publication_status = 'published';

UPDATE public.events
SET publication_status = 'archived',
    ends_at = DATE '2026-08-30',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-family-venues-21fccc360452' AND publication_status = 'published';

UPDATE public.events
SET publication_status = 'archived',
    ends_at = DATE '2026-08-30',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-family-venues-32afb3c4bd9c' AND publication_status = 'published';

UPDATE public.events
SET publication_status = 'archived',
    ends_at = DATE '2026-08-30',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-family-venues-a98441502297' AND publication_status = 'published';

COMMIT;
