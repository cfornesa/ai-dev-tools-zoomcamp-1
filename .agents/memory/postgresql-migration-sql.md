---
name: PostgreSQL migration SQL
description: Compatibility rule for raw PostgreSQL trigger SQL executed through Django and Psycopg 3.
---

When raw PostgreSQL SQL in a Django migration includes literal `%` characters,
write them as `%%` before passing the string to `schema_editor.execute()`.

**Why:** Django's PostgreSQL backend routes the statement through Psycopg's
placeholder handling, which otherwise interprets a single percent sign as an
invalid client-side parameter placeholder.

**How to apply:** Check trigger functions and other `RunPython` migration SQL
for PostgreSQL `RAISE EXCEPTION` format strings before running migrations
against a Psycopg 3-backed database.