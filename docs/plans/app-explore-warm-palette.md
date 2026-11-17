# Warm the Explore tab palette

The user approved the Explore-only PNG comparison. Apply its soft peach filter
panel, white inset, and lighter warm results background in the Explore tab.

## Acceptance criteria

- The expanded and collapsed filter surfaces share the peach fill and border.
- The filter inset, result cards, category badges, and header buttons retain
  white surfaces. The area behind the result cards and the empty state uses the
  warm results background.
- The layout, filtering, header transitions, and Recommendation tab retain
  their current behavior.

## Implementation and verification

1. Add the approved palette values to the theme and apply them to the Explore
   results surface and filter panel styles.
2. Check the diff, run app lint and the TypeScript checker, and run the Explore
   filter tests. Review the approved composite and verify the running app when
   native tooling is available.

TypeScript, app ESLint, whitespace checks, and three targeted Explore filter
tests passed. The comparison is a static composite. Running-app visual
verification remains pending because native preview tooling is unavailable.
