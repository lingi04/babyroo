# Babyroo crawler plan

## 목표

초기 crawler의 목표는 많은 사이트를 한 번에 긁는 것이 아니라, 출처별 데이터를 Babyroo 공통 스키마로 안정적으로 바꾸는 흐름을 만드는 것입니다.

## 파이프라인

1. `collect`
   - 출처별 원문 데이터를 `data/raw/{source}.json`에 저장합니다.
   - 원문에서 확실히 알 수 있는 값만 담습니다.

2. `normalize`
   - 출처별 필드명을 Babyroo 공통 필드로 변환합니다.
   - 날짜, 가격, 월령, 카테고리, 부모용 태그를 정리합니다.

3. `publish`
   - 정적 웹이 읽을 `public/events.json`을 생성합니다.

## 공통 이벤트 필드

- `id`
- `title`
- `category`: `performance`, `experience`, `play_space`
- `starts_at`
- `ends_at`
- `region`
- `venue_name`
- `address`
- `age_min_months`
- `age_max_months`
- `guardian_required`
- `price_type`: `free`, `paid`
- `price_text`
- `reservation_required`
- `indoor`
- `stroller_friendly`
- `nursing_room`
- `parking`
- `tags`
- `summary`
- `source`
- `source_url`
- `source_event_id`
- `last_checked_at`

## 초기 수집 후보

첫 번째 실제 collector는 HTML 구조가 비교적 안정적이고 공공성이 높은 곳부터 붙이는 것이 좋습니다.

- 서울시 문화포털 행사
- 서울특별시 육아종합지원센터
- 경기육아종합지원센터
- 구청 문화행사 페이지 중 영유아 행사가 꾸준한 곳

