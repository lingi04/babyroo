# Babyroo crawler

## Extracting newly discovered event details

Search-only (v1) input continues to produce review suggestions. Version 2 adds
official detail-page extraction by Hermes and deterministic Python validation.
Use `crawler/prompts/discovery-extraction.md` as the scheduled Hermes task template;
it replaces the earlier search-only prompt. This change does not install a bot,
select a model/provider, or register a cron job.

The sequence is: fresh web search -> queue known/pending/new URLs -> Hermes reads
official details -> captured source text/hash -> structured extraction proposal ->
Python evidence/type/date/identity gate -> catalog/review PR. Python never calls
an LLM API or fetches arbitrary candidate URLs. It preserves the configured Hermes
model as the extraction owner. Official ownership and facts still need human PR
review; hashes/quote spans only check supplied material's internal consistency.

Prepare a fresh clean-main checkout and an external batch directory first. Queue
preparation verifies HEAD equals fetched origin/main and baseline/review files are
clean. `--state` and `--output` must be outside that checkout:

```sh
python3 scripts/discovery_queue.py --catalog-root /absolute/path/to/clean-main \
  --discovery-input /absolute/path/to/batch/search.json \
  --state /absolute/path/to/hermes-state/queue.json \
  --output /absolute/path/to/batch/queue.json --run-id ACQUIRED_RUN_ID
```

For a complete Hermes run, acquire the run ID before searching using
`python3 scripts/discovery_run.py acquire --state /absolute/path/to/hermes-state/queue.json`.
Stop on `skipped-already-running`. Use the returned ID, never the literal
`ACQUIRED_RUN_ID`. The setup below includes manual completion/recovery commands.
An isolated manual queue invocation may omit `--run-id` only when no full run is
active. Queue preparation uses a short nonblocking process lock for the entire
checkpoint read/build/write; an active run requires its matching owner token.

The queue selects up to 20 candidates, splitting slots between external-source
rechecks/pending leads and new discoveries. Unused slots are reused by the other
group; cursors rotate larger queues. The external state file retains selected and
deferred new leads until they enter catalog/review state, even without rediscovery.
A selected candidate's fetch failure remains a visible
retryable review outcome and never removes its existing catalog event.
The 20-candidate processing budget does not cap retained leads at 1,000. Larger
backlogs remain readable and rotate normally. Both queue and checkpoint are
preflighted as the exact UTF-8 JSON bytes against the existing 5 MiB reader limit
before either file is installed. Capacity failures keep the old checkpoint and
search input; retain that batch and reduce/split new intake deliberately instead
of deleting deferred leads. Source batches/checkpoints need operator-managed
disk retention; automatically pruning unprocessed leads is not supported.

Save actual visible web-tool text in `<batch>/raw/<document-id>.txt`, then run:

```sh
python3 scripts/discovery_bundle.py capture --batch-root /absolute/path/to/batch \
  --document-id doc-1 --candidate-id candidate-1 \
  --url https://official-venue.example/detail --fetched-at ACTUAL_ISO_TIMESTAMP
```

The example domain is a placeholder, not an actual source. The helper creates
normalized UTF-8/NFC/LF text and metadata under batch/documents/. Build a version-2
batch.draft.json from generated document metadata and Hermes's factual proposals.
The exact contract is in extraction_schema.py and the task template. All selected
candidate IDs must be accounted for, and references may not cross candidates.
Unknown schema versions, hashes, invalid paths/symlinks or malformed whole batches
fail before catalog writes. v2 allows empty search keywords for recheck-only runs.

```sh
python3 scripts/discovery_bundle.py finalize --batch-root /absolute/path/to/batch
python3 scripts/event_refresh_pr.py --discovery-input /absolute/path/to/batch/bundle.json
```

The second command is a dry run; add `--github-repo lingi04/babyroo --submit` when
authorized to push/open PRs. Keep bundle.json, queue.json and documents/ together.
Validation binds the batch to the exact queue file using its SHA-256 and selected IDs.
Do not modify captured documents after finalization. Source text remains external;
only bounded quotes, computed spans, source URLs/hashes and outcomes enter PR review
artifacts. No full pages, credentials or model reasoning enter events.json.

Ready records have the full 30-field catalog shape. Unknown optional facts are
null/unknown. Concrete claims need official-text evidence, with conservative age,
date, boolean, price and reservation checks. Unsupported/ambiguous proposals stay
review-only (or are rejected for invalid field types/enums). Never guess missing
dates or treat unknown amenities as false. Native structured collectors take
precedence when they and extraction identify the same record.

Confirmed permanent venues get exactly `1970-01-01` to `9999-12-31`; Hermes must
provide affirmative ongoing/permanent-operation evidence and leave those dates
for Python to assign. These dates are availability sentinels, not historical
opening dates, a promise of daily opening, or a substitute for missing event dates.
Existing native venue dates are not bulk migrated. The app may currently display
literal sentinel years; UI formatting is a separate follow-up before user rollout.

`data/discovery/identities.json` preserves date-independent identities and reviewed
URL aliases/edition keys. Corrected dates reuse the same ID. Ambiguous annual
editions, shared homepages and fuzzy cross-source matches require review. Pending
items and operator notes survive subsequent searches. Confidence, evidence text
formatting and capture timestamps alone do not create a PR.

Budgets are represented by `extraction_schema.Limits` (20 active candidates,
3 documents/candidate, 40 proposals, 100 KiB/document, 5 MiB total text). Queue CLI
`--budget` can reduce selection. Captures/proposals beyond a budget must be deferred
explicitly; they must not be accepted and then lost at a checkpoint.

## Create the Hermes assistant and schedule (operator commands)

These commands are for you to run; no bot or schedule is installed by this change.
First merge these scripts into remote main: every scheduled run clones main, so
uncommitted local fixes alone do not update its workflow code. Use an installed
Hermes version supporting profiles, `cron create --paused` and job timezones;
check `hermes profile create --help` and `hermes cron create --help` on your Mac.

```sh
hermes profile create babyroo
hermes -p babyroo setup
hermes -p babyroo tools
gh auth login
```

The profile is the persistent assistant behind the bot; Hermes Desktop can add
its roster presentation through Bots/New Agent. A profile separates configuration
and memory, not OS file access. Select your own model/provider and enable web
search/browser plus terminal/file tools for both the cron and CLI contexts.
Keep the intended GitHub account configured for push/PR operations; no DB
credentials are needed. Do not add broad auto-approval or change sandbox settings
just to bypass an unattended failure.

Create a **paused example** for daily 09:00 Korea time from the local bootstrap
checkout. The workdir is the trusted local repo used to read the template/acquire
ownership; research and refresh use fresh isolated main checkouts as directed.
This prompt schedules the complete Hermes task, not just Python refresh:

```sh
cd /Users/hanjangho/Documents/repos/babyroo
hermes -p babyroo cron create "0 9 * * *" \
  'Read crawler/prompts/discovery-extraction.md and follow the complete workflow. Use ~/.cache/babyroo-hermes/queue.json as the persistent checkpoint and a new batch directory under ~/.cache/babyroo-hermes/batches for each run. Discover Seoul outings for young children, optionally using Google Trends for keywords; verify facts on official pages. Acquire ownership before research and stop on skipped-already-running. Dry-run only: do not pass --submit. Save a final report; release the exact token only after a completed outcome. Report failures and leave their ownership marker for manual recovery.' \
  --workdir /Users/hanjangho/Documents/repos/babyroo \
  --timezone Asia/Seoul --name babyroo-events --paused

hermes -p babyroo gateway install
hermes -p babyroo gateway start
hermes -p babyroo gateway status
hermes -p babyroo cron list
hermes -p babyroo cron run babyroo-events
```

Manual `cron run` is an operator override even while paused. Inspect that pilot's
output before enabling recurrence:

```sh
hermes -p babyroo cron resume babyroo-events
hermes -p babyroo cron status
hermes -p babyroo cron pause babyroo-events
```

To enable PR submission after testing, edit the job prompt, keeping the complete
workflow instructions and replacing `Dry-run only: do not pass --submit` with
`PR submission is authorized: pass --github-repo lingi04/babyroo --submit` using
`hermes -p babyroo cron edit babyroo-events --prompt 'FULL_REVISED_PROMPT'`.
`FULL_REVISED_PROMPT` is a placeholder: supply the whole revised prompt rather
than replacing it with that literal string. A terminal-only manual pilot is also
possible: `hermes -p babyroo chat -q 'Read crawler/prompts/discovery-extraction.md
and run it in dry-run mode with ~/.cache/babyroo-hermes/queue.json as checkpoint.'`
from the bootstrap checkout. The gateway must run and the Mac must be awake for
scheduled jobs. Set the chosen schedule and notification delivery yourself;
CLI-created jobs default to local output, not Telegram.

### Ownership and manual recovery

Acquisition returns `acquired` with `run_id` and persists it in
`queue.json.active-run.json`, even after the tool process exits. A second full
run returns `skipped-already-running` before research. The active marker is
cooperative coordination, not security enforcement. All scheduled invocations
must follow this protocol and use the same checkpoint path.

On a successfully saved dry-run/no-op/PR or `skipped-open-pr` report, release the
exact acquired token. An existing open PR is a normal completed skip; save its
URL/status and release this run so the next schedule can try again. An acquisition
returning `skipped-already-running` owns nothing and must not release a marker:

```sh
python3 scripts/discovery_run.py release \
  --state "$HOME/.cache/babyroo-hermes/queue.json" --run-id ACTUAL_RUN_ID
```

Replace `ACTUAL_RUN_ID` with the token returned by acquire. A failed/interrupted
run deliberately retains ownership and its batch; subsequent schedules skip.
Confirm the old Hermes session is stopped, inspect its batch/PR outcome and read
the marker's `run_id` before using that release command for recovery. Never
release a still-running job, clear another owner's token, or delete/replace the
`.lock` file. There is no automatic expiry/retry of an uncertain run. Canonical
input/output aliases to checkpoint/lock/marker, or to each other, are rejected.

Command references (official Hermes documentation, checked 2026-11-24):
[Profiles](https://hermes-agent.nousresearch.com/docs/user-guide/profiles),
[CLI](https://hermes-agent.nousresearch.com/docs/user-guide/cli),
[Cron](https://hermes-agent.nousresearch.com/docs/user-guide/features/cron),
[Messaging gateway](https://hermes-agent.nousresearch.com/docs/user-guide/messaging).

## Scheduled discovery PR workflow (Mac / Hermes)

The approved baseline is `server/data/events.json` in the latest remote `main`.
The initial DB export is already committed. The scheduler never reads or writes
the database. You merge the PR and run the DB import manually afterward.

Install Git, Python 3.9+ and GitHub CLI (`gh`) on the Mac account running Hermes.
Use `gh auth login` once and verify the account can push branches and open PRs
for `lingi04/babyroo`. Do not put access tokens in commands or committed files.
The workflow code must be merged into main before the scheduled runner can use it.

Hermes (or another external search task) must first acquire fresh results and
atomically replace an input file **outside the repository**, for example:

```json
{
  "generated_at": "2026-11-23",
  "keywords": {
    "서울 아이랑 전시": [
      {"title": "A venue to review", "url": "https://example.com/event", "description": "Search evidence"}
    ],
    "서울 키즈카페": []
  }
}
```

`generated_at` is the actual acquisition date (ISO date or ISO timestamp), not
the date the file was copied. Each query maps to a list; an empty list is valid
after a successful search. A missing, malformed, future-dated or older-than-eight-day
input fails the run. Override freshness with `--discovery-max-age-days` if needed.
This Python reader does not call Google search or Google Alerts. Discovery hits
remain unverified review suggestions; they are never inserted as incomplete app
events. `official_url`, when provided, is still a link requiring human verification.

First run a local dry run (the default), after setting a PATH containing Git:

```sh
python3 scripts/event_refresh_pr.py \
  --discovery-input /absolute/path/to/hermes-results.json
```

When ready, enable branch push and PR creation:

```sh
python3 scripts/event_refresh_pr.py \
  --discovery-input /absolute/path/to/hermes-results.json \
  --github-repo lingi04/babyroo --submit
```

Configure Hermes to execute that command **only after successful acquisition**.
A Python-only system cron example is shown below for deployments with a separate
fresh feeder producer. It does **not** run Hermes discovery/extraction or acquire
full-run ownership and is not the complete Hermes schedule above. The producer
and runner must be coordinated by the operator. The example assumes the Mac's
system timezone is Asia/Seoul; no scheduler is installed by these scripts:

```cron
PATH=/opt/homebrew/bin:/usr/bin:/bin
0 18 * * 0 cd /absolute/path/to/babyroo && python3 scripts/event_refresh_pr.py --discovery-input /absolute/path/to/hermes-results.json --github-repo lingi04/babyroo --submit >> /absolute/path/to/refresh.log 2>&1
```

Each run uses a fresh clone under `~/.cache/babyroo-refresh/run-*`, creates an
`automation/event-refresh/*` branch from fetched main, and invokes refresh code
from that checkout. Your developer checkout is untouched. A lock prevents local
overlap. If a refresh PR is already open, the run skips; resolve/merge/close it
before the next run. If main advances during collection, rerun the job. Main can
also advance after PR creation, so revalidate the PR against current main before
merging. The runner never rebases, force-pushes, auto-merges or imports DB data.
Subprocesses run without interactive stdin/auth prompts and have a 30-minute
timeout; configure SSH/GitHub authentication before enabling the schedule.
If pushing succeeds but PR creation fails, the remote branch may remain. Inspect
the retained checkout/remote branch before retrying; the runner never deletes or
force-replaces it.

No semantic changes means no writes/push/PR. Generated files are limited to:

- `server/data/events.json`: merged catalog, including retained missing/expired rows.
- `data/discovery/review.json`: stable missing-event and discovery-suggestion state.
- `data/discovery/reports/refresh-*.md`: unique per-change reports. Prior reports
  and annotations are never overwritten. All new events appear, not only a top 25.

Semantic comparison ignores `created_at`, `updated_at`, `last_checked_at`,
`image_url`, `admin_updated_at`, and `publication_status`. The last three remain
absent from the catalog. Existing IDs, sequence numbers and created/updated
timestamps are preserved. Unknown/null incoming optional fields retain known
baseline values. Concrete source values are proposed in the PR for review.
Missing events are **kept and flagged**, never deleted automatically.

All native outputs are staged in temporary files, with full kids-cafe pagination.
Exceptions and unverified empty source collections fail the run for operator review;
no catalog or review checkpoint advances. Source search windows can explain
missing results and are not proof of deletion. Existing legacy `publish` commands
are separate: they rebuild/filter the public catalog and must not replace this
merged-baseline workflow.

For local troubleshooting without PR orchestration, run
`python3 refresh_places.py --discovery-input /absolute/path/to/hermes-results.json`.
This command writes the local checkout on success; use the isolated runner for
normal scheduled operation. Old run clones/logs are retained for diagnostics;
manage their retention on the scheduler host.

The Seoul Childcare collector can explicitly attest a healthy empty result when
all fetched month listings validate but no parent/family candidate matches. Known
staff-only listings and recognized empty `cal_list` containers are valid; unknown
pages, changed event-link markup, fetch errors and missing eligible-event details
still fail. Staged raw output records per-month listed/parent counts and the
empty-result reason. Refresh logs the verified empty result, continues other
collectors/extractions and retains missing baseline rows for review. Other
collectors returning plain `[]` still fail. Hermes must start failed-work reports
with `[CRON_FAILURE]` so an agent that finished reporting a failed refresh is not
mistaken for a successful collection run.

After merging, pull that main revision and run `npm run db:seed:events` in
`server/` manually using the intended DB environment. Omitted images and existing
publication states are preserved. New records use the DB's default draft status;
publish them through the admin workflow as appropriate. The importer upserts
catalog contents and does not delete DB-only rows. DB-owned timestamps/images/
publication states are outside baseline comparison; complete row equality is
not claimed. No DB import was run during verification.

Babyroo의 데이터 파이프라인은 처음부터 작게 시작합니다.

```text
data/raw/*.json -> data/normalized/events.json -> server/data/events.json
```

## 실행

샘플 데이터로 전체 흐름 확인:

```bash
cd /Users/hanjangho/Documents/repos/babyroo
PYTHONPATH=crawler python3 -m babyroo_crawler.cli run-sample
```

서울문화포털 실제 데이터 수집부터 공개까지:

```bash
cd /Users/hanjangho/Documents/repos/babyroo
PYTHONPATH=crawler python3 -m babyroo_crawler.cli run-seoul --pages 5
```

서울시육아종합지원센터 부모·가족 대상 행사 수집:

```bash
cd /Users/hanjangho/Documents/repos/babyroo
PYTHONPATH=crawler python3 -m babyroo_crawler.cli run-childcare --months 3
```

디키디키 입장 및 워크샵 프로그램 수집:

```bash
cd /Users/hanjangho/Documents/repos/babyroo
PYTHONPATH=crawler python3 -m babyroo_crawler.cli run-dikidiki
```

서대문자연사박물관 관람, 현재 전시, 교육일정 수집:

```bash
cd /Users/hanjangho/Documents/repos/babyroo
PYTHONPATH=crawler python3 -m babyroo_crawler.cli run-namu
```

국립민속박물관 어린이박물관 관람 및 교육일정 수집:

```bash
cd /Users/hanjangho/Documents/repos/babyroo
PYTHONPATH=crawler python3 -m babyroo_crawler.cli run-nfm-kids
```

추가 서울 가족 방문지 관람 및 서울물재생체험관 프로그램 카드 수집:

```bash
cd /Users/hanjangho/Documents/repos/babyroo
PYTHONPATH=crawler python3 -m babyroo_crawler.cli run-family-venues
```

서울형 키즈카페 지점 수집:

```bash
cd /Users/hanjangho/Documents/repos/babyroo
PYTHONPATH=crawler python3 -m babyroo_crawler.cli run-seoul-kids-cafe
```

실제 수집원을 한 번에 실행:

```bash
cd /Users/hanjangho/Documents/repos/babyroo
PYTHONPATH=crawler python3 -m babyroo_crawler.cli run-all --pages 5 --months 3
```

단계별 실행:

```bash
PYTHONPATH=crawler python3 -m babyroo_crawler.cli collect-sample
PYTHONPATH=crawler python3 -m babyroo_crawler.cli collect-seoul --pages 5
PYTHONPATH=crawler python3 -m babyroo_crawler.cli collect-childcare --months 3
PYTHONPATH=crawler python3 -m babyroo_crawler.cli collect-dikidiki
PYTHONPATH=crawler python3 -m babyroo_crawler.cli collect-namu
PYTHONPATH=crawler python3 -m babyroo_crawler.cli collect-nfm-kids
PYTHONPATH=crawler python3 -m babyroo_crawler.cli collect-family-venues
PYTHONPATH=crawler python3 -m babyroo_crawler.cli collect-seoul-kids-cafe
PYTHONPATH=crawler python3 -m babyroo_crawler.cli normalize
PYTHONPATH=crawler python3 -m babyroo_crawler.cli publish
```

## 동작 구조

1. `collect-seoul`
   - 서울문화포털의 행사 목록 JSON을 조회합니다.
   - 최신 교육/체험·공연 목록과 `영유아`, `유아`, `베이비`, `개월`, `서울상상나라` 검색 결과를 함께 조회합니다.
   - 제목과 요약에 영유아 관련 표현이 있는 후보만 상세 페이지를 조회합니다.
   - 상세 대상 연령이 0~3세와 겹치지 않거나 유치원·어린이집 기관 전용인 행사는 제외합니다.
   - 대상, 요금, 기간, 장소, 설명을 파싱해 `data/raw/seoul_culture.json`에 저장합니다.

2. `normalize`
   - `data/raw/*.json`을 모두 읽습니다.
   - 출처별 표현을 Babyroo 공통 스키마로 바꿉니다.
   - 결과를 `data/normalized/events.json`에 저장합니다.

3. `publish`
   - 종료 행사와 필수값이 없는 행사를 제외합니다.
   - 서버가 읽을 `server/data/events.json`을 생성합니다.
   - 제외 이유는 `data/normalized/publish_report.json`에 기록합니다.

수집기와 정규화를 분리했기 때문에, 다음 사이트를 추가할 때는 `crawler/sources/`에 collector만 추가하고 기존 normalize/publish 흐름을 재사용할 수 있습니다.

서울시육아종합지원센터는 `나들이정보`가 기사형 콘텐츠라 행사 날짜를 안정적으로 얻기 어렵습니다. 그래서 현재 collector는 `행사/교육` 달력에서 부모·가족 대상 일정만 수집하고, 보육교직원·원장·교사 대상 교육은 제외합니다.

디키디키는 상설 입장과 워크샵 프로그램이 함께 있는 수집원입니다. `crawler/sources/dikidiki.py`는 상설 입장을 `venue_admission`, 워크샵을 `program`으로 raw payload에 구분해 저장하고, 기존 normalize/publish 흐름으로 Babyroo 공통 이벤트 스키마에 맞춥니다.

서대문자연사박물관은 `crawler/sources/namu.py`에서 상설 관람을 `venue_admission`, 현재 전시를 `exhibition`, 교육일정 달력의 수업을 `program`으로 구분해 저장합니다.

국립민속박물관 어린이박물관은 `crawler/sources/nfm_kids.py`에서 어린이박물관 관람을 `venue_admission`, 교육일정 표의 교육을 `program`으로 구분해 저장합니다.

추가 서울 가족 방문지는 `crawler/sources/seoul_family_venues.py`에서 롯데월드 아쿠아리움, 씨라이프 코엑스 아쿠아리움, 서울물재생체험관, 서울상상나라, 아리수나라 관람을 `venue_admission`으로 저장합니다. 서울물재생체험관 홈페이지에 노출된 프로그램·행사 카드는 별도 `program` 이벤트로 함께 저장합니다.

서울형 키즈카페는 `crawler/sources/seoul_kids_cafe.py`에서 우리동네키움포털의 서울형 키즈카페 예약 목록을 페이지별로 수집하고, 각 지점을 `venue_admission`으로 저장합니다.
