# Babyroo Backend Feature Plan

This document lists the backend features Babyroo needs as it moves from local JSON and local storage to a real server-backed product.

## 1. MVP Backend Scope

The first backend should make the current mobile app state persistent and prepare the product for paid recommendations, without trying to solve every future data problem at once.

### 1.1 Authentication

- Verify Google login tokens from the mobile app.
- Create or update a Babyroo user account on first login.
- Issue app sessions or API tokens.
- Support logout from the client.
- Support account deletion.

### 1.2 User Profile

- Store parent user profile.
- Store default region such as `Seoul`, `Gyeonggi`, or another broad area.
- Store children.
- Store each child's name and birthdate or month age.
- Track which children are selected for recommendation.
- Store lightweight preference defaults for recommendation flows.

### 1.3 Events API

- Return published events to the mobile app.
- Return a single event detail by ID.
- Support title search.
- Support filters for:
  - region
  - locality
  - date range
  - child age/month range
  - free/paid
  - indoor/outdoor
  - reservation requirement/status
- Sort by newest added first using the existing event sequence policy.
- Preserve `source_url`, `source`, and `last_checked_at`.

### 1.4 Saved Events

- Save an event for the current user.
- Unsave an event.
- List saved events.
- Keep saved state available when rendering event lists and detail screens.

### 1.5 Recommendation Sessions

- Create a `RecommendationSession` when the user finishes the recommendation questions.
- Store structured question answers.
- Store selected children and profile context used for the session.
- Return top recommendation event IDs.
- Store recommendation reasons and warnings.
- List previous recommendation sessions.
- Allow the user to reopen a past recommendation result.

### 1.6 Credits And Usage

- Track available recommendation credits per user.
- Charge one credit when a recommendation session is created.
- Prevent recommendation creation when the user has no credits.
- Store credit usage history.
- Leave payment integration as a later step unless needed immediately.

## 2. Admin And Data Operations

The backend should eventually replace the current static admin workflow with a proper review and publishing flow.

### 2.1 Event Management

- Create event candidates.
- Edit normalized event fields.
- Publish or unpublish events.
- Mark events as duplicates.
- Flag missing or low-confidence fields.
- Keep raw source references for review.
- Track reviewer edits.

### 2.2 Crawler Job Management

- Run crawler jobs by source.
- Store raw crawler output.
- Normalize raw data into the Babyroo event schema.
- Store job status, started time, finished time, and errors.
- Publish validated events to the public API.

### 2.3 Data Quality Gates

- Exclude expired events from published results.
- Require `source_url` before publishing.
- Flag missing age range.
- Flag missing category.
- Detect likely duplicate events.
- Track `last_checked_at` for stale data review.

## 3. Later Backend Features

These are valuable, but they should not block the first server-backed app version.

- LLM-assisted event normalization.
- LLM-assisted recommendation ranking and reason generation.
- Payment integration for buying recommendation credits.
- Push notifications for saved events and upcoming recommendations.
- Weather-aware recommendation.
- Location-distance ranking.
- Reservation availability checking.
- Personalized ranking based on saved, ignored, clicked, and booked events.
- Family sharing with multiple parent accounts.
- Analytics funnel tracking from browse to detail to save to source click.

## 4. Suggested First Implementation Slice

Build the backend in this order:

1. Events API backed by the current normalized event schema.
2. Google-authenticated users.
3. Children and user profile persistence.
4. Saved events.
5. Recommendation session persistence with the existing rules-based recommender.
6. Recommendation credit tracking.

This gives the mobile app a real backend while keeping the recommendation logic compatible with the current client-side behavior.

