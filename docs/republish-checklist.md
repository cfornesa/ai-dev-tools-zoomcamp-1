# Replit republish checklist: migration data seeds

Replit's schema sync creates schema objects but does not replay Django
`RunPython` data migrations. After a publish that includes these migrations,
verify each seed's resulting application data; a successful schema sync or
`django_migrations` entry alone does not prove it ran.

| Migration | Seeded data | Post-publish verification |
|---|---|---|
| `0057_seed_ai_provider_model` | Five active default AI provider/model rows: Mistral Small, Gemini 2.5 Flash/Pro, DeepSeek Chat/Reasoner. | In Admin → AI model catalog (or `GET /api/admin/ai-models/` as an application admin), confirm each provider/model pair is present and active. |
| `0092_seed_art_piece_task_kind` | Adds `art_piece` to the task kinds of those five active default models. | In the same catalog, confirm each seeded model that should support generated art has **Generated art piece** selected; verify generation only after the intended provider is enabled. |
| `0106_seed_unpublish_retention_policy` | Creates singleton unpublish-retention policy row `id=1`, with a 30-day grace period. | In Admin → Unpublish retention, confirm the policy loads and shows 30 days; equivalently, an application admin can check `GET /api/admin/unpublish-retention/` for `unpublished_grace_days: 30`. |

Use the application's authenticated admin surfaces for verification. Do not
infer seed success from table existence or the migration ledger.
