-- No schema changes (DDL) required; apply existing Prisma migrations first.

-- Review before executing. New events are published; existing DB-owned fields are preserved.

BEGIN;

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  "summary" = 'DDP 뮤지엄 4층 실내 디자인 놀이터. 만 24개월 이상부터 만 8세까지 이용 가능하며 보호자 동반 입장. 휴관일 매주 월요일.',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'dikidiki-3be712ce058b';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'namu-46cfe0b823d7';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'nfm-kids-ce2dc366a355';

UPDATE public.events
SET
  "ends_at" = DATE '2026-12-31',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'nfm-kids-929f262e1ec3';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-family-venues-27571018fdf4';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-family-venues-8aca213df603';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-family-venues-8f6e028cdf48';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-family-venues-7c152da04a57';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-family-venues-6fed95eedc42';

UPDATE public.events
SET
  "category" = 'museum',
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  "summary" = '전쟁의 교훈과 나라사랑의 가치를 어린이 눈높이에 맞춰 배우는 용산구 실내 어린이박물관 관람. 10:00~17:50 총 8회차 운영, 매주 월요일 휴관.',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-family-venues-2bc00e59fb78';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-family-venues-0563099e15b4';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-family-venues-692deed7e533';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-812244bd9cbe';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-95df7ca046a3';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-5ef74b92c86d';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-6f2432f0369e';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-b2875da2ec99';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-0b4d4dc811a0';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-7bcb1a6bb198';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-6d22a0fd42f3';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-0f7d6a4316e7';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-955820d75526';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-04a98ad47461';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-eecd3d64ca08';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-84678dfafd1c';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-e66b9c09efd3';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-ab5eb41e9230';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-8bfd7517a228';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-bcec1edcad25';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-68f910c8b3f8';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-712829061bac';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-2072df1c6743';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-2195a8c1534f';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-b6659526433f';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-e9bc401ad71b';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-d6036ba8124c';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-5fa1cfb09f09';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-cea6bcaab99e';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-d5b7ba1187e9';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-a7bfccbca252';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-c22ccdc727c5';

UPDATE public.events
SET
  "age_min_months" = 24,
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-d885dba08013';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-e9323b218820';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-708d6f1cd449';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-02905e905a53';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-b724e1a7d1d5';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-f3044aa31aea';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-8b3f8bdeea78';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-79c1fb42bb1f';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-c90a4ed761bf';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-a8f0a0b0d177';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-cc3e09147197';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-005d88219af2';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-5dfe70b48241';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-96f38db4f694';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-2580bc5b85a2';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-7af9dbc79479';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-04d5c8f117d5';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "reservation_required" = TRUE,
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-66b80c7727f0';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-a2b907bea3f6';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-9fc9140260fd';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-a74d5292f168';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-341beb120212';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-37288d4dfaa0';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-7adcdcabf66d';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-5c61b5681fa4';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-b6116fab26ed';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-a74465599166';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-2eb79f8914e7';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-f01ee91ec66c';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-b6ae6513af0c';

UPDATE public.events
SET
  "address" = '서울특별시 동작구 남부순환로 2081 3층 (사당어르신종합복지관) (사당동)',
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-e283909d3761';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-4c288957ec0e';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-f24f553915ef';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-32f14fcaeaf3';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-a6e101a80d52';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-7df4a6c0ffba';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-6cebdb3a5fe7';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-ec710ec210b6';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-642390f2515d';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-d4ea55eab8b9';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-4be588b5a5e1';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-d3ac4c3d06ba';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-1e4675e5223a';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-c7a0b13077e2';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-5738893c206a';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-adeda1f9825b';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-dd27dad4c7a1';

UPDATE public.events
SET
  "address" = '서울특별시 마포구 잔다리로7길 31 (서교동379-30) 서현교회 교육관 2층 서울형키즈카페 마포구 서교동1호점',
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-f5d886231700';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-530c2e4e708f';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-089cb88c0be3';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-83ba7900d615';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-585ff37fb76d';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-dc4b1b5d64c1';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-6c34d4b56b45';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-9a96c5594a94';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-14f5608380f7';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-871335171944';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-9934205f2059';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-3eaca29a4c8d';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-a56c7a994e69';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-5c6b98804d6a';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-eb7fef269626';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-8baef3c2e321';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-fe9b1525d1f1';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-f5c48bdeed6c';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-d5ce459d67d8';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-2fb9a1f1b28e';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-7001fbbd8657';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-60a9895b813b';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-88fb564225f6';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-bbc514ee8b4a';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-f93131621d77';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-76f7b1d67f2e';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-a64acfe72fd0';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-9dff97ca28dd';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-8b70787cd8c2';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-b3e58bdee4e9';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-6657449972ef';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-b5b1aad346d0';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-e2f0dd2e0796';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-a65f43f52be8';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-03ff0a87fdf0';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-05887d82ae7c';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-268343d772ed';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-64b7da780536';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-c121702ff59f';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-12734688cec7';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-69389f1c3ff3';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-858bfb5b3530';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-e75efa5f034d';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-beb6686fa8d8';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-50361d0ae4a7';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-424fa961ed72';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-1962702a27c7';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-7ba11ebdd614';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-be53fc5fd24d';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-ee8b5c899233';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-197c53def4eb';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-460e949287aa';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-849e1a667865';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-93cee2236fe2';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-760a71349dfc';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-8b60cc546999';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-e44d21a9bbc3';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-477a60300456';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-0d7e01a80897';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-ce0c8ae95b8c';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-ebf5504a70c0';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-4c94b61c217e';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-6ae076bdefc4';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-379be22ed8e5';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-65289f9381e5';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-0ac372aba060';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-12cc2f7bb77c';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-271d184a4b27';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-6d415bafa9e2';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-bd0eac3761bc';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-d96335b098dc';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-0edd3dcd7b46';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-e779d7a625e3';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-0483313f51ba';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-aa3480859419';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-041e1408eadd';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-92a69e6c6244';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-1408ae3ccfe0';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-ef75112c51a3';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-aa8fe15fc225';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-b2f3680dd539';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-6d03b7d53bdd';

UPDATE public.events
SET
  "address" = '서울특별시 영등포구 여의도한강공원길 231 녹음수광장 옆 잔디마당 (여의도동, 제1주차장 앞)',
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-63999719e6a9';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-74ff4739b20d';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-1735349b9690';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-7fc9e2741a31';

UPDATE public.events
SET
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-9eb91931fc7c';

UPDATE public.events
SET
  "address" = '서울특별시 중랑구 송림길 216 나들이공원(제2공영주차장 뒷편) (망우동)',
  "ends_at" = DATE '9999-12-31',
  "starts_at" = DATE '1970-01-01',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-kids-cafe-ecc143dd54ee';

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
  'seoul-culture-897cbe716f20',
  195,
  '[세종문화회관] 2026 누구나 꿈나무오케스트라 정기연주회',
  '세종대극장',
  NULL,
  '서울특별시 종로구 세종대로 175',
  '종로구',
  '서울',
  NULL,
  'seoul_culture',
  '160163',
  DATE '2026-11-28',
  DATE '2026-11-28',
  36,
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
  '자료출처 : 세종문화회관 홈페이지 ※ 해당 행사 상세 정보는 상단의 ''홈페이지 바로가기'' 에서 참고 부탁드립니다.',
  'https://culture.seoul.go.kr/culture/culture/cultureEvent/view.do?cultcode=160163&menuNo=200110',
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
  'seoul-culture-f265ed7d7a8a',
  196,
  '[서울상상나라] 사랑하는 사이',
  '서울상상나라 2F 서울형키즈카페',
  NULL,
  '서울  광진구 능동로 216',
  '광진구',
  '서울',
  'experience',
  'seoul_culture',
  '159781',
  DATE '2026-10-06',
  DATE '2026-11-27',
  NULL,
  35,
  NULL,
  '무료',
  'free',
  NULL,
  'unknown',
  TRUE,
  NULL,
  NULL,
  NULL,
  ARRAY['무료', '보호자동반']::text[],
  '아이와 함께 전시를 보고, 듣고, 만지며 서로의 마음을 발견하고 특별한 순간을 마음수첩에 담는 시간, <사랑하는 사이>에 초대합니다. 일시 : 2026. 10. 6(화) ~ 11. 27.(금) 11:00, 16:00 / 화~금 평일 *주말(공휴일) 제외 장소 : 서울상상나라 2F 서울형키즈카페 대상 : 36개월 미만 영아, 보호자 비용 : 무료(입장료 4,000원 제외) *36개월 미만 무료 사랑하는 사이는 아이의 생애 첫 전시를 보호자와 함께 경험하는 감각 중심의 프로그램입니다. 작품과 공간을 천천히 탐색하며 아이와 보호자 사이에 피어난 마음과 사랑의 모양을 만나고, 우리만의 사랑하는 사이를 느껴보세요. 마음수첩을 따라 만나는 7가지 사랑의 순간 아이를 품었던 시간을 기록하는 산모수첩처럼, 아이와 함께하는 시간과 마음을 기록하는 <마음수첩>. 수첩 속 작은 미션들을 따라 작품을 자유롭게 탐색하고, 함께 느낀 감정과 순간들을 기록해 보세요. 그 기록이 모여 우리 가족만의 특별한 이야기가 됩니다. *프로그램 참여자에 한하여 작품 관람 가이드북 <마음수첩>을 제공합니다. ※ 해당 행사 상세 정보는 상단의 ''홈페이지 바로가기'' 에서 참고 부탁드립니다.',
  'https://culture.seoul.go.kr/culture/culture/cultureEvent/view.do?cultcode=159781&menuNo=200110',
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
  'namu-80d7d26e11d1',
  218,
  '극한 식물 Extreme Plants',
  '서대문자연사박물관',
  '2층 기획전시실',
  '서울시 서대문구 연희로32길 51',
  '서대문구',
  '서울',
  'exhibition',
  'namu',
  'exhibition-event-current-093c6972ccf7f560217d',
  DATE '2026-10-01',
  DATE '2027-06-20',
  NULL,
  NULL,
  NULL,
  '박물관 관람료 적용',
  'unknown',
  NULL,
  'unknown',
  NULL,
  NULL,
  NULL,
  NULL,
  ARRAY['실내']::text[],
  '서대문자연사박물관,식물은 수억 년 동안 지구 곳곳에서 살아왔습니다 뜨거운 사막과 높은 산 양분이 부족한 습지와 바닷물 속에서도 식물은 뿌리를 내리고 삶을 이어 왔습니다 그 가운데에는 우리의 상상을 넘어서는 모습을 지닌 식물들이 있습니다 사람 키보다 큰 꽃차례를 피우는 식물 연필로 찍은 점보다도 작은 꽃식물 곤충을 잡아 양분을 얻는 식물 음속의 70에 이르는 속도로 꽃가...',
  'https://namu.sdm.go.kr/web/main/exhibition/event/current/view',
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
  'namu-01933f33b291',
  219,
  '갯벌, 생명이 드러나는 시간의 땅',
  '서대문자연사박물관',
  '1층 특별전시실',
  '서울시 서대문구 연희로32길 51',
  '서대문구',
  '서울',
  'exhibition',
  'namu',
  'exhibition-special-current-238a5e5c5f1091737301',
  DATE '2026-11-10',
  DATE '2027-03-28',
  NULL,
  NULL,
  NULL,
  '박물관 관람료 적용',
  'unknown',
  NULL,
  'unknown',
  NULL,
  NULL,
  NULL,
  NULL,
  ARRAY['실내']::text[],
  '서대문자연사박물관,갯벌은 하루에 두 번 밀물이 되면 바닷물에 덮이고 썰물이 되면 땅으로 드러나는 공간이다 갯벌은 육상과 해양 두 생태계가 만나는 전이지대로 생물다양성이 풍부하며 퇴적물 내 유기물이 축적된 탄소 저장고이다 이번 전시를 통해 생태계의 보고이자 기후 위기 시대의 희망인 갯벌이 갖는 중요성을 알아보고 자연과 인간의 지속 가능한 공존을 모색해보자 전시협조 국립해...',
  'https://namu.sdm.go.kr/web/main/exhibition/special/current/view',
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
  'namu-0af7cebf622f',
  226,
  '【제1강】 2026 노벨물리학상 해설',
  '서대문자연사박물관',
  '1층 시청각실',
  '서울시 서대문구 연희로32길 51',
  '서대문구',
  '서울',
  'experience',
  'namu',
  'education-science-26256-2026-11-26-1',
  DATE '2026-11-26',
  DATE '2026-11-26',
  NULL,
  NULL,
  NULL,
  '12,000원 연간회원(일반) 10,000원',
  'paid',
  NULL,
  'unknown',
  NULL,
  NULL,
  NULL,
  NULL,
  ARRAY['실내', '예약필요']::text[],
  '● 강연 내용 2026년 노벨 물리학상은 남극의 아이스큐브 중성미자 관측소에 대한 결정적인 기여와 천체물리학적 기원의 고에너지 중성미자 발견으로 미국 위스콘신대학교의 프랜시스 할젠 교수가 수상했습니다.할젠 교수는 남극점의 얼음을 이용해 우주에서 날아오는 고에너지 중성미자를 검출한다는 대담한 아이디어를 제안하고,그 가능성을 입증했으며 국제공동연구단을 구성해 거대한 관측소의 건설을 이끌었습니다.이번 노벨 물리학상의 과학적 의미와 성과를 살펴봅니다. ● 강연자 : 하창현 교수(중앙대학교 물리학과) 미국 펜실베이니아주립대에서 물리학 박사 학위를 받았다. 미국 로런스버클리국립연구소(LBNL)에서 박사후연구원을 마치고 2015년부터 2020년까지 기초과학연구원(IBS) 지하실험연구단 연구위원으로 활동했다. 2020년 3월 중앙대 물리학과 교수로 부임했다.',
  'https://namu.sdm.go.kr/web/main/education/science/view?epIdx=26256',
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
  'namu-e5ea36303459',
  227,
  '(저)투어',
  '서대문자연사박물관',
  '1층 중앙홀 안내데스크 옆',
  '서울시 서대문구 연희로32길 51',
  '서대문구',
  '서울',
  'experience',
  'namu',
  'education-tour-26236-2026-11-28-1',
  DATE '2026-11-28',
  DATE '2026-11-28',
  84,
  108,
  NULL,
  '16,000원 연간회원(일반) 11,000원',
  'paid',
  NULL,
  'available',
  NULL,
  NULL,
  NULL,
  NULL,
  ARRAY['실내', '예약필요']::text[],
  '초등학생 저학년을 대상으로 박물관 3층 지구환경관을 관람하면서 지구의 탄생으로부터 현재에 이르기까지의 과정을 탐험하게 되고, 2층 생명진화관에서는 최초의 생명체로부터 신생대의 인류에 이르기까지 끊임없이 변천해온 생명의 진화과정에 대해서 알아보며, 1층 인간과 자연관을 관람하면서 환경보존의 중요성과 자연이 우리에게 주는 혜택을 알아봅니다.',
  'https://namu.sdm.go.kr/web/main/education/tour/view?epIdx=26236',
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
  'namu-218268d74fed',
  228,
  '(저탐구)화석탐구',
  '서대문자연사박물관',
  '1층 중앙홀 안내데스크 옆',
  '서울시 서대문구 연희로32길 51',
  '서대문구',
  '서울',
  'experience',
  'namu',
  'education-tour-26237-2026-11-28-2',
  DATE '2026-11-28',
  DATE '2026-11-28',
  96,
  108,
  NULL,
  '16,000원 연간회원(일반) 11,000원',
  'paid',
  NULL,
  'available',
  NULL,
  NULL,
  NULL,
  NULL,
  ARRAY['실내', '예약필요']::text[],
  '기존 일반투어를 수강하였던 2-3학년 아이들을 위한 탐구학습 프로그램입니다. 중앙홀과 2층 생명진화관(~신생대)에 대한 탐구 수업을 합니다. - 2026년도 기준 1학년 신청불가',
  'https://namu.sdm.go.kr/web/main/education/tour/view?epIdx=26237',
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
  'namu-633531e06e20',
  229,
  '【제2강】 2026 노벨생리의학상 해설',
  '서대문자연사박물관',
  '1층 시청각실',
  '서울시 서대문구 연희로32길 51',
  '서대문구',
  '서울',
  'experience',
  'namu',
  'education-science-26257-2026-11-29-1',
  DATE '2026-11-29',
  DATE '2026-11-29',
  NULL,
  NULL,
  NULL,
  '12,000원 연간회원(일반) 10,000원',
  'paid',
  NULL,
  'available',
  NULL,
  NULL,
  NULL,
  NULL,
  ARRAY['실내', '예약필요']::text[],
  '● 강연 내용 2026년 노벨 생리의학상은 빛으로 신경세포의 활동을 켜고 끌 수 있게 한 ''광유전학''을 개척한 세 과학자에게 돌아갔습니다.연못의 녹조류가 빛을 감지하는 단백질을 신경세포에 옮겨 심어,뇌 회로가 기억과 행동,감정을 어떻게 만들어내는지 직접 확인할 수 있게 한 연구입니다.수상 연구의 원리와 함께,강연자가 직접 개발한 차세대 광유전학 도구들과 이 기술이 뇌 질환 치료로 확장되는 길을 살펴봅니다. ● 강연자 : 허원도 석좌교수(KAIST 생명과학과) 경상국립대학교에서 박사 학위를 받고 이후 미국 듀크 대학교와 스탠포드 대학교 토비아스 마이어 연구실로 옮겨 박사 후 연구 과정을 밟았다. 이후 2008년 KAIST로 옮겨 교수로 재직하면서 다양한 생체 신호 단백질의 역할을 다양한 바이오 이미징과 ‘광유전학’ 기술을 사용해 연구했다. 이러한 연구를 통해 생명현상의 근본 원리와 질병의 발생 기전을 규명하고, 인간 질환 치료를 위한 혁신적 전략으로 확장하고 있다.',
  'https://namu.sdm.go.kr/web/main/education/science/view?epIdx=26257',
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
  'namu-54ee600324ac',
  230,
  '(유)생명',
  '서대문자연사박물관',
  '1층 중앙홀 안내데스크 옆',
  '서울시 서대문구 연희로32길 51',
  '서대문구',
  '서울',
  'experience',
  'namu',
  'education-tour-26238-2026-11-29-1',
  DATE '2026-11-29',
  DATE '2026-11-29',
  72,
  84,
  NULL,
  '16,000원 연간회원(일반) 11,000원',
  'paid',
  NULL,
  'available',
  NULL,
  NULL,
  NULL,
  NULL,
  ARRAY['실내', '예약필요']::text[],
  '(유치부 6세(2020년)~초등 1학년 수업) 2층 생명진화관 (~신생때까지)을 관람하면서 최초의 생명체로부터 고생대의 삼엽충, 중생대의 공룡, 신생대의 인류에 이르기까지 끊임없이 변천해온 생명의 진화과정에 대해서 알아봅니다. - 2026년 기준 유치부 4~5세 신청불가',
  'https://namu.sdm.go.kr/web/main/education/tour/view?epIdx=26238',
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
  'namu-7bef997945bd',
  231,
  '(고)우주에서 뛰어놀기',
  '서대문자연사박물관',
  '1층 중앙홀 안내데스크 옆',
  '서울시 서대문구 연희로32길 51',
  '서대문구',
  '서울',
  'experience',
  'namu',
  'education-tour-26239-2026-11-29-2',
  DATE '2026-11-29',
  DATE '2026-11-29',
  120,
  144,
  NULL,
  '16,000원 연간회원(일반) 11,000원',
  'paid',
  NULL,
  'available',
  NULL,
  NULL,
  NULL,
  NULL,
  ARRAY['실내', '예약필요']::text[],
  '초등4~6학년 이벤트 프로그램입니다. 우주탐사를 위해 발사한 다양한 우주탐사선들의 이야기와 우리나라 우주탐사의 미래에 대한 이야기들을 살펴보고 행성큐브를 만들어 갑니다. - 관련 부분에 대한 전시장 설명이 있습니다.',
  'https://namu.sdm.go.kr/web/main/education/tour/view?epIdx=26239',
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
  'seoul-family-venues-8b8c3e111f58',
  236,
  '한 방울의 재생',
  '서울물재생체험관',
  NULL,
  '서울특별시 강서구 양천로 201 서남물재생센터 내',
  '강서구',
  '서울',
  'experience',
  'seoul_family_venues',
  'swr-72622034e02e',
  DATE '2026-10-10',
  DATE '2026-11-28',
  NULL,
  NULL,
  NULL,
  '무료',
  'free',
  TRUE,
  'unknown',
  NULL,
  NULL,
  NULL,
  NULL,
  ARRAY['무료', '보호자동반', '실내', '예약필요']::text[],
  '교육 (매주 토).',
  'https://swr.or.kr/museum/cpage/board/edu_museum_press/view.do?board_seq=321&board_gb=edu_museum_press&menu_cd=C0015&currRow=1',
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
  'seoul-family-venues-d5d2cee8a4a2',
  237,
  '물방울 크리에이터(하반기)',
  '서울물재생체험관',
  NULL,
  '서울특별시 강서구 양천로 201 서남물재생센터 내',
  '강서구',
  '서울',
  'experience',
  'seoul_family_venues',
  'swr-862ed68d5143',
  DATE '2026-10-10',
  DATE '2026-11-28',
  NULL,
  NULL,
  NULL,
  '무료',
  'free',
  TRUE,
  'unknown',
  NULL,
  NULL,
  NULL,
  NULL,
  ARRAY['무료', '보호자동반', '실내', '예약필요']::text[],
  '페이스북 (매주 토).',
  'https://swr.or.kr/museum/cpage/board/edu_museum_press/view.do?board_seq=320&board_gb=edu_museum_press&menu_cd=C0015&currRow=1',
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
  'seoul-kids-cafe-d9eb248b97b1',
  238,
  '서울형 키즈카페 관악구 성현동점 이용',
  '서울형 키즈카페 관악구 성현동점',
  NULL,
  '서울특별시 관악구 구암5길 8 서울형 키즈카페 성현동점 1층 (봉천동)',
  '관악구',
  '서울',
  'play_space',
  'seoul_kids_cafe',
  '2001-GA261101',
  DATE '1970-01-01',
  DATE '9999-12-31',
  0,
  11,
  TRUE,
  '유료',
  'paid',
  NULL,
  'unknown',
  TRUE,
  NULL,
  NULL,
  NULL,
  ARRAY['24개월이하', '보호자동반', '실내', '예약필요']::text[],
  '서울형 키즈카페 관악구 성현동점 서울형 키즈카페 보호자 동반 실내 놀이공간 이용.',
  'https://umppa.seoul.go.kr/icare/user/kidsCafe/BD_selectKidsCafeView.do?q_fcltyId=GA261101&q_fcltyStle=2001',
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
  'seoul-kids-cafe-664fd6dfa38e',
  239,
  '서울형 키즈카페 구로구 천왕근린공원점 이용',
  '서울형 키즈카페 구로구 천왕근린공원점',
  NULL,
  '서울특별시 구로구 금오로 878 서울형 키즈카페 구로구 천왕근린공원점 (천왕동)',
  '구로구',
  '서울',
  'play_space',
  'seoul_kids_cafe',
  '2001-GR261001',
  DATE '1970-01-01',
  DATE '9999-12-31',
  48,
  119,
  TRUE,
  '유료',
  'paid',
  TRUE,
  'unknown',
  TRUE,
  NULL,
  NULL,
  NULL,
  ARRAY['보호자동반', '실내', '예약필요']::text[],
  '서울형 키즈카페 구로구 천왕근린공원점 서울형 키즈카페 보호자 동반 실내 놀이공간 이용.',
  'https://umppa.seoul.go.kr/icare/user/kidsCafe/BD_selectKidsCafeView.do?q_fcltyId=GR261001&q_fcltyStle=2001',
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
  'seoul-kids-cafe-bee13488036b',
  240,
  '서울형 키즈카페 도봉구 둘리쌍문근린공원점(호이호이 비밀의 숲) 이용',
  '서울형 키즈카페 도봉구 둘리쌍문근린공원점(호이호이 비밀의 숲)',
  NULL,
  '서울특별시 도봉구 시루봉로 31 (쌍문동)',
  '도봉구',
  '서울',
  'play_space',
  'seoul_kids_cafe',
  '2001-DB260801',
  DATE '1970-01-01',
  DATE '9999-12-31',
  36,
  107,
  TRUE,
  '유료',
  'paid',
  TRUE,
  'unknown',
  TRUE,
  NULL,
  NULL,
  NULL,
  ARRAY['보호자동반', '실내', '예약필요']::text[],
  '서울형 키즈카페 도봉구 둘리쌍문근린공원점(호이호이 비밀의 숲) 서울형 키즈카페 보호자 동반 실내 놀이공간 이용.',
  'https://umppa.seoul.go.kr/icare/user/kidsCafe/BD_selectKidsCafeView.do?q_fcltyId=DB260801&q_fcltyStle=2001',
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
  'seoul-kids-cafe-976decefbf3c',
  241,
  '서울형 키즈카페 동작구 노량진1동점(동작키즈카페) 이용',
  '서울형 키즈카페 동작구 노량진1동점(동작키즈카페)',
  NULL,
  '서울특별시 동작구 노량진로32길 62 2층 (본동)',
  '동작구',
  '서울',
  'play_space',
  'seoul_kids_cafe',
  '2001-DJ260901',
  DATE '1970-01-01',
  DATE '9999-12-31',
  0,
  83,
  TRUE,
  '유료',
  'paid',
  TRUE,
  'unknown',
  TRUE,
  NULL,
  NULL,
  NULL,
  ARRAY['24개월이하', '보호자동반', '실내', '예약필요']::text[],
  '서울형 키즈카페 동작구 노량진1동점(동작키즈카페) 서울형 키즈카페 보호자 동반 실내 놀이공간 이용.',
  'https://umppa.seoul.go.kr/icare/user/kidsCafe/BD_selectKidsCafeView.do?q_fcltyId=DJ260901&q_fcltyStle=2001',
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
  'seoul-kids-cafe-0afabbda3baf',
  242,
  '서울형 키즈카페 서초구 방배2동2호점(서리풀노리학교 방배2동2호점) 이용',
  '서울형 키즈카페 서초구 방배2동2호점(서리풀노리학교 방배2동2호점)',
  NULL,
  '서울특별시 서초구 서초대로 50 (방배동, 디에이치방배) 커뮤니티시설 1층',
  '서초구',
  '서울',
  'play_space',
  'seoul_kids_cafe',
  '2001-SC260801',
  DATE '1970-01-01',
  DATE '9999-12-31',
  0,
  83,
  TRUE,
  '유료',
  'paid',
  TRUE,
  'unknown',
  TRUE,
  NULL,
  NULL,
  NULL,
  ARRAY['24개월이하', '보호자동반', '실내', '예약필요']::text[],
  '서울형 키즈카페 서초구 방배2동2호점(서리풀노리학교 방배2동2호점) 서울형 키즈카페 보호자 동반 실내 놀이공간 이용.',
  'https://umppa.seoul.go.kr/icare/user/kidsCafe/BD_selectKidsCafeView.do?q_fcltyId=SC260801&q_fcltyStle=2001',
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
  'seoul-kids-cafe-fd9f0be28930',
  243,
  '강북구 솔밭근린공원 이용',
  '강북구 솔밭근린공원',
  NULL,
  '서울특별시 강북구 삼양로 561 솔밭근린공원 (우이동) - 솔밭공원관리사무소 옆',
  '강북구',
  '서울',
  'play_space',
  'seoul_kids_cafe',
  '2002-GB260901',
  DATE '1970-01-01',
  DATE '9999-12-31',
  48,
  119,
  TRUE,
  '유료',
  'paid',
  NULL,
  'unknown',
  TRUE,
  NULL,
  NULL,
  NULL,
  ARRAY['보호자동반', '실내', '예약필요']::text[],
  '강북구 솔밭근린공원 여기저기 키즈카페 보호자 동반 실내 놀이공간 이용.',
  'https://umppa.seoul.go.kr/icare/user/kidsCafe/BD_selectKidsCafeView.do?q_fcltyId=GB260901&q_fcltyStle=2002',
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
  'seoul-kids-cafe-cc4283632d42',
  244,
  '구로구 오류역광장 이용',
  '구로구 오류역광장',
  NULL,
  '서울특별시 구로구 경인로20길 13 오류동역광장 (오류동)',
  '구로구',
  '서울',
  'play_space',
  'seoul_kids_cafe',
  '2002-GR260901',
  DATE '1970-01-01',
  DATE '9999-12-31',
  36,
  95,
  TRUE,
  '유료',
  'paid',
  NULL,
  'unknown',
  TRUE,
  NULL,
  NULL,
  NULL,
  ARRAY['보호자동반', '실내', '예약필요']::text[],
  '구로구 오류역광장 여기저기 키즈카페 보호자 동반 실내 놀이공간 이용.',
  'https://umppa.seoul.go.kr/icare/user/kidsCafe/BD_selectKidsCafeView.do?q_fcltyId=GR260901&q_fcltyStle=2002',
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
  'seoul-kids-cafe-11ab5eec1bc6',
  245,
  '서대문 홍제동 문화공원 이용',
  '서대문 홍제동 문화공원',
  NULL,
  '서울특별시 서대문구 세검정로4길 11 문화공원 (홍제동)',
  '서대문구',
  '서울',
  'play_space',
  'seoul_kids_cafe',
  '2002-SM260901',
  DATE '1970-01-01',
  DATE '9999-12-31',
  48,
  119,
  TRUE,
  '유료',
  'paid',
  NULL,
  'unknown',
  TRUE,
  NULL,
  NULL,
  NULL,
  ARRAY['보호자동반', '실내', '예약필요']::text[],
  '서대문 홍제동 문화공원 여기저기 키즈카페 보호자 동반 실내 놀이공간 이용.',
  'https://umppa.seoul.go.kr/icare/user/kidsCafe/BD_selectKidsCafeView.do?q_fcltyId=SM260901&q_fcltyStle=2002',
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
  'seoul-kids-cafe-0c467ffed502',
  246,
  '성북구 길빛근린공원 이용',
  '성북구 길빛근린공원',
  NULL,
  '서울특별시 성북구 숭인로8길 52 길빛근린공원 (길음동)',
  '성북구',
  '서울',
  'play_space',
  'seoul_kids_cafe',
  '2002-SB260901',
  DATE '1970-01-01',
  DATE '9999-12-31',
  48,
  119,
  TRUE,
  '유료',
  'paid',
  NULL,
  'unknown',
  TRUE,
  NULL,
  NULL,
  NULL,
  ARRAY['보호자동반', '실내', '예약필요']::text[],
  '성북구 길빛근린공원 여기저기 키즈카페 보호자 동반 실내 놀이공간 이용.',
  'https://umppa.seoul.go.kr/icare/user/kidsCafe/BD_selectKidsCafeView.do?q_fcltyId=SB260901&q_fcltyStle=2002',
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
  'seoul-kids-cafe-aad7a5a20730',
  247,
  '용산구 노들섬 수변부 이용',
  '용산구 노들섬 수변부',
  NULL,
  '서울특별시 용산구 양녕로 445 노들섬 (이촌동)',
  '용산구',
  '서울',
  'play_space',
  'seoul_kids_cafe',
  '2002-YS260901',
  DATE '1970-01-01',
  DATE '9999-12-31',
  36,
  95,
  TRUE,
  '유료',
  'paid',
  NULL,
  'unknown',
  TRUE,
  NULL,
  NULL,
  NULL,
  ARRAY['보호자동반', '실내', '예약필요']::text[],
  '용산구 노들섬 수변부 여기저기 키즈카페 보호자 동반 실내 놀이공간 이용.',
  'https://umppa.seoul.go.kr/icare/user/kidsCafe/BD_selectKidsCafeView.do?q_fcltyId=YS260901&q_fcltyStle=2002',
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
  'discovery-57644efdf34470f6dd53ccf7',
  248,
  'NATIONAL CHILDREN’S SCIENCE CENTER',
  'NATIONAL CHILDREN’S SCIENCE CENTER',
  NULL,
  '서울특별시 종로구 창경궁로 215',
  '종로구',
  '서울',
  'exhibition',
  'external:www.sciencecenter.go.kr',
  '57644efdf34470f6dd53ccf7',
  DATE '1970-01-01',
  DATE '9999-12-31',
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
  NULL,
  'https://www.sciencecenter.go.kr/csc/reserve/personal',
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
  'discovery-ecb08e737059b0e653dab24e',
  249,
  '크리스마스 캐럴',
  '세종문화회관',
  '세종M씨어터',
  '서울특별시 종로구 세종대로 175',
  '종로구',
  '서울',
  'performance',
  'external:www.sejongpac.or.kr',
  'ecb08e737059b0e653dab24e',
  DATE '2026-12-02',
  DATE '2026-12-27',
  60,
  NULL,
  NULL,
  NULL,
  'paid',
  NULL,
  'unknown',
  NULL,
  NULL,
  NULL,
  NULL,
  ARRAY[]::text[],
  NULL,
  'https://www.sejongpac.or.kr/portal/performance/performance/performTicket.do?performIdx=36793&menuNo=200320',
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
  'discovery-c407d73d3456faf50075cc29',
  251,
  '서울탐험대',
  '내친구서울관',
  NULL,
  '서울 중구 세종대로 110',
  '중구',
  '서울',
  'exhibition',
  'external:mediahub.seoul.go.kr',
  'c407d73d3456faf50075cc29',
  DATE '2026-11-20',
  DATE '2027-02-28',
  NULL,
  NULL,
  NULL,
  NULL,
  'free',
  NULL,
  'unknown',
  NULL,
  NULL,
  NULL,
  NULL,
  ARRAY[]::text[],
  NULL,
  'https://mediahub.seoul.go.kr/archives/2020092',
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
  'discovery-05fc74a3d5c243dbc0718be7',
  252,
  '송년 가족 음악회',
  '세종문화회관',
  '세종대극장',
  '서울특별시 종로구 세종대로 175',
  '종로구',
  '서울',
  'performance',
  'external:www.sejongpac.or.kr',
  '05fc74a3d5c243dbc0718be7',
  DATE '2026-12-05',
  DATE '2026-12-05',
  84,
  NULL,
  NULL,
  NULL,
  'paid',
  NULL,
  'unknown',
  NULL,
  NULL,
  NULL,
  NULL,
  ARRAY[]::text[],
  NULL,
  'https://www.sejongpac.or.kr/portal/performance/performance/performTicket.do?performIdx=36794&menuNo=200320',
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
  'discovery-0a10016b02f715da5917c5ed',
  253,
  'DIMA: 아기 매머드 디마와 함께하는 빙하기 탐험',
  '서울백제어린이박물관',
  NULL,
  '서울특별시 송파구 올림픽로 424',
  '송파구',
  '서울',
  'exhibition',
  'external:baekjemuseum.seoul.go.kr',
  '0a10016b02f715da5917c5ed',
  DATE '2026-11-17',
  DATE '2027-03-07',
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
  NULL,
  'https://baekjemuseum.seoul.go.kr/dreamvillage/board/notice/index.jsp?boardid=SDM0401000000&mmode=content&mpid=SDM0401000000&skin=notice&pid=23671&pg=1&cpage=1',
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
  'discovery-06574c2afa42d6e9073a9bd1',
  254,
  '용산 크리스마스 아틀리에',
  '용산문화재단',
  NULL,
  NULL,
  '용산구',
  '서울',
  'festival',
  'external:festival.seoul.go.kr',
  '06574c2afa42d6e9073a9bd1',
  DATE '2026-12-11',
  DATE '2026-12-20',
  NULL,
  NULL,
  NULL,
  NULL,
  'free',
  NULL,
  'unknown',
  NULL,
  NULL,
  NULL,
  NULL,
  ARRAY[]::text[],
  NULL,
  'https://festival.seoul.go.kr/festival/main/festivalView.do?festacode=989',
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
  'discovery-2a3cd4f02234d757bfaa55ca',
  255,
  '문화놀이',
  '서울상상나라',
  '3층 문화놀이',
  NULL,
  '광진구',
  '서울',
  'exhibition',
  'external:www.seoulchildrensmuseum.org',
  '2a3cd4f02234d757bfaa55ca',
  DATE '1970-01-01',
  DATE '9999-12-31',
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
  NULL,
  'https://www.seoulchildrensmuseum.org/display/displayExhibition07.do',
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
  'discovery-83f1620860592cbe1c4cdeb5',
  256,
  '아이들극장 연말공연 <산타찾기>',
  '아이들극장',
  NULL,
  '서울시 종로구 성균관로 91',
  '종로구',
  '서울',
  'performance',
  'external:www.jfac.or.kr',
  '83f1620860592cbe1c4cdeb5',
  DATE '2026-12-04',
  DATE '2026-12-25',
  36,
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
  NULL,
  'https://www.jfac.or.kr/site/child/childProgram/view?pgIdx=372',
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
  'discovery-74eb611ab04986b6f376f9cc',
  257,
  '유니버설발레단 <호두까기인형>',
  '세종문화회관',
  '대극장',
  '서울특별시 종로구 세종대로 175',
  '종로구',
  '서울',
  'performance',
  'external:www.sejongpac.or.kr',
  '74eb611ab04986b6f376f9cc',
  DATE '2026-12-17',
  DATE '2026-12-30',
  48,
  NULL,
  NULL,
  'VIP석 14만원ㅣ R석 12만원ㅣ S석 9만원ㅣA석 6만원ㅣB석 3만원',
  'unknown',
  NULL,
  'unknown',
  NULL,
  NULL,
  NULL,
  NULL,
  ARRAY[]::text[],
  NULL,
  'https://www.sejongpac.or.kr/portal/bbs/B0000049/view.do?nttId=50200&menuNo=200440&pageIndex=1',
  DATE '2026-11-26',
  'published',
  CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

UPDATE public.events
SET publication_status = 'archived',
    ends_at = DATE '2026-08-30',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'namu-d226790fd0bb' AND publication_status = 'published';

UPDATE public.events
SET publication_status = 'archived',
    ends_at = DATE '2026-11-15',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-culture-48efa31c7b29' AND publication_status = 'published';

UPDATE public.events
SET publication_status = 'archived',
    ends_at = DATE '2026-11-10',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'nfm-kids-b44e49748984' AND publication_status = 'published';

UPDATE public.events
SET publication_status = 'archived',
    ends_at = DATE '2026-10-18',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'namu-b363e6842d83' AND publication_status = 'published';

UPDATE public.events
SET publication_status = 'archived',
    ends_at = DATE '2026-11-04',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'nfm-kids-5439d0e8d577' AND publication_status = 'published';

UPDATE public.events
SET publication_status = 'archived',
    ends_at = DATE '2026-08-30',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-family-venues-32afb3c4bd9c' AND publication_status = 'published';

UPDATE public.events
SET publication_status = 'archived',
    ends_at = DATE '2026-09-20',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-culture-c2b432d53114' AND publication_status = 'published';

UPDATE public.events
SET publication_status = 'archived',
    ends_at = DATE '2026-08-30',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-family-venues-a98441502297' AND publication_status = 'published';

UPDATE public.events
SET publication_status = 'archived',
    ends_at = DATE '2026-08-30',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'seoul-family-venues-21fccc360452' AND publication_status = 'published';

UPDATE public.events
SET publication_status = 'archived',
    ends_at = DATE '2026-11-19',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'nfm-kids-1ba6be3101a8' AND publication_status = 'published';

COMMIT;
