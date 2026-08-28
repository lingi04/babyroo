# Babyroo Admin v1 Plan

이 문서는 Babyroo 어드민 v1을 구현하기 위한 제품/기술 결정 사항을 정리합니다.

어드민 v1의 목적은 이벤트 데이터를 안전하게 검토하고 수정한 뒤, 앱에 노출할 이벤트만 명시적으로 공개하는 것입니다.

## 1. 목표

Babyroo 어드민 v1은 인증된 관리자만 접근할 수 있는 이벤트 관리 도구입니다.

관리자는 다음 작업을 할 수 있어야 합니다.

- 이벤트 목록 조회
- 이벤트 생성
- 이벤트 수정
- 이벤트 공개
- 이벤트 숨김
- 이벤트 보관
- 이벤트 이미지 업로드

Babyroo 앱과 추천 기능은 공개 상태인 이벤트만 사용합니다.

## 2. v1 범위

포함합니다.

- Google social login 기반 어드민 로그인
- 어드민 전용 DB 테이블
- 어드민 전용 API
- 이벤트 CRUD
- 이벤트 공개 상태 관리
- 이벤트 이미지 업로드
- 이벤트 변경 감사 로그 기록
- 공개 API에서 `published` 이벤트만 반환
- 추천용 이벤트 조회에서 `published` 이벤트만 사용

포함하지 않습니다.

- 일반 사용자 관리
- 아이 프로필 관리
- 추천 세션 관리
- 크레딧/결제 관리
- 어드민 사용자 관리 UI
- 크롤러 실행 UI
- 크롤러 raw payload 조회
- 이벤트 복제 기능
- audit log 화면
- 어드민 내 이미지 생성 기능
- 다국어 필드

크롤러가 가져온 이벤트를 어떻게 검토/병합할지는 별도 문서에서 다룹니다.

## 3. 인증과 인가

어드민 페이지는 Google social login을 사용합니다.

로그인 흐름은 다음과 같습니다.

1. 어드민 웹에서 Google Sign-In for Web 실행
2. Google ID token을 `POST /admin/auth/google`로 전송
3. 서버가 Google ID token을 검증
4. 서버가 검증된 email로 `AdminUser`를 조회
5. `AdminUser.active = true`인 경우에만 로그인 성공
6. 서버가 Babyroo 자체 signed JWT를 발급
7. 어드민 API는 이 JWT를 검증하고 admin 권한을 확인

일반 Babyroo 앱 로그인도 더 이상 `dev.*` bearer token을 사용하지 않습니다.

최종 원칙:

- Google ID token은 로그인 시점의 신원 확인용입니다.
- API 호출에는 Babyroo 서버가 발급한 signed JWT를 사용합니다.
- `dev.*` token은 제거합니다.
- 어드민 API는 일반 사용자 token으로 접근할 수 없습니다.

## 4. AdminUser 모델

어드민 사용자는 DB에 직접 수동으로 등록합니다.

v1에서는 어드민 권한 레벨을 나누지 않습니다. 권한은 단순히 active admin 여부만 봅니다.

권장 Prisma 모델:

```prisma
model AdminUser {
  id          String   @id
  googleSub   String?  @unique @map("google_sub")
  email       String   @unique
  displayName String?  @map("display_name")
  active      Boolean  @default(true)
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  eventAuditLogs EventAuditLog[]

  @@map("admin_users")
}
```

초기 등록은 email만으로 충분합니다.

첫 로그인 시:

- email로 `AdminUser`를 찾습니다.
- `googleSub`가 비어 있으면 검증된 Google `sub`로 채웁니다.
- `googleSub`가 이미 있으면 현재 Google `sub`와 일치해야 합니다.
- `active = false`이면 로그인 실패입니다.

## 5. Event 모델 변경

이벤트에는 공개 상태와 어드민 수정 시각이 필요합니다.

권장 추가 필드:

```prisma
publicationStatus String    @default("draft") @map("publication_status")
adminUpdatedAt    DateTime? @map("admin_updated_at")
```

`publicationStatus` 값:

- `draft`: 아직 검토 전
- `published`: 검토 완료 및 앱 노출
- `hidden`: 임시 숨김
- `archived`: 폐기 또는 보관

수동 생성 이벤트는 기본적으로 `draft`입니다.

현재 `csvSequence`는 필수 unique 값이지만, 수동 이벤트에는 CSV 순번이 없습니다. 따라서 nullable로 변경합니다.

```prisma
csvSequence Int? @unique @map("csv_sequence")
```

이벤트 `id`는 서버가 자동 생성합니다.

수동 생성 이벤트 기본값:

- `source = manual`
- `sourceEventId = null`
- `publicationStatus = draft`
- `lastCheckedAt = today`

## 6. 공개 이벤트 정책

사용자-facing API와 추천 기능은 `published` 이벤트만 사용합니다.

대상:

- `GET /events`
- `GET /events/:id`
- 추천 엔진의 이벤트 조회
- 저장된 이벤트 목록 표시

`draft`, `hidden`, `archived` 이벤트는 앱에 노출하지 않습니다.

만료된 이벤트의 `publicationStatus`를 자동으로 변경하지는 않습니다.

v1에서는:

- 공개 여부는 `publicationStatus`가 결정합니다.
- 시간 관련 노출 여부는 `startsAt`, `endsAt` 필터가 결정합니다.
- 자동 보관/숨김 job은 만들지 않습니다.

## 7. 감사 로그

이벤트 변경은 audit log로 기록합니다.

v1에서는 화면에 보여주지 않고 DB에만 기록합니다.

권장 Prisma 모델:

```prisma
model EventAuditLog {
  id          String   @id
  eventId     String   @map("event_id")
  adminUserId String   @map("admin_user_id")
  action      String
  before      Json?
  after       Json?
  createdAt   DateTime @default(now()) @map("created_at")

  adminUser AdminUser @relation(fields: [adminUserId], references: [id])
  event      Event     @relation(fields: [eventId], references: [id])

  @@index([eventId, createdAt])
  @@index([adminUserId, createdAt])
  @@map("event_audit_logs")
}
```

기록할 action:

- `create`
- `update`
- `publish`
- `hide`
- `archive`

## 8. Null과 빈 값 규칙

`null`과 empty value는 전역적으로 같은 의미로 보지 않습니다.

필드 타입별 규칙:

- optional text: 빈 문자열은 저장 전에 `null`로 정규화
- required text: `null`과 빈 문자열 모두 거부
- boolean: `null`, `true`, `false` 3-state 유지
- array: `null` 대신 `[]` 사용
- date: 빈 문자열 저장 금지, optional이면 `null`
- publicationStatus: nullable 금지, 기본값 `draft`

boolean 3-state 의미:

- `null`: 알 수 없음
- `true`: 예
- `false`: 아니오

대상 boolean 필드:

- `indoor`
- `reservationRequired`
- `guardianRequired`
- `strollerFriendly`
- `nursingRoom`
- `parking`

## 9. 이벤트 필드

v1 editor는 앱 표시, 필터, 추천에 영향을 주는 필드를 지원합니다.

Basic:

- title
- summary
- category
- tags
- publicationStatus

Venue:

- venueName
- venueDetail
- address
- region
- locality
- imageUrl
- sourceUrl

Schedule:

- startsAt
- endsAt
- lastCheckedAt

Child / Family Fit:

- ageMinMonths
- ageMaxMonths
- guardianRequired
- strollerFriendly
- nursingRoom
- parking
- indoor

Price / Reservation:

- priceType
- priceText
- reservationRequired
- reservationStatus

Source:

- source
- sourceEventId

`csvSequence`는 어드민에서 직접 수정하지 않습니다.

## 10. Validation

draft 저장은 느슨하게 허용합니다.

draft 저장 필수값:

- title
- sourceUrl

publish 필수값:

- title
- summary
- category
- venueName
- region
- locality
- startsAt
- endsAt
- source
- sourceUrl

publish 전에 권장하지만 필수는 아닌 값:

- ageMinMonths
- ageMaxMonths
- priceType
- reservationStatus
- address
- tags
- imageUrl

종료일은 시작일보다 빠를 수 없습니다.

필드 단위 validation 에러와 상단 요약 에러를 모두 표시합니다.

## 11. 선택지 값

아래 값들은 자유 입력이 아니라 선택지로 제한합니다.

publicationStatus:

- `draft`
- `published`
- `hidden`
- `archived`

priceType:

- `free`
- `paid`
- `unknown`

reservationStatus:

- `unknown`
- `available`
- `limited`
- `closed`

category:

- `experience`
- `play_space`
- `camp`
- `exhibition`
- `performance`
- `class`
- `festival`
- `other`

tags는 자유 입력을 허용하되 기존 태그 자동완성을 제공합니다.

저장 시:

- 앞뒤 공백 제거
- 빈 태그 제거
- 중복 제거
- `null` 대신 `[]` 저장

## 12. 이미지 업로드

이미지가 없는 이벤트가 많으므로 v1에 이미지 업로드를 포함합니다.

DB에는 binary/blob을 저장하지 않습니다.

권장 구조:

- 이미지 파일: Vercel Blob 또는 S3/R2 같은 object storage
- DB: `imageUrl`

v1 추천은 Vercel Blob입니다.

API:

```text
POST /admin/uploads/event-image
```

응답:

```json
{
  "imageUrl": "https://..."
}
```

제한:

- 허용 타입: `image/jpeg`, `image/png`, `image/webp`
- 최대 용량: 5MB
- 권장 비율: 4:3 또는 1:1
- 저장 경로: `event-images/{eventId-or-tempId}/{uuid}.{ext}`

UI:

- 이미지 URL 직접 입력
- 이미지 업로드
- 현재 이미지 미리보기
- 업로드 성공 시 `imageUrl` 자동 채움
- 이미지 교체 지원

v1에서는 기존 이미지 자동 삭제는 하지 않습니다.

어드민 안에서 이미지 생성 기능은 만들지 않습니다. 이미지는 외부 도구에서 생성한 뒤 업로드합니다.

## 13. API 설계

어드민 API는 public API와 분리합니다.

```text
POST   /admin/auth/google
GET    /admin/events
POST   /admin/events
GET    /admin/events/:id
PATCH  /admin/events/:id
POST   /admin/events/:id/publish
POST   /admin/events/:id/hide
POST   /admin/events/:id/archive
POST   /admin/uploads/event-image
```

기존 public API:

```text
GET /events
GET /events/:id
```

public API는 `published` 이벤트만 반환합니다.

## 14. Admin Event List

어드민 이벤트 목록은 테이블 UI를 사용합니다.

기본 목록:

- `publicationStatus = draft`
- `createdAt desc`
- 최근 추가된 이벤트부터 표시

페이지네이션:

- `limit = 50`
- `offset = 0, 50, 100...`
- UI는 이전/다음 방식

검색 대상:

- title
- summary
- venueName
- venueDetail
- address
- region
- locality
- source
- sourceEventId
- tags

필터:

- publicationStatus
- source
- category
- region/locality
- reservationStatus
- 이벤트 시작일 범위
- 이벤트 종료일 범위
- 생성일 범위

추천 컬럼:

- 상태
- 제목
- 장소
- 지역
- 기간
- 카테고리
- 소스
- 예약상태
- 최근수정
- 액션

## 15. Admin Event Editor

이벤트 수정은 상세 수정 페이지에서 합니다.

경로:

```text
/admin/events
/admin/events/new
/admin/events/:id/edit
```

상단 액션:

- 원본 열기
- 임시저장
- 공개
- 숨김
- 보관
- 목록으로

저장과 공개는 분리합니다.

액션 동작:

- 임시저장: 현재 수정 페이지에 머무름
- 공개: publish validation 후 draft 목록으로 이동
- 숨김: 확인 모달 후 현재 페이지에 머무름
- 보관: 확인 모달 후 목록으로 이동

확인 모달:

- Publish: 없음
- Hide: 있음
- Archive: 있음

## 16. Frontend 위치와 배포

어드민 프론트엔드는 기존 `admin/` 경로를 Vite + React + TypeScript 앱으로 재구성합니다.

권장 구조:

```text
admin/
  package.json
  index.html
  vite.config.ts
  tsconfig.json
  src/
    main.tsx
    App.tsx
    api/
      adminApi.ts
      auth.ts
    pages/
      LoginPage.tsx
      EventListPage.tsx
      EventEditorPage.tsx
    components/
      EventForm.tsx
      StatusBadge.tsx
    styles/
      globals.css
```

어드민 UI 언어는 한국어입니다.

디자인은 조용한 운영툴 느낌으로 만듭니다.

방향:

- 상단 또는 좌측 네비게이션
- 상단 필터바
- 밀도 있는 테이블
- 상태 배지
- 명확한 액션 버튼
- 넓은 상세 수정 폼
- Babyroo 브랜드 색은 제한적으로 사용

배포는 API와 분리된 정적 웹앱으로 합니다.

예상 배포:

```text
admin frontend: https://babyroo-admin.vercel.app
api backend:     https://babyroo-api.vercel.app/api
public app:      https://babyroo.vercel.app
```

local dev:

```text
admin: http://localhost:5173
api:   http://localhost:3000/api
```

admin app env:

```text
VITE_BABYROO_API_BASE_URL=http://localhost:3000/api
```

서버 CORS는 `http://localhost:5173`을 허용해야 합니다.

Google OAuth / Google Identity Services에는 local admin origin과 production admin origin을 등록해야 합니다.

## 17. 구현 순서

1. Google ID token 검증과 signed JWT 발급 구조 구현
2. `dev.*` token 제거
3. `AdminUser`, `EventAuditLog`, `publicationStatus`, `adminUpdatedAt`, nullable `csvSequence` migration 추가
4. public events API가 `published` 이벤트만 반환하도록 변경
5. admin auth endpoint 추가
6. admin events CRUD API 추가
7. event status action API 추가
8. audit log 기록 추가
9. event image upload API 추가
10. `admin/`을 Vite + React + TypeScript 앱으로 전환
11. Google Sign-In 기반 LoginPage 구현
12. EventListPage 테이블 구현
13. EventEditorPage와 EventForm 구현
14. validation, publish/hide/archive 흐름 구현
15. local dev에서 admin `5173`과 API `3000` 연동 확인

