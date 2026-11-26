"""Generate reviewable PostgreSQL DML from a catalog diff; never connect to DB."""
import json

FIELDS = ("id", "csv_sequence", "title", "venue_name", "venue_detail", "address", "locality",
          "region", "category", "source", "source_event_id", "starts_at", "ends_at", "age_min_months",
          "age_max_months", "indoor", "price_text", "price_type", "reservation_required",
          "reservation_status", "guardian_required", "stroller_friendly", "nursing_room", "parking",
          "tags", "summary", "source_url", "last_checked_at")


def dollar(text, label="babyroo"):
    delimiter = "$" + label + "$"
    while delimiter in text:
        label += "_"
        delimiter = "$" + label + "$"
    return delimiter + text + delimiter


def record(row):
    text = json.dumps({k: row[k] for k in FIELDS if k in row}, ensure_ascii=False)
    if "\x00" in text or "\\u0000" in text:
        raise ValueError("PostgreSQL text cannot contain NUL")
    return dollar(text, "data") + "::jsonb"


def same(fields, left, right):
    return " AND ".join(f'{left}."{k}" IS NOT DISTINCT FROM {right}."{k}"' for k in fields)


def block(body):
    return "DO " + dollar(body, "babyroo") + ";\n"


def generate_sql(baseline, added, changed, expired):
    """Only changed fields are updated; stale DB values abort the transaction."""
    by_id = {e["id"]: e for e in baseline}
    statements = ["-- No schema changes (DDL) required; apply existing Prisma migrations first.",
        "-- Review before executing. New rows are published when the operator runs this file. Existing DB-owned fields are preserved.",
        "BEGIN;", "SET LOCAL lock_timeout = '10s';", "SET LOCAL statement_timeout = '120s';"]
    for change in changed:
        fields = sorted(set(change["fields"]) & (set(FIELDS) - {"id"}))
        if not fields:
            continue
        before = by_id[change["id"]]
        after = {**before, **{k: change["fields"][k]["after"] for k in fields}}
        body = f'''DECLARE
  before_row public.events;
  after_row public.events;
  affected bigint;
BEGIN
  SELECT * INTO before_row FROM jsonb_populate_record(NULL::public.events, {record(before)});
  SELECT * INTO after_row FROM jsonb_populate_record(NULL::public.events, {record(after)});
  IF EXISTS (SELECT 1 FROM public.events t WHERE t.id = after_row.id AND {same(fields, 't', 'after_row')}) THEN
    RETURN;
  END IF;
  UPDATE public.events t SET {', '.join(f'"{k}" = after_row."{k}"' for k in fields)},
    updated_at = CURRENT_TIMESTAMP
  WHERE t.id = before_row.id AND {same(fields, 't', 'before_row')};
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN
    RAISE EXCEPTION 'Event % is missing or changed since the baseline; transaction aborted', before_row.id;
  END IF;
END;'''
        statements.append(block(body))
    for row in added:
        fields = [k for k in FIELDS if k in row]
        statements.append(block(f'''DECLARE
  after_row public.events;
BEGIN
  SELECT * INTO after_row FROM jsonb_populate_record(NULL::public.events, {record(row)});
  IF after_row.ends_at < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date THEN
    RETURN;
  END IF;
  INSERT INTO public.events ({', '.join('"' + k + '"' for k in fields)}, publication_status, updated_at)
  VALUES ({', '.join('after_row."' + k + '"' for k in fields)}, 'published', CURRENT_TIMESTAMP)
  ON CONFLICT (id) DO NOTHING;
  IF NOT EXISTS (SELECT 1 FROM public.events t WHERE t.id = after_row.id AND {same(fields, 't', 'after_row')}) THEN
    RAISE EXCEPTION 'Event % already exists with different data; transaction aborted', after_row.id;
  END IF;
END;'''))
    for row in expired:
        if row["id"] not in by_id:
            continue  # Newly discovered ended records were never in the catalog.
        before = by_id[row["id"]]
        statements.append(block(f'''DECLARE
  ended public.events;
  before_row public.events;
  affected bigint;
BEGIN
  SELECT * INTO ended FROM jsonb_populate_record(NULL::public.events, {record(row)});
  SELECT * INTO before_row FROM jsonb_populate_record(NULL::public.events, {record(before)});
  IF ended.ends_at >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date THEN
    RETURN;
  END IF;
  UPDATE public.events SET publication_status = 'archived', ends_at = ended.ends_at, updated_at = CURRENT_TIMESTAMP
  WHERE id = ended.id AND source = ended.source AND publication_status = 'published'
    AND (ends_at IS NOT DISTINCT FROM before_row.ends_at OR ends_at IS NOT DISTINCT FROM ended.ends_at);
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected = 0 AND EXISTS (SELECT 1 FROM public.events WHERE id = ended.id AND publication_status = 'published') THEN
    RAISE EXCEPTION 'Event % changed since the baseline; archive aborted', ended.id;
  END IF;
END;'''))
    statements.append("COMMIT;\n")
    return "\n\n".join(statements)
