"""Generate readable PostgreSQL DML from a catalog diff; never connect to DB."""
import math

FIELDS = ("id", "csv_sequence", "title", "venue_name", "venue_detail", "address", "locality",
          "region", "category", "source", "source_event_id", "starts_at", "ends_at", "age_min_months",
          "age_max_months", "indoor", "price_text", "price_type", "reservation_required",
          "reservation_status", "guardian_required", "stroller_friendly", "nursing_room", "parking",
          "tags", "summary", "source_url", "last_checked_at")
DATE_FIELDS = {"starts_at", "ends_at", "last_checked_at"}


def literal(value):
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "TRUE" if value else "FALSE"
    if isinstance(value, (int, float)):
        if not math.isfinite(value):
            raise ValueError("SQL numbers must be finite")
        return str(value)
    if isinstance(value, str):
        if "\x00" in value:
            raise ValueError("PostgreSQL text cannot contain NUL")
        escaped = value.replace("'", "''")
        if "\\" in escaped:
            return "E'" + escaped.replace("\\", "\\\\") + "'"
        return "'" + escaped + "'"
    if isinstance(value, list) and all(isinstance(item, str) for item in value):
        return "ARRAY[" + ", ".join(literal(item) for item in value) + "]::text[]"
    raise ValueError(f"unsupported SQL value type: {type(value).__name__}")


def field_value(key, value):
    return ("DATE " if key in DATE_FIELDS and value is not None else "") + literal(value)


def generate_sql(baseline, added, changed, expired):
    """Git holds the baseline; SQL contains only the reviewed assignments."""
    baseline_ids = {e["id"] for e in baseline}
    statements = ["-- No schema changes (DDL) required; apply existing Prisma migrations first.",
        "-- Review before executing. New events are published; existing DB-owned fields are preserved.",
        "BEGIN;"]
    for change in changed:
        fields = sorted(set(change["fields"]) & (set(FIELDS) - {"id"}))
        if not fields:
            continue
        assignments = [f'  "{key}" = {field_value(key, change["fields"][key]["after"])}' for key in fields]
        assignments.append("  updated_at = CURRENT_TIMESTAMP")
        statements.append("UPDATE public.events\nSET\n" + ",\n".join(assignments)
                          + "\nWHERE id = " + literal(change["id"]) + ";")
    for row in added:
        fields = [key for key in FIELDS if key in row]
        columns = [f'  "{key}"' for key in fields] + ["  publication_status", "  updated_at"]
        values = ["  " + field_value(key, row[key]) for key in fields] + ["  'published'", "  CURRENT_TIMESTAMP"]
        statements.append("INSERT INTO public.events (\n" + ",\n".join(columns) + ")\nVALUES (\n"
                          + ",\n".join(values) + ")\nON CONFLICT (id) DO NOTHING;")
    for row in expired:
        if row["id"] not in baseline_ids:
            continue  # Newly discovered ended records were never in the catalog.
        statements.append("UPDATE public.events\nSET publication_status = 'archived',\n"
                          + "    ends_at = " + field_value("ends_at", row["ends_at"]) + ",\n"
                          + "    updated_at = CURRENT_TIMESTAMP\nWHERE id = " + literal(row["id"])
                          + " AND publication_status = 'published';")
    statements.append("COMMIT;\n")
    return "\n\n".join(statements)
