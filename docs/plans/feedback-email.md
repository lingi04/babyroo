# Feedback by email

## Requirements

- Add an envelope button immediately left of the Settings gear in the Recommendation and Explore headers, including Explore's compact header.
- Make the button available to signed-out users wherever those headers are shown.
- Open an email draft addressed to `hans.tyranos@gmail.com` with the subject `베이비루 앱 의견`.
- Use `의견 보내기` as the accessibility label. Show the email address if the email app cannot open. Keep visible copy limited to what users need to act.

## Acceptance criteria

- The envelope and gear each have their own tap target. The gear still opens Settings.
- Tapping the envelope opens a draft without sending it or including profile data.
- If opening email fails, the user can see the feedback address.
- The compact header remains usable on narrow screens.

## Implementation

1. Reuse the existing header button styles and put the feedback action beside each gear.
2. Use React Native's existing `Linking` and `Alert` APIs to open the draft and handle failure.

## Verification

- Check that each header opens the same draft and that a failed open displays the recipient.
- Run focused app tests and TypeScript checks. Inspect the normal and compact headers in a simulator and share a screenshot if available.

## Status

Implemented. The focused test verifies the draft URL in all three headers and the fallback alert. TypeScript and lint checks passed. The full suite reported the same 12 failing tests seen before this change. Simulator layout and mail handoff still need device verification.
