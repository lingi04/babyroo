-- No schema changes (DDL) required; apply existing Prisma migrations first.

-- Review before executing. New events are published; existing DB-owned fields are preserved.

BEGIN;

UPDATE public.events
SET
  "price_text" = 'R석
50,000원
S석
40,000원
A석
30,000원',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'discovery-05fc74a3d5c243dbc0718be7';

UPDATE public.events
SET
  "price_text" = '30,000',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'discovery-83f1620860592cbe1c4cdeb5';

UPDATE public.events
SET
  "price_text" = 'R석
80,000원
S석
60,000원',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'discovery-ecb08e737059b0e653dab24e';

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
  'seoul-culture-b5f71fd3761e',
  258,
  '[동작문화재단] 2026 동작사육신 충효예술한마당',
  '사육신 역사관 및 야외마당 갤러리',
  NULL,
  '서울특별시 동작구 노량진로 191',
  '동작구',
  '서울',
  NULL,
  'seoul_culture',
  '159614',
  DATE '2026-10-03',
  DATE '2026-11-28',
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
  ARRAY['무료']::text[],
  '※ 해당 행사 상세 정보는 상단의 ''홈페이지 바로가기'' 에서 참고 부탁드립니다.',
  'https://culture.seoul.go.kr/culture/culture/cultureEvent/view.do?cultcode=159614&menuNo=200110',
  DATE '2026-11-27',
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
  'discovery-de0c58cf8990b46cfddd79dd',
  259,
  '어린이박물관',
  '어린이박물관',
  NULL,
  '서울특별시 용산구 서빙고로 137',
  NULL,
  NULL,
  'exhibition',
  'external:www.museum.go.kr',
  'de0c58cf8990b46cfddd79dd',
  DATE '1970-01-01',
  DATE '9999-12-31',
  NULL,
  NULL,
  NULL,
  '무료 관람입니다.',
  'free',
  TRUE,
  'unknown',
  NULL,
  NULL,
  NULL,
  NULL,
  ARRAY[]::text[],
  '영유아는 데굴데굴놀이터를 이용할 수 있습니다.',
  'https://www.museum.go.kr/MUSEUM/contents/M0104010000.do?schM=',
  DATE '2026-11-27',
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
  'discovery-6c4db400cf6b876b2c056249',
  260,
  '서울백제어린이박물관',
  '서울백제어린이박물관',
  NULL,
  '서울특별시 송파구 올림픽로 424',
  NULL,
  NULL,
  'exhibition',
  'external:baekjemuseum.seoul.go.kr',
  '6c4db400cf6b876b2c056249',
  DATE '1970-01-01',
  DATE '9999-12-31',
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
  '어린이 눈높이의 상설전시에서 백제왕성 사람들의 하루와 백제 이야기를 살펴봅니다.',
  'https://baekjemuseum.seoul.go.kr/dreamvillage',
  DATE '2026-11-27',
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
  'discovery-3652b9b29879b974fae42c24',
  261,
  '2026 서울윈터페스티벌 개막식',
  '광화문광장',
  '광화문광장 특설무대',
  NULL,
  NULL,
  '서울',
  'festival',
  'external:www.winterfestival.co.kr',
  '3652b9b29879b974fae42c24',
  DATE '2026-12-12',
  DATE '2026-12-12',
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
  '광화문광장 특설무대에서 뮤지컬 갈라, 퍼레이드와 시민합창단 공연을 봅니다.',
  'https://www.winterfestival.co.kr/program-opening',
  DATE '2026-11-27',
  'published',
  CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

UPDATE public.events
SET publication_status = 'archived',
    ends_at = DATE '2026-11-26',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'namu-0af7cebf622f' AND publication_status = 'published';

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
