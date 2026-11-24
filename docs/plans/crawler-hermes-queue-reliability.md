# Hermes queue reliability and operator setup

## Requirements and authorization

The user approved fixing the Council queue findings, chose skip/report for an
overlapping run, and explicitly requested code/documentation only; the user will
run Hermes and the live pilot. Supply bot/profile and scheduling commands.
Existing PR/manual-merge/manual-DB-import behavior remains authoritative.

Assumptions: retain deferred leads beyond 1,000 rather than silently dropping
them; use the existing 5 MiB JSON reader limit as the consistent read/write size
budget. A capacity error retains the old checkpoint and external search batch.
No scheduler installation, credentials changes, crawling, PR creation or DB work.
Snapshot SHA binding and deployment sandbox configuration are separate follow-ups.

## Acceptance criteria

1. Concurrent queue read/modify/write operations cannot overwrite a lead from
   another completed update. Contention returns `skipped-already-running` without
   changing checkpoint/output. Sequential independent feeds accumulate.
2. A full scheduled run acquires persistent ownership before web search and
   releases it after refresh/reporting. Other runs skip; queue operations require
   matching ownership while active. A stale owner never expires automatically;
   recovery requires inspecting the run and releasing its exact token.
3. 999/1,000/1,001 and accumulated larger backlogs remain readable and rotate
   within the existing 20-candidate budget. Malformed backlog rows fail clearly.
   Both output/checkpoint sizes are checked before either is installed, so a
   successful helper never writes JSON that its reader rejects for size.
4. Regression tests exercise real process contention, owner mismatch/recovery,
   retained leads, capacity failure/no changes, and existing extraction behavior.
5. Documentation includes a complete Hermes task (not Python-only cron), matching
   state/token arguments, explicit timezone and paused schedule, setup/run/pause/
   resume/recovery commands. Clearly distinguish profiles from OS sandboxes.

## Stages and assignments

- Plan: /root, grill-with-docs; reuse Council findings and user's scope decisions.
- Review: /root/queue_plan_review, no skill; independently check plan against code,
  ownership races/crashes, JSON budget and test coverage. Evidence: actionable
  findings, file references and approval/blockers. Resolve before implementation.
- Implement: /root, no skill; shared queue coordination/JSON helpers, acquire/
  release CLI, locked queue CLI, backlog fix, regressions and runbook/prompt.
- Verify: /root/queue_verify, no skill; run relevant offline Python suites, inspect
  acceptance criteria/diff and shell examples. Report exact results and gaps.

## Implementation and verification steps

1. Add a shared state helper using nonblocking POSIX flock around mutations and
   a persistent active-run marker with UUID ownership. All contenders use the
   same canonical checkpoint path. Never unlink the lock inode.
2. Add `scripts/discovery_run.py acquire|release --state ... [--run-id ...]`.
   Acquire emits a token or skip status. Release requires the owner token.
3. Hold the helper's lock over checkpoint read, queue build and writes. Support
   `--run-id` for the owning Hermes run; reject wrong/missing ownership safely.
   Reserve canonical state/lock/active-marker paths against input/output aliases
   (including symlinks); reject input==output. Ownership is cooperative scheduling
   coordination, not a sandbox. Failed/uncertain runs retain their marker.
4. Remove the asymmetric 1,000-row rejection. Use bounded JSON serialization
   consistent with read_json for checkpoint and queue; preflight both outputs.
5. Add focused regressions, update extraction prompt and crawler README with
   full task commands and explicit manual stale-run recovery.
6. Delegate verification. No live Hermes/GitHub/DB checks; user handles the pilot.

## Model usage

| Workflow stage | Agent | Plugin / skill used | Model used | Reasoning level | Evidence |
|---|---|---|---|---|---|
| Plan | /root | grill-with-docs | Unknown | Unknown | Read local skill, CONTEXT.md and queue/runner/docs; user's code-only scope and skip decision confirmed. Runtime settings unexposed. |
| Review the plan | /root/queue_plan_review | None | Unknown | Unknown | Approved with required canonical-path reservations, exact byte preflight, cooperative ownership and explicit stale-run recovery; main incorporated these. |
| Implement | /root | None | Unknown | Unknown | Added queue_state helper, acquire/release CLI, owner-aware locked preparation, consistent byte preflight, >1,000-lead retention, 12 regression tests and setup/runbook commands checked against official Hermes docs. |
| Verify | /root | None | Unknown | Unknown | 12 new queue tests and existing 31 extraction tests pass; git diff --check passes. No Hermes/gh execution. |
| Verify | /root/queue_verify | None | Unknown | Unknown | Full offline suite: 108 tests PASS; git diff --check PASS; four setup/recovery shell blocks parse with /bin/sh -n. Ownership/aliases/backlog/byte limits reviewed. Requested skipped-open-pr completion release and python3 prefix; main applied both. Live Hermes/auth/scheduling intentionally unverified. |

## Results

Plan reviewer approved with path-alias and ownership clarifications incorporated.
User approval applies to the queue fixes and setup documentation. Existing working
tree was clean. Implementation and independent offline verification complete.
No new domain terminology required. Used official Hermes profiles/CLI/cron docs
for example commands; no model/provider selection or scheduler changes executed.

Independent verifier reported all 108 offline Python tests passing and clean diff
formatting. Shell examples were parsed, not executed. Both doc findings were
addressed: normal skipped-open-pr releases acquired ownership after saving its
report, and inline acquire commands explicitly use python3. The acquisition
skipped-already-running path never releases another run's marker. Source/data
catalog, remote main, DB and scheduler were not changed. Files are uncommitted.
The user will perform the live pilot; remote main must contain the new scripts
before fresh clones can use --run-id and the ownership protocol.

## Follow-up: verified empty childcare collections (2026-11-25)

Remote pilot diagnostics found 10 November and 2 December events, all staff-only,
and zero January links. Refresh incorrectly treated the resulting empty filtered
collection as an outage. Added a list-compatible CollectedEvents attestation:
the childcare collector validates listing pages and may attest no eligible
parent/family candidates. Recognized empty cal_list containers are supported;
unknown/blocked pages, changed link markup and invalid eligible-event details
fail closed. Plain empty arrays from other collectors still fail. Existing
baseline rows are retained. Per-month counts are saved in staged raw output.
The Hermes template now requires a leading CRON_FAILURE marker for failed work.

Main performed this scoped debugging follow-up without delegation (replacement
project instructions no longer require stage delegation). All 118 offline Python
tests pass; git diff --check passes. Live source HTML could not be opened by the
web tool, so the real remote empty-calendar markup remains unverified. No remote
execution, PR, DB, ownership release or commit performed.
