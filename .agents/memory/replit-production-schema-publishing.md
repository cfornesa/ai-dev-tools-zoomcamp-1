---
name: Replit production schema publishing
description: Keep Django migration commands confined to the development schema flow when publishing to Replit-managed PostgreSQL.
---

Do not run Django migrations against the production database in a Replit deployment build or application startup. Replit's Publish flow compares the development and production schemas, presents any required rename/destructive confirmations, then applies the selected production schema diff.

**Why:** A production table can exist through Replit's managed schema flow without the corresponding Django migration ledger entry. Running `manage.py migrate` during a later build can then fail on an already-existing relation and block publication.

**How to apply:** Keep development migrations in the post-merge/development setup flow. Deployment builds may install dependencies, run deployment checks, and compile assets, but must not mutate production schema. For production schema changes, verify development and re-publish through Replit's schema-diff UI.