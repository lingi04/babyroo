# Babyroo Design System

Babyroo uses a Mom Clock-inspired visual system: near-white warm background, black editorial typography, white content blocks, stronger card shadows, and orange action color. The goal is a confident consumer app, not a soft toy-like parenting app.

## Palette

- Background: `#FFFFFE`
  - Use for every root screen. Keep it almost white so content feels light, and separate cards with shadow instead of darker page color.
- Foreground/Text: `#000000`
  - Use for primary titles, selected controls, dark cards, and bottom navigation emphasis.
- Surface: `#FFFFFF`
  - Use for event cards, forms, sheets, and repeated content blocks.
- Soft Surface: `#F3EDE8`
  - Use for secondary buttons, search fields, subtle panels, and inactive segmented controls.
- Brand/CTA: `#FA6A2E`
  - Use only for primary actions, selected controls, and small emphasis.
- Blue Accent: `#2092F1`
  - Use sparingly for informational states or visual variety in media placeholders.

Avoid pastel-only screens. Every screen should have a clear black/orange/white hierarchy.

## Typography

- Display: 34/36, weight 900
  - Top-level screen messages and product moments.
- Title: 24/28, weight 900
  - Screen titles and major cards.
- Section: 20/24, weight 900
  - List headers and grouped content titles.
- Body: 15/21, weight 600
  - Descriptive copy and supporting text.
- Caption: 12/16, weight 800
  - Labels, metadata, badges.

Rules:
- Headlines are short and direct.
- Body copy should be one or two lines when possible.
- Do not use negative letter spacing in React Native styles.

## Layout

- Root screens use `colors.background`.
- Horizontal screen padding is `spacing.xl`.
- First screen content should start with a masthead, not a generic app-bar plus card.
- Mastheads use oversized, direct copy and one small utility action.
- Operational controls sit in their own block immediately below the masthead.
- Primary content blocks use 20px radius.
- Bottom sheets and major modal panels use 24px+ top radius.
- Repeated cards should not sit inside decorative cards.
- Lists should have clear section headers, then cards.
- Search/filter controls sit close to list content, not inside a giant hero.

## Components

- Primary button: orange filled pill, black or white text depending on contrast.
- Secondary button: cream filled pill.
- Selected chip: black filled pill with white text.
- Unselected chip: white or cream with subtle black border.
- Event card: white block, 20px radius, image-first when browsing; compact horizontal only in recommendation/history contexts.
- Card elevation: use shared `shadows.card` for normal cards and `shadows.elevated` for the primary action block. Card separation should come from shadow/elevation, not heavy borders or tinted backgrounds.
- Navigation: white surface with black text; active state uses orange/black, not pale tint alone.

## Applying To Screens

For every new screen:

1. Start with the near-white warm background.
2. Add one masthead that states the job of the screen.
3. Put the primary workflow directly under the masthead.
4. Put interactive controls in pill or segmented shapes.
5. Use white cards only for real content items.
6. Use orange for the action the user should take next.
7. Keep decorative color secondary to actual venue/event imagery.

## Screen Patterns

- Home: editorial masthead first, then one dark action block for recommendation.
- Explore: orange masthead first, then search/type controls, then criteria, then result list.
- Recommendation history: compact list cards; no large hero card per history item.
- Event detail: image hero first, then white information sheet.
