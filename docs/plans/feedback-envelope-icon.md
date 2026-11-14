# Feedback envelope icon

## Requirements

Replace the feedback envelope glyph with a crisp outline icon in the Recommendation and Explore headers, including compact Explore.

## Acceptance criteria

- The icon has a rounded rectangular outline and a folded flap, centered beside the Settings gear.
- Use a 2-point stroke for the outline and flap to bring their visual weight closer to the gear.
- It renders consistently without relying on a platform font glyph.
- The button retains its size, accessible label, and email action in every header.

## Implementation

Replace the glyph in the shared `HeaderActions` component with a small decorative icon drawn with React Native views. Use the existing foreground color and button styles.

## Verification

- Run the focused feedback test, TypeScript, and lint checks.
- Inspect the standard and compact header on a simulator or device if available.

The icon is implemented in the shared header. The focused feedback test,
TypeScript, and lint passed. The rendered layout still needs device verification.
