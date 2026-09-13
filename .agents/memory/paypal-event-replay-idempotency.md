---
name: PayPal event replay idempotency
description: A previously rejected, provider-signed PayPal event is not reprocessed under the same event ID.
---

`process_webhook_event` records a verified PayPal event before applying its
state transition outcome. A later delivery or ngrok replay with the same
`paypal_event_id` returns the original outcome and does not retry the event.
This preserves exactly-once audit semantics, but it also means that replaying
an event rejected by an older application revision cannot prove a later fix.
For a post-fix external acceptance test, obtain a genuinely new provider
delivery/event ID or use a deterministic signed fixture for the code path; do
not delete or rewrite the audit row merely to make a replay pass.

Confirmed 2026-09-13: the local database already contained an active paid
sandbox subscription and an earlier rejected `PAYMENT.SALE.COMPLETED` event.
Replaying that captured event through the live local ngrok tunnel returned the
same rejection without creating a duplicate subscription or changing the
existing active state.
