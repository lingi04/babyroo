# Recommendation history redesign

The user approved the side-by-side proposal with today's date, planned visit dates, and a past-date badge, and authorized implementation.

## Acceptance criteria

- Show today's local date alongside 추천 기록. Refresh it at midnight and when the app returns to the foreground.
- Show an outing title, the planned visit window, and the result count and preview in compact rows. Keep the full criteria and request timestamp in the detail view.
- Mark a completed recommendation 지난 일정 starting the day after the last day of the visit window. Past entries still open and show an explanation in detail. Flexible and missing dates have no badge.
- Keep loading and failed states understandable. Keep the credit history link and remove the usage summary from the request card.
- Check the current and past rows in context for readability, hierarchy, and clear tap affordances at mobile size.

## Implementation and verification

- Reuse the app's recommendation visit-window calculation with the original session timestamp. This supports existing records with relative visit preferences and requires no data migration. Use the device's local calendar, since stored sessions do not include the original timezone.
- Group history entries, add state-specific copy and the past-date treatment, and keep the existing detail navigation.
- Verify date boundaries and older records with focused tests. Run the app type checker, lint, and test suite. Check the rendered screen or report the visual verification gap.

## Verification

- TypeScript and app lint passed. The four visit-date tests passed.
- The full app suite had 56 passing tests. The same 12 tests failed against the pre-change app screen.
- A static preview is available. Visual approval is pending a check in the running app.
