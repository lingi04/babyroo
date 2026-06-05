# Babyroo crawler plan

## 목표

초기 crawler의 목표는 많은 사이트를 한 번에 긁는 것이 아니라, 출처별 데이터를 육아초보 아빠가 외출 결정을 내리기 쉬운 Babyroo 공통 스키마로 안정적으로 바꾸는 흐름을 만드는 것입니다.

## 파이프라인

1. `collect`
   - 출처별 원문 데이터를 `data/raw/{source}.json`에 저장합니다.
   - 원문에서 확실히 알 수 있는 값만 담습니다.

2. `normalize`
   - 출처별 필드명을 Babyroo 공통 필드로 변환합니다.
   - 날짜, 가격, 월령, 카테고리, 외출 결정 태그를 정리합니다.

3. `publish`
   - 정적 웹이 읽을 `public/events.json`을 생성합니다.
   - 종료 행사와 노출 최소 기준 미달 행사를 제외하는 품질 게이트 역할을 합니다.

`publish`는 사용자에게 보여도 되는 유효 행사만 남깁니다. 추천 로직은 `public/events.json`에 공개된 유효 행사 안에서만 월령, 날짜, 지역, 카테고리, 상황 태그를 기준으로 후보를 고릅니다.

## 공통 이벤트 필드

- `id`: 필수. Babyroo 내부 식별자입니다.
- `title`: 필수.
- `category`: `performance`, `experience`, `play_space`, `null`.
- `starts_at`: 필수. `YYYY-MM-DD` 형식을 우선 사용합니다.
- `ends_at`: `YYYY-MM-DD` 또는 `null`. 단일 날짜 행사는 `starts_at`과 같은 값을 사용합니다.
- `region`: 필수. 초기에는 `서울`, `경기`처럼 넓은 지역 단위로 둡니다.
- `locality`: `마포구`, `성동구`, `수원시`처럼 화면 표시와 추후 근거리 추천에 쓸 세부 지역입니다. 알 수 없으면 `null`.
- `venue_name`: 장소명을 알 수 없으면 `null`.
- `address`: 주소를 알 수 없으면 `null`.
- `age_min_months`: 필터용 값입니다. 확실하지 않으면 `null`.
- `age_max_months`: 필터용 값입니다. 확실하지 않으면 `null`.
- `guardian_required`: 필터용 값입니다. `true`, `false`, `null` 중 하나입니다.
- `price_type`: `free`, `paid`, `null`. 확실하지 않으면 `null`.
- `price_text`: 원문 가격 표시입니다.
- `reservation_required`: `true`, `false`, `null` 중 하나입니다.
- `reservation_status`: 예약 가능 상태입니다. MVP에서는 실시간 상태를 책임지지 않으므로 기본적으로 `unknown` 또는 `null`을 사용하고, 원문에서 명확한 마감 정보를 확인할 수 있을 때만 확장합니다.
- `indoor`: `true`, `false`, `null` 중 하나입니다.
- `stroller_friendly`: `true`, `false`, `null` 중 하나입니다.
- `nursing_room`: `true`, `false`, `null` 중 하나입니다.
- `parking`: `true`, `false`, `null` 중 하나입니다.
- `tags`: 육아초보 아빠가 빠르게 결정할 수 있게 돕는 표시 태그입니다. 필터 확정값과 섞지 않습니다.
- `summary`: 원문 설명 또는 Babyroo용 짧은 요약입니다.
- `source`: 필수. 수집 출처 식별자입니다.
- `source_url`: 필수. 원문 또는 예약 페이지 URL입니다.
- `source_event_id`: 출처에서 제공하는 식별자가 없으면 `null`.
- `last_checked_at`: 필수. 마지막 확인 날짜입니다.

## 노출 최소 기준

정적 웹에 노출되는 행사는 최소한 아래 값을 가져야 합니다.

- `title`
- `starts_at`
- `region` 또는 `address`
- `source`
- `source_url`
- `last_checked_at`

월령, 가격, 예약 여부, 편의 정보처럼 필터에 쓰이는 값은 추측하지 않습니다. 확실하지 않으면 `null`로 두고, 표시 가능한 원문은 `price_text`, `summary`, `tags`에 남깁니다.

## 정규화 원칙

- 필터용 값은 보수적으로 정규화합니다.
- "주차 불가", "예약 없이 참여 가능", "보호자 동반 불필요" 같은 부정 표현을 먼저 처리합니다.
- `true`는 원문 근거가 있을 때만 사용합니다.
- `false`는 원문에 불가/불필요/없음이 명확할 때만 사용합니다.
- 원문이 애매하면 `null`을 사용합니다.
- 날짜와 URL은 규칙 기반으로 처리합니다.
- 월령, 카테고리, 외출 결정 태그, 요약은 규칙 기반으로 먼저 처리하고 필요할 때 LLM 보조를 사용합니다.
- LLM을 사용할 경우 필드별 `confidence`와 `evidence`를 중간 산출물에 저장합니다.

## publish 제외 기준

`public/events.json`에는 사용자에게 바로 보여줄 수 있는 행사만 포함합니다.

- `ends_at`이 오늘보다 이전이면 제외합니다.
- 노출 최소 기준을 만족하지 못하면 제외합니다.
- 같은 행사가 여러 출처에 있으면 우선은 모두 보존하되, `title`, `starts_at`, `venue_name` 또는 `address`가 같은 항목을 중복 후보로 표시합니다.
- 이후 중복 병합이 필요해지면 `duplicate_group_id` 같은 내부 필드를 추가합니다.

`age_min_months`, `age_max_months`, `category`가 `null`인 행사는 공개 JSON에는 남길 수 있습니다. 다만 추천 상위 후보 자격은 `docs/recommendation_policy.md`에서 별도로 제한합니다.

## 원문과 근거 보존

문제가 생겼을 때 추적할 수 있도록 `data/raw/`와 `data/normalized/`의 역할을 분리합니다.

- `data/raw/`: 출처에서 확실히 가져온 값과 원문 일부를 저장합니다.
- `data/normalized/`: Babyroo 공통 필드, 정규화 근거, 신뢰도를 저장합니다.
- `public/`: 웹에 필요한 최종 필드만 저장합니다.

공개 JSON은 작고 안정적으로 유지하고, 디버깅용 근거는 중간 산출물에 남깁니다.

LLM의 `confidence`, `evidence`, 원문 일부, 파싱 실패 이유는 `public/events.json`에 넣지 않습니다. 공개 JSON은 사용자 경험에 필요한 안정 필드만 담는 계약으로 유지합니다.

## 초기 수집 후보

첫 번째 실제 collector는 HTML 구조가 비교적 안정적이고 공공성이 높은 곳부터 붙이는 것이 좋습니다.

- 서울시 문화포털 행사
- 서울특별시 육아종합지원센터
- 경기육아종합지원센터
- 구청 문화행사 페이지 중 영유아 행사가 꾸준한 곳
