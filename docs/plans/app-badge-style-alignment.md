# Align app controls with the Explore badges

The user chose white panels with orange accents and asked that all discussed
areas follow the latest Explore category badge style. The user approved the
revised mockup with circular header controls and bright orange primary actions.

The user preferred the proposed header buttons and found the first panel
proposal unconvincing. The revised mockup retains those buttons and uses the
changes below for the rest of the review.

## Requirements

- Style the shared mail and settings buttons as white circles with a
  thin neutral border and matching charcoal outline icons. Apply this treatment
  wherever the shared header actions appear, including the compact Explore header.
- Use a white Explore filter panel with a thin neutral border and quiet dividers.
  Apply the category badge's dark orange border and text to active child and
  filter chips. Place the expanded controls on a lightly tinted inset, show the
  applied filters in the header summary, and label the edit action 필터 편집.
- Use the same visual language in the Recommendation setup, question, and
  confirmation states. Place the child criteria and confirmation answers on lightly
  tinted insets. Add chevrons to editable rows. Give question options a radio
  indicator and give the selected answer the orange outline and a light tint.
  Use bright orange fill (`#FA6A2E`) with charcoal labels for the primary
  advance and submit buttons.
- Scope the Explore changes to the on-tab filter area, including its expanded
  and collapsed states. Preserve category styling, recommendation history,
  navigation, selections, validation, and submission behavior.

## Implementation

1. Reuse the existing theme tokens for white surfaces, neutral outlines,
   `colors.coralText` (`#A74619`), and 12-unit control corners. Use a slightly
   larger radius for the panels so their child controls are visually distinct.
2. Apply the shared header action styling and matching outline artwork. Keep
   accessible names and ensure each action has a usable touch target in both
   header layouts.
3. Style Explore's shell, summary toggle, and on-tab chips. Keep selection
   semantics and let the existing measured-header layout account for the
   updated sizes when the panel expands or collapses.
4. Style the three Recommendation states, including editable confirmation
   rows and pressed, selected, and disabled controls. Check shared components
   for use outside this flow before changing their styles.

## Acceptance and verification

- At mobile size, gear and envelope have consistent stroke weight and are
  recognizable as settings and feedback. Filter and answer selections share
  the badges' visual treatment, and the main Recommendation action is easy to
  distinguish.
- Verify the expanded and collapsed Explore headers, inactive and active filters,
  and the Recommendation initial, question, and confirmation screens at a
  standard width, a narrow width, and enlarged text. Check wrapping, focus,
  touch areas, and the absence of clipping during header transitions.
- Capture the matching states on a running app and compare with the approved
  preview. If native rendering is blocked, provide a static preview and leave
  running-app visual approval pending.
- Run TypeScript, lint, and the relevant app tests. Compare any failures with
  the baseline before attributing them to the change.

## Verification result

- TypeScript, app ESLint, and Git whitespace checks passed.
- Updated the Explore schedule test for the approved filter action label. The
  full app suite reported 56 passes and the same 12 failures as the baseline.
- Reviewed the static PNG comparison for the different surfaces, control
  shapes, and selected states. Native visual verification at standard and
  enlarged text sizes remains pending because the available native tooling
  cannot start a preview in this environment.
