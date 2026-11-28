# Android permanent venue details

Status: Date display implemented and verified locally. Missing icons on the affected installation remain unreproduced.

## Scope and acceptance

- When the stored start and end dates are exactly `1970-01-01` and `9999-12-31`, show the location without the synthetic period in event details. Apply this to every venue category. Real dates continue to display, including a range with only one of those boundary values.
- Preserve the existing four icons and Korean labels for age, price, reservation, and venue. Verify the reported absence before changing the icon source, layout, or packaging. Use the existing artwork if an icon fix is needed.
- The title metadata remains easy to scan with and without a date. The four icons have consistent weight, size, alignment, and contrast. Keep the labels readable at narrow widths and large text sizes.

## Implementation and verification

1. Main agent compares the current event detail and proposed layout at the same native viewport. Check the icon markup, assets, and packaged Android resources for the reported regression.
2. Main agent applies the approved date display rule in the shared event detail component. Add focused coverage for the permanent and real date ranges. Prefer an icon fix grounded in reproduction evidence.
3. Independent verification agent checks the diff, focused test output, and native screenshots. Record any remaining differences between the local Android build and the affected installation.

## Model usage

| Workflow stage | Agent | Plugin / skill used | Model used | Reasoning level | Evidence |
| --- | --- | --- | --- | --- | --- |
| Plan | /root | grill-with-docs, Product Design audit | gpt-6.2-sol | Unknown | Runtime model metadata. User approved exact-pair suppression across categories. Checked the permanent venue definition, app code, and release assets. |
| Review the plan | /root/detail_plan_review | None | Unknown | Unknown | Confirmed exact comparison, one-sided date cases, and existing icon rendering and assets. |
| Implement | /root | None | gpt-6.2-sol | Unknown | Runtime model metadata. Updated the shared event detail date display and tests. |
| Verify | /root/verify_detail_dates | None | Unknown | Unknown | Independent diff check and 15 passing event-detail tests. Confirmed the missing icons remain unreproduced on the local fixture. |
| Verify | /root | Product Design audit | gpt-6.2-sol | Unknown | Runtime model metadata. Typecheck passed. Same-width Pixel fixture captures showed the date difference and all four icons. The local AAB includes each icon at mdpi, xhdpi, and xxhdpi. |
