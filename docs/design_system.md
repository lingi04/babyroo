# Babyroo Design System

This system adapts common patterns from Product Hunt's current top launch lists into a practical product surface for Babyroo: dense discovery lists, scannable metadata, compact cards, visible ranking/status, and low-friction primary actions.

Reference sample checked on 2026-07-12 from Product Hunt's homepage:

- Today's launches: Second Brain for AI v2, JustVibe, ServiceBeard, FetchSandbox, Miora.
- Yesterday's top products: Effects SDK, Cloudflare Drop, San Fran Sim, ChatGPT Work, Fin.
- Repeated patterns: product thumbnail, concise title, one-line value proposition, category tags, engagement count, rank or status, and a single obvious action.

## Design Principles

1. **Scan first, inspect second.** Event cards should let a parent quickly answer: age fit, date, region, reservation state, indoor/outdoor, and price.
2. **Warm utility.** Babyroo should feel trustworthy and helpful, not cute for cuteness' sake. Use soft color accents, clear hierarchy, and calm density.
3. **Evidence over decoration.** Use real event thumbnails, venue names, source links, dates, and tags. Decorative graphics should not compete with event details.
4. **Compact confidence.** Product Hunt's lists work because every row has a predictable rhythm. Babyroo lists should use the same rhythm: image, title, summary, tags, facts, action.
5. **One primary action per view.** Make the next action obvious: search, save candidate, view detail, open source, or reload.

## Visual Tokens

### Color

Use a neutral base with a fresh teal primary and limited supporting accents.

| Token | Value | Usage |
| --- | --- | --- |
| `--color-bg` | `#f7f8fb` | App background |
| `--color-surface` | `#ffffff` | Panels, dialogs, cards |
| `--color-surface-soft` | `#f1f5f4` | Selected rows, quiet fills |
| `--color-text` | `#18212f` | Primary text |
| `--color-muted` | `#667085` | Metadata and helper text |
| `--color-border` | `#d8dee8` | Dividers, controls |
| `--color-primary` | `#0b7285` | Primary buttons, selected state |
| `--color-primary-strong` | `#075966` | Hover and active state |
| `--color-primary-soft` | `#e6f4f1` | Selected tab, connected state |
| `--color-accent-blue` | `#3538cd` | Informational tags |
| `--color-accent-blue-soft` | `#eef4ff` | Informational tag fill |
| `--color-success` | `#087443` | Available/connected |
| `--color-warning` | `#b54708` | Limited reservation |
| `--color-danger` | `#b42318` | Errors/closed reservation |

Avoid a one-hue interface. Teal is the product color, blue is for category tags, green/orange/red are semantic states only.

### Type

Use the system font stack for speed and Korean readability:

```css
font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```

| Token | Size | Weight | Usage |
| --- | --- | --- | --- |
| `--text-xs` | `11px` | `700` | Fact labels, table labels |
| `--text-sm` | `12px` | `700` | Tags, status pills |
| `--text-base` | `14px` | `400` | Body copy, metadata |
| `--text-strong` | `15px` | `700` | Card titles |
| `--text-section` | `18px` | `700` | Panel headings |
| `--text-page` | `26px` | `800` | Page titles |

Keep letter spacing at `0`. Use uppercase only for very short labels like "Babyroo Admin" or fact headings.

### Spacing

| Token | Value | Usage |
| --- | --- | --- |
| `--space-1` | `4px` | Tight label gaps |
| `--space-2` | `6px` | Tag gaps |
| `--space-3` | `10px` | Control gaps |
| `--space-4` | `14px` | Card internal gaps |
| `--space-5` | `18px` | Panel rhythm |
| `--space-6` | `24px` | Page padding |
| `--space-7` | `32px` | Header padding |

### Radius and Shadow

| Token | Value | Usage |
| --- | --- | --- |
| `--radius-control` | `6px` | Inputs, buttons, thumbnails |
| `--radius-card` | `8px` | Cards, panels, dialogs |
| `--radius-pill` | `999px` | Tags, statuses |
| `--shadow-panel` | `0 10px 24px rgba(31, 35, 40, 0.08)` | Main panels |
| `--shadow-dialog` | `0 24px 64px rgba(31, 35, 40, 0.22)` | Dialogs |

Cards should stay at 8px or less. Reserve pill shapes for small metadata chips.

## Components

### Top Bar

Purpose: orient the user and expose page-level navigation.

- Left: eyebrow, page title.
- Right: segmented page tabs, site link.
- Background: white, bottom border.
- Mobile: stack title, tabs, and external link vertically.

### Segmented Tabs

Use for switching between peer views such as Instagram Discovery and Managed Events.

- Height: `36px`.
- Selected state: primary border, primary-soft background, primary-strong text.
- Do not use tabs for one-off actions.

### Panel

Use panels for major workflows: connection, search, candidate review, managed events.

- White background, 1px border, 8px radius, panel shadow.
- Header has title, short helper copy, and optional action.
- Panels should not be nested inside panels.

### Product/Event Card

Inspired by Product Hunt rows.

Structure:

1. Thumbnail.
2. Main content: title, source/date meta, summary.
3. Tags.
4. Facts: age, date, locality, reservation.
5. Side action or status.

Rules:

- Thumbnail is square on desktop, 16:9 or square on mobile depending on content.
- Title is one to two lines maximum.
- Summary is two to three lines maximum.
- Tags wrap, but keep only the most useful tags visible in cards.
- Full detail belongs in a dialog.

### Tag

Use tags for categories, source traits, and parent-facing filters.

- Default category tag: blue-soft fill, blue border/text.
- Quiet tag: neutral fill and muted text.
- Clickable tag: same visual style plus pointer and focus ring.
- Do not encode critical states only as color; keep readable text.

### Status Pill

Use for connection state and reservation state.

- `Available`: green.
- `Limited`: orange.
- `Closed`: red.
- `Unknown`: neutral.

Status text should be short and explicit: "Connected", "Limited", "Closed", "Unknown".

### Forms

Use compact labeled controls.

- Label above input.
- Min height: `40px`.
- Border: neutral by default, primary on focus.
- Search layouts can use grid columns on desktop and one column on mobile.
- Binary or mutually exclusive choices should use segmented controls or radio groups.

### Dialog

Use for event detail and image preview.

- Sticky header with title and close action.
- Width: `min(920px, calc(100vw - 32px))`.
- Backdrop: dark translucent neutral.
- Keep primary content near the top: thumbnail, facts, summary, source.

## Layout Patterns

### Discovery List

Use when the user is evaluating many possible items.

```text
[Thumbnail] [Title + summary + tags + facts] [Status/action]
```

This is the default for managed events and search results.

### Candidate Review

Use a tighter row when the item is already saved.

```text
[Title + source metadata] [Remove/Open/Export action]
```

### Empty State

Use plain text, not an illustration, unless the entire page is onboarding.

Examples:

- "No API results yet."
- "No saved candidates yet."
- "No events match these filters."

## Content Rules

- Titles should lead with the event/product name, not the source.
- Summaries should explain the value in one sentence before operational details.
- Parent-facing facts must be normalized: age range, dates, place, price, reservation.
- Use source names and source links for trust.
- Keep button labels action-oriented: "Search", "Reload CSV", "Open source", "Save candidate".

## Accessibility

- Every clickable card must also support keyboard focus.
- Focus rings use primary color with a soft halo.
- Images need meaningful alt text when rendered as `img`; decorative CSS backgrounds need adjacent text.
- Dialogs must close via the close button and backdrop click.
- Color contrast must meet WCAG AA for text and controls.

## CSS Token Starter

```css
:root {
  color-scheme: light;
  --color-bg: #f7f8fb;
  --color-surface: #ffffff;
  --color-surface-soft: #f1f5f4;
  --color-text: #18212f;
  --color-muted: #667085;
  --color-border: #d8dee8;
  --color-primary: #0b7285;
  --color-primary-strong: #075966;
  --color-primary-soft: #e6f4f1;
  --color-accent-blue: #3538cd;
  --color-accent-blue-soft: #eef4ff;
  --color-success: #087443;
  --color-warning: #b54708;
  --color-danger: #b42318;
  --radius-control: 6px;
  --radius-card: 8px;
  --radius-pill: 999px;
  --shadow-panel: 0 10px 24px rgba(31, 35, 40, 0.08);
  --shadow-dialog: 0 24px 64px rgba(31, 35, 40, 0.22);
}
```

## Application Checklist

- Header uses page title, tabs, and one external link.
- Main workflows are split into panels.
- Lists use Product Hunt-style rows: image, title, value prop, tags, facts, action/status.
- Detail views are dialogs, not separate dense pages.
- Real event imagery is preferred over decorative artwork.
- Mobile layouts collapse to one column without text overlap.
- Every repeated visual value uses a token.
