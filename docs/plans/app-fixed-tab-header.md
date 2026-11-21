# Fixed header during tab navigation

## Approved behavior

Latest spacing adjustment sets the recommendation header-to-intro-card gap to 8 dp, matching Explore's brand-to-category gap. Removed the recommendation ScrollView's extra 20 dp top padding and intro card's 16 dp top margin. The user's correction retains the original 16 dp list gap and adds a full-width 8 dp white strip directly beneath the filter inside the measured expanded header. Phone comparison remains pending.

Collapsed-header bottom white space also uses the same 8 dp constant, replacing its previous 12 dp allowance. The measured compact footprint is panel height plus 12 dp above and 8 dp below, including when larger text increases the panel height.

The user's final transition rule supersedes the earlier arrangements below. When Explore is fully at the top, the brand header stays stationary and only the middle panes slide. As soon as Explore scroll offset is positive, including partial collapse, the headers participate in the full-pane slide. Restoring offset zero restores content-only transitions.

Both complete panes stay mounted at constant height. A stationary brand header overlays their header area only in the fully expanded mode, and duplicate pane branding is excluded from touch/accessibility. This prevents any shell-height change after tab completion. Detail overlays suppress the stationary header. Recommendation retains its fixed header during vertical scrolling.

The real-phone screenshot revealed that absolute top=0 on the padded SafeAreaView placed the overlay into the status bar, leaving the pane header visible below it. The overlay and swipe viewport now share a normal flex tab-shell inside the safe area. Covered pane BrandHeaders also have opacity=0, preserving their layout height while removing visual duplication. Modal/detail overlays retain their previous outer layer. Three targeted checks, TypeScript and lint passed after this correction. Native rendering remains pending.

The user's latest instruction restores Explore's earlier behavior. Explore owns its expanded brand/category/filter header and its compact monogram/summary/actions header. Recommendation alone uses the fixed shell brand header. Bottom tab buttons stay stationary and update selection.

The user also confirmed that the complete brand header stays visible at its full height while recommendation content scrolls vertically. It retains the wordmark, mail and settings actions throughout scrolling.

For smooth transitions, the recommendation header now stays mounted inside its horizontal tab pane, above the vertical ScrollView. Both headers move with the horizontal animation instead of appearing or disappearing after its completion. The outer viewport height stays constant when activeTab changes; Explore retains its full/compact state. Recommendation's header remains fixed during vertical scrolling.

## Implementation

- Keep BrandHeader mounted inside the recommendation pane above its ScrollView, with 16 dp horizontal padding, 56 dp minimum height and the existing 8 dp bottom gap.
- Restore the expanded BrandHeader and compact monogram/mail/settings inside Explore, including its 160/92 dp fallback footprints, measured collapse and scroll-to-top action.
- Keep both panes mounted through the current swipe controller to preserve scroll and recommendation state. Keep detail/settings/filter overlays and safe-area handling in their existing shell layer.

## Verification

Check that one brand header and one mail/settings pair exist outside the translated strip on both tabs. Verify tab taps/swipes, Explore collapse and scroll reversal, recommendation state, overlay access and bottom safe areas. Run TypeScript, lint and relevant tests. Native motion and enlarged-font review remain pending until device access is available.

Completed checks passed TypeScript, lint and the targeted shell/Explore tests. The full suite passes 128 of 139 tests; the remaining 11 failures match the earlier baseline. Updated the feedback test to expect the single shared mail action.

After the scoped restoration, TypeScript, lint and five targeted header/Explore checks pass. The feedback regression now covers Explore's two header states. Device rendering remains pending.

## Model usage

| Workflow stage | Agent | Plugin / skill used | Model used | Reasoning level | Evidence |
|---|---|---|---|---|---|
| Plan | Main agent | grill-me instructions consulted | gpt-6.1-sol | Unknown | User approved fixed brand row and pane-local Explore controls. |
| Review the plan | plan_review | None | Unknown | Unknown | Flagged duplicate actions, redundant offsets, collapse range and focus behind filters. Addressed in the implementation. |
| Implement | Main agent | None | gpt-6.1-sol | Unknown | Runtime metadata confirms model. |
| Verify | fixed_shell_verify | None | Unknown | Unknown | Independently passed TypeScript and fixed-header regression test. Confirmed shell structure, mounted panes and filter focus handling. Native rendering remains unverified. |
| Verify | fixed_shell_verify | None | Unknown | Unknown | Transition correction independently passed TypeScript and three header/transition tests. Confirmed no conditional shell header changes viewport height at tab completion. Native motion remains unverified. |
| Verify | fixed_shell_verify | None | Unknown | Unknown | Final two-mode correction independently passed TypeScript and three header/transition tests. Confirmed offsets 1/150 use whole-pane motion and offset 0 restores the stationary overlay, with duplicate header focus disabled. |
