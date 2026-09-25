# Public gallery API contract

## Authored per-piece sound contract (#833)

Structured 2D and 3D scene documents may carry an optional `sonic` object
next to the existing `sound` capability flag. Generated art pieces carry the
same object under `generation_metadata["sonic"]`. The object is additive and
optional: omitting it preserves the current boolean-sound behavior. Readers
must ignore unknown keys and treat an invalid authored block as absent rather
than rejecting an otherwise valid piece.

| Field | Type / allowed values | Default | Clamp / invalid-input rule |
| --- | --- | --- | --- |
| `sonic.tempo` | integer, 40–220 BPM | 90 | Clamp to the inclusive range. |
| `sonic.root` | `C`, `C#`, `D`, `D#`, `E`, `F`, `F#`, `G`, `G#`, `A`, `A#`, `B` | `C` | Unknown pitch classes make the authored block absent. |
| `sonic.scale` | `major`, `minor`, `pentatonic`, `chromatic`, `dorian`, `phrygian`, `lydian`, `mixolydian`, `wholetone` | `major` | Unknown scales make the authored block absent. |
| `sonic.keyboard_scale` | same scale enum | `sonic.scale` | Unknown values make the authored block absent. |
| `sonic.transpose` | integer semitones, -12–12 | 0 | Clamp to the inclusive range. |
| `sonic.follow_key` | boolean | `false` | When true, keyboard scale changes link the ambient scale. |
| `sonic.instrument` | `synth`, `amsynth`, `fmsynth`, `membranesynth`, `metalsynth`, `plucksynth`, `duosynth` | `synth` | Unknown instruments make the authored block absent. |
| `sonic.feel` | string, at most 400 characters | `""` | Truncate to 400 characters. |
| `sonic.extras.default_volume` | number, 0–100 percent | 100 | Clamp to the inclusive range. |
| `sonic.extras.ambient_volume` | number, 0–100 percent | `default_volume` | Clamp to the inclusive range. |
| `sonic.extras.keyboard_volume` | number, 0–100 percent | `default_volume` | Clamp to the inclusive range. |
| `sonic.extras.voices.ambient` | instrument enum | `synth` | Unknown values make the authored block absent. |
| `sonic.extras.voices.movement` | instrument enum | `synth` | Unknown values make the authored block absent. |
| `sonic.extras.voices.melodic` | instrument enum | `sonic.instrument` | Unknown values make the authored block absent. |
| `sonic.extras.synth.oscillator` | `sine`, `square`, `sawtooth`, `triangle` | `sine` | Unknown values make the authored block absent. |
| `sonic.extras.synth.filter_type` | `lowpass`, `highpass`, `bandpass` | `lowpass` | Unknown values make the authored block absent. |
| `sonic.extras.synth.filter_cutoff` | number, 20–20,000 Hz | 2,000 | Clamp to the inclusive range. |
| `sonic.extras.synth.filter_resonance` | number, 0.1–20 | 1 | Clamp to the inclusive range. |
| `sonic.extras.synth.envelope.attack` | number, 0–10 seconds | 0.01 | Clamp to the inclusive range. |
| `sonic.extras.synth.envelope.decay` | number, 0–10 seconds | 0.1 | Clamp to the inclusive range. |
| `sonic.extras.synth.envelope.sustain` | number, 0–1 | 0.7 | Clamp to the inclusive range. |
| `sonic.extras.synth.envelope.release` | number, 0–10 seconds | 0.3 | Clamp to the inclusive range. |
| `sonic.extras.synth.octave_min` | integer, -1–7 | 3 | Clamp; must not exceed `octave_max`. |
| `sonic.extras.synth.octave_max` | integer, -1–7 | 5 | Clamp; must not be below `octave_min`. |
| `sonic.extras.synth.effects.distortion` | number, 0–1 | 0 | Clamp to the inclusive range. |
| `sonic.extras.synth.effects.chorus` | number, 0–1 | 0 | Clamp to the inclusive range. |
| `sonic.extras.synth.effects.tremolo` | number, 0–1 | 0 | Clamp to the inclusive range. |
| `sonic.extras.synth.effects.pitch_shift` | number, -24–24 semitones | 0 | Clamp to the inclusive range. |
| `sonic.extras.synth.effects.bitcrusher` | integer, 0–16 bits of reduction | 0 | Clamp to the inclusive range. |
| `sonic.extras.synth.effects.flanger` | number, 0–1 | 0 | Clamp to the inclusive range. |
| `sonic.extras.ambient_sample` | optional owner-managed asset identifier, string ≤255 | absent | Reject external URLs and treat malformed values as absent. |

Persistence is split by piece family: structured scene versions persist the
additive `sonic` field in the canonical scene document, while generated
versions persist it in the existing JSON metadata field. Existing readers
that only understand `sound` continue to work, and canonical routes retain
their current privacy boundary. This is a backward-compatible additive
contract under Rule 5; no existing route or export signature is removed or
reinterpreted.

## Profile photo upload/removal (#824)

Authenticated owners may `POST multipart/form-data` with an `image` field to
`/api/account/profile/image/`, or `DELETE` that endpoint to remove the stored
photo. Accepted uploads are PNG, JPEG, GIF, or WebP, are normalized to PNG,
and are limited to 2 MiB before and after normalization. Invalid files return
an accessible structured 400 response and do not replace the current image.
The response is the normal profile payload with the additive
`profile_image_url` pointing at `/api/profile-images/<handle>/`. That image
route is readable by the owner even while private and by anonymous visitors
only when the profile is public; foreign/private requests return 404.

## Public collection download (#823)

`GET /api/public/collections/<handle>/<slug>/download/` is an anonymous,
publication-gated additive endpoint. For a published collection it returns an
`application/zip` attachment named `<slug>.zip` containing
`collection.json`, a complete ordered public collection manifest with the
collection metadata and visibility-safe item records (titles, kinds, viewer
URLs, and thumbnail URLs). Private, deleted, missing, and unpublished
collections return the same privacy-preserving `404` as the public detail
route. Historical collection slugs permanently redirect to the canonical
download URL. The endpoint never includes private source, prompt, credential,
or unpublished item data.

## AI art-piece generation Persona context (#743)

`POST /api/ai/art-pieces/generate/` accepts the optional owner-scoped
`persona_id` alongside `library`, `prompt`, and `model`. A Persona's prompt
text is resolved server-side and sent as a separate provider system message;
the client cannot provide arbitrary Persona text, select another user's
Persona, or make Persona context cross the generated-piece sandbox boundary.
Missing, foreign, or unknown Persona IDs behave as no Persona for backward
compatibility.

## Vendor-neutral generated art-piece generation (#811)

`POST /api/ai/art-pieces/generate/` accepts an additive `vendor` field with
`mistral`, `gemini`, or `deepseek`; omitted values remain `mistral` for
backward compatibility. The selected vendor's owner-scoped credential and
the request/saved model are used for both generation and refinement—there is
no fallback to another vendor. The selected model must be an active AI-model
catalog entry flagged for `art_piece` before a provider call is made. Missing
or undecryptable credentials return the existing structured
`personal_key_required` response.

## AI model catalog capabilities (#817)

Admin AI model catalog entries expose `native_schema`, a boolean capability
flag that defaults to `true`. It is returned by `GET /api/admin/ai-models/`
and may be supplied on catalog create/update requests. It records whether a
model natively supports the provider's structured JSON-schema mode; the
structured-output routing that consumes this flag is tracked separately in
#816. Existing rows retain native-schema behavior through the additive default.

## Generated-piece sandbox and embed boundary (#741)

Generated preview source runs in an opaque `iframe sandbox="allow-scripts"`
with a strict injected Content-Security-Policy. `allow-same-origin` is
intentionally not granted: generated code does not need the app origin, and
the opaque origin prevents access to cookies, local storage, and credentialed
app APIs. The parent validates the iframe window identity and a versioned,
allowlisted command bridge; camera and hand-tracking permissions remain in the
trusted parent runtime. Exported local runtimes are separate artifacts and do
not carry app credentials.

## Piece URL slug (#750)

`Project`, `Project3D`, and `ArtPiece` responses include `public_slug`. The slug is set once from the title at
creation and never follows later title edits. `PATCH /api/projects/<id>/`, `/api/projects3d/<id>/`, and
`/api/art-pieces/<id>/` accept `public_slug`: it is normalised to the URL-safe form, must contain a letter or
number, and must be unique among the owner's pieces of that family (soft-deleted pieces keep reserving their
slug); a violation is a 400 ("This slug is already in use."). **Old slugs are not redirected** (owner decision):
after a change the previous `/users/@handle/pieces|edit/<old-slug>` URLs stop resolving (404). Existing pieces
keep their current slug; no migration.

## Art-piece ink layer (#776)

`ArtPieceVersion` responses (owner, public, and canonical projections) include the additive
`ink` field: a validated `drawingDocument` (`schema/scene3d.schema.json#/$defs/drawingDocument`,
the same vocabulary as a 3D drawing plane) drawn over a generated **2D** piece, or `null`.
It is stored in `generation_metadata["ink"]`, so there is no migration, and the generated
`source` is never edited.

Version-create requests may send `generation_metadata: {"ink": <document>}` to set the ink,
`{"ink": null}` to clear it, or omit `ink` to inherit the previous version's ink (so a
source-only edit or an AI refinement never drops it). Ink on a 3D piece, an invalid
document (shape/point/payload limits, unknown shape types, non-hex colours), or a duplicate
shape id is a 400. Versions stay immutable: changing ink creates a new version.

## Art-piece camera placement (#742)

`ArtPieceVersion` responses now include the additive `camera_placement` field
when the version is returned through the authenticated owner, public, or
canonical piece projections. It is either `"overlay"`, `"background"`, or
`null`. `null` is the backward-compatible legacy/default value and resolves to
`"overlay"` in the current runtime; it does not mean that camera capture is
enabled. Camera permission, streams, frames, device identifiers, and other
camera data remain browser-local and are never accepted or returned by the
backend.

Version-create requests may include `camera_placement` with the same two
values. Omitting it stores `null` and preserves the legacy overlay behavior.
Any other value is rejected as a request validation error. Existing immutable
version semantics apply: placement is fixed when the version is created and
cannot be patched later; a new version must be created to change it.

The frontend resolves `null` to `"overlay"` for regular and immersive viewers
and for the Full ZIP runtime. The selected value is propagated as runtime
configuration only. Full ZIP exports preserve the resolved placement and
Non-Camera exports omit camera runtime/configuration entirely; neither export
variant contains a camera frame or secret.

## Public art-piece presentation metadata (#822)

Anonymous public and canonical generated-art-piece projections include the
additive `current_version.presentation` object when a piece declares its
rendering dimensions. It is an allowlisted presentation contract containing
either `aspect_ratio` (a positive number or `"width:height"` string) or
positive `width` and `height` values. It contains no provider, prompt, model,
or other arbitrary `generation_metadata` fields. Authenticated owner
projections continue to expose the full `generation_metadata` object. Public
regular, immersive, and embed viewers use this safe projection to preserve
the same stage framing across routes; missing metadata retains the historical
16:9 fallback.

## Public 3D piece version summaries (#731)

The anonymous public 3D piece payloads returned by
`GET /api/public/projects3d/<id>/` and the `type: "3d"` projection inside
`GET /api/users/@<handle>/pieces/<slug>/` remain privacy-gated to published,
non-deleted projects with a current version. They retain all existing fields
and additionally include:

- `description`: the public description from the project's validated
  `seo_config.description` value, or `""` when that value is absent;
- `versions`: every saved version as `{sequence, created_at, is_current}` in
  newest-first sequence order; these summaries never include `scene_json`;
- `version_count`: the number of saved versions.

Only the current version continues to include the existing full
`current_version` projection. Private, unpublished, deleted, missing, and
versionless projects continue to return `404` without confirming existence.
The public detail and canonical-slug resolvers prefetch the bounded summary
projection so the version history does not introduce one query per version.

## Public 2D piece version summaries (#737)

The anonymous public 2D piece payload returned by
`GET /api/public/projects/<id>/` and the `type: "2d"` projection inside
`GET /api/users/@<handle>/pieces/<slug>/` retains its existing fields and
additionally includes:

- `versions`: every saved version as `{sequence, created_at, is_current}` in
  newest-first sequence order;
- `version_count`: the number of saved versions.

Only the current version includes the existing full `scene_json` projection.
The summary list never exposes scene contents or private version bookkeeping.
The public detail and canonical-slug resolvers prefetch the bounded summary
projection so the version history does not introduce one query per version.

## Project3D thumbnail refresh (#719)

`POST /api/projects3d/<public_id>/thumbnail/refresh/` is an authenticated
owner-only action for reconciling an existing `Project3D` card thumbnail with
its current `SceneVersion3D`. Each owner request re-renders the current
version, including when a non-fallback thumbnail is stale. The operation locks
the project while resolving the current-version pointer, so it never renders
an older version after a newer one becomes current.

The response is the refreshed `Project3D` serializer payload. A missing
current version returns `404`; anonymous and non-owner callers receive the
existing not-found privacy response. Rendering uses the server-owned 3D
thumbnail renderer and never executes generated scene source. Renderer
failures are stored and returned as the explicit fallback state so the owner
can retry the action later. For Project3D card payloads,
`thumbnail_is_fallback` is `true` when the current thumbnail is missing or is
an explicit fallback. The existing
`GET /api/projects3d/<public_id>/thumbnail/` image route is unchanged.

## Generated art-piece thumbnails (#716)

`POST /api/art-pieces/<public_id>/versions/<version_id>/thumbnail/` is an
owner-only multipart upload for a browser-captured thumbnail of that exact,
immutable version. Other users and anonymous callers receive the existing
not-found privacy response. The `image` part must contain a real PNG or JPEG
whose MIME type matches its magic bytes, be exactly `320x240` pixels, and be
no larger than `2 MiB`. JPEG uploads are decoded and normalized to PNG before
storage; the response and subsequent thumbnail URL therefore remain
`image/png`. Django validates and stores raster bytes only and never executes
the generated art-piece source.

The six canonical reference fixtures imported by
`import_reference_pieces import` receive deterministic trusted PNG rasters
derived from fixture metadata. Re-running the import reconciles only rows
marked with the stable `source_id`/`reference_import` marker, preserves
non-reference `ArtPiece` rows, and is idempotent. The owner-only browser
refresh flow may subsequently replace a fixture raster through the same
version-bound upload contract.

## Share-metadata diagnostic (`#717`)

`GET /__share-metadata-status` is an anonymous, credential-free diagnostic
served by the Vite web process. It reports whether the server-rendered share
metadata middleware is installed, whether `PUBLIC_SITE_ORIGIN` normalized to a
valid origin (or required the configured allow-list fallback), the last
sanitized injection error if one occurred, and whether the Django backend was
reachable when the diagnostic was requested. It never returns environment
values, URLs containing credentials, request contents, or stack traces.

The response is JSON and is intended for deployment smoke checks, not product
data consumption. A successful HTTP response does not imply metadata
injection succeeded; callers must inspect `middleware_active`, `origin_valid`,
and `backend_reachable`, and should report `last_error` when present.

## Canonical public piece and editor routes (#684)

Public profile surfaces use the following canonical, profile-nested route
grammar:

- `/users/@<handle>/pieces/<slug>` — regular view for authored and generated pieces;
- `/users/@<handle>/immersive/<slug>` — immersive view for a piece;
- `/users/@<handle>/edit/<slug>` — the owner's piece editor entry point; and
- `/users/@<handle>/collections/<slug>` plus `/users/@<handle>/collections/<slug>/immersive` — collection views.

### Owner-private generated pieces and slug collisions (#745)

The existing `GET /api/users/@<handle>/pieces/<slug>/` resolver remains the
backward-compatible canonical regular-view contract, but its generated
`ArtPiece` branch is owner-aware: an authenticated owner may resolve their
own non-published, non-deleted piece at the same profile-nested slug route
(including when the owner's profile is private). When that owner has both a
published and a non-published row with the same owner/slug, the owner view
selects the non-published row deterministically; anonymous and non-owner
requests select only the published row. If no published row is available,
anonymous and non-owner requests receive the existing `404` privacy response.

The same API projection drives the existing
`/users/@<handle>/immersive/<slug>` route, so owner-only private resolution is
available there without adding a new URL namespace. The existing
`/users/@<handle>/edit/<slug>` owner resolver and UUID/public_id endpoints are
unchanged. Private rows are never returned by profile, gallery, collection,
feed, embed, public thumbnail, or public download projections; those routes
retain their published-only boundary.

Generated `ArtPiece` slugs are unique per owner within each visibility class:
one published slug and one non-published slug may coexist for an owner. The
existing owner-scoped slug allocation and retry behavior remains in force,
and different owners may reuse any slug. The migration replacing the former
single uniqueness constraint is additive/reversible for disposable databases:
rolling back drops the two conditional constraints and restores the original
constraint, but must first remove or rename any public/private collisions
created after the migration because the original constraint cannot represent
them.

### Profile Atom feeds (#686)

`GET /users/@<handle>/feed.xml` returns the public profile's Atom 1.0 feed
with `Content-Type: application/atom+xml; charset=utf-8`. The feed is limited
to the profile's currently public, published pieces, ordered newest first and
capped at 50 entries. Each entry uses the canonical profile-nested piece URL,
an absolute self/alternate link, the published/updated timestamps, escaped
title and description text, and an HTML content projection containing the
absolute thumbnail URL, title, and description. `media:thumbnail` supplies the
absolute PNG thumbnail URL. Private, unpublished, deleted, inactive, unknown,
and non-public profiles return `404` without existence-leaking payloads.

The response includes `ETag`, `Last-Modified`, and a public revalidation cache
policy; matching `If-None-Match` or `If-Modified-Since` requests receive
`304 Not Modified`. RSS, JSON Feed, collection feeds, and the HTML feeds page
are separate contracts.

### Profile RSS feeds (#687)

`GET /users/@<handle>/feed.rss` returns the same privacy-filtered, newest-first
and 50-entry-capped public piece projection as the Atom feed, serialized as RSS
2.0 with `Content-Type: application/rss+xml`. The channel includes absolute
self, profile, description, and `lastBuildDate` metadata. Each item includes
an escaped title, canonical permalink/guid, RFC 822 publication date, CDATA
HTML description with thumbnail/title/description, an absolute PNG enclosure,
and `media:thumbnail`. It shares the Atom feed's 404 privacy boundary and
`ETag`/`Last-Modified`/304 public-cache behavior. Atom, JSON Feed, collection
feeds, and the HTML feeds page remain separate contracts.

The piece engine is a capability/data value (Three.js, p5.js, C2.js, C2.js
Interactive, A-Frame, or SVG), not a second URL namespace. Public gallery,
profile, collection, feed, Open Graph, embed, and editor serializers emit the
canonical paths above whenever a public handle and name-derived slug exist.
The legacy `/p/:id`, `/p3d/:id`, `/art-pieces/p/:id`, `/art-pieces/immersive/:id`,
`/immersive/p3d/:id`, and historical `/ai-projects/:id`,
`/ai-projects3d/:id`, `/projects/:id`, and `/projects3d/:id` paths remain
documented compatibility shims; they are not emitted as new public links.
Reserved namespace words (`pieces`, `collections`, `immersive`, `edit`,
`feed`, and `feeds`) cannot be allocated as public collection slugs.

The authenticated owner editor resolver
`GET /api/users/@<handle>/edit/<slug>/` returns the private owner payload for
the matching structured 2D project, structured 3D project, or generated art
piece. Its response includes `type` (`2d`, `3d`, or `generated`) and the
existing resource `piece`; it never exposes a private piece to another user.
The frontend uses this resolver to keep the canonical editor URL stable while
mounting the appropriate unified workspace. Legacy ID editor routes remain
compatibility shims and do not become new links.

Authenticated 2D and 3D project serializers also expose `editor_url` when the
owner has a profile handle and a generated public slug. Gallery creation
initializes the profile before creating a project and uses this canonical URL
directly; it does not emit the historical project-ID editor paths.

### AI edit target references (#661)

The 2D AI create/edit request bodies may include an optional `target_ids`
array. The editor sends stable scene IDs, never display labels. Selecting a
layer or group expands the request to include its descendant IDs; selecting a
locked item or a draw.io graph node is presented as disabled and does not send
an ID. Plain text that merely resembles a label is not treated as a target.
The field is additive and omitted by older clients. The agent-run request
continues to use its existing `selected_target_ids` field.

### 3D AI edit target references (#662)

The 3D AI create/edit request bodies accept the same optional `target_ids`
array. For edits, the server validates every submitted ID against the
validated `scene3d` document before calling the provider; invalid or
cross-scene IDs receive the existing request-invalid response. The provider
prompt receives validated stable IDs so the patch reference guard scopes the
edit to selected objects, groups, lights, camera, materials, or declared
media assets. Create requests accept the additive field for client symmetry
but have no existing scene against which to validate it.

### AI edit delete intent (#812)

Removing a whole 2D shape, layer, group, binding, graph node/connection, or
3D object/group/light is allowed only when the edit prompt contains an
explicit delete verb (`delete`, `remove`, `erase`, `clear`, or `get rid of`)
and identifies the exact element by name, id, or 1-based ordinal such as
`layer 1`. A prompt that merely edits an element, or a destructive patch aimed
at another element, returns HTTP 422 with `error: "delete_intent_required"`.
Whole-item replacements that drop or change an existing element id use the
same guard. Property-level removal remains non-destructive. Bulk deletion is
allowed only when the prompt names the element class (for example, `delete
all layers`).

### Profile JSON Feeds (#688)

`GET /users/@<handle>/feed.json` returns the same privacy-filtered,
newest-first and 50-entry-capped public piece projection as the Atom and RSS
feeds with `Content-Type: application/feed+json`. The JSON Feed 1.1 document
includes `title`, absolute `home_page_url`, absolute `feed_url`, and an
`authors` profile entry. Each item includes an absolute permalink `id`/`url`,
title, summary, HTML content with thumbnail/title/description, absolute
thumbnail `image` and `banner_image`, published/modified timestamps, and
engine/kind tags. It shares the other profile feeds' privacy boundary,
404 behavior, ETag/Last-Modified validators, and public cache policy.

## Published AI-agent guidance files (#585)

`GET /llms.txt` and `GET /llms-full.txt` are anonymous, public
`text/plain` resources generated from the current published site structure
and bounded public SEO/AEO metadata. They are generated at request time so a
published CMS/site-structure or site-level metadata change is reflected on
the next request without a manual artifact edit or deployment.

`/llms.txt` is the concise orientation document; `/llms-full.txt` is the
expanded bounded inventory of published CMS pages and canonical public
profile, collection, and piece routes. Both use deterministic ordering and
safe text serialization. Draft, deleted, private, unpublished, credential,
provider-identity, billing, admin, account-management, and other internal
data or routes are excluded. Existing routes and API contracts remain
backward-compatible.

## Structured AI-run plans (#656)

`GET /api/ai/runs/<id>/` and the response from `POST /api/ai/runs/` expose a
persisted `plan` object before any provider attempt is made:

```json
{
  "revision": 1,
  "scope": "scene",
  "steps": [{"id": "step-1", "action": "generate_scene", "target_ids": []}],
  "target_ids": [],
  "success_criteria": [
    {"type": "renders_nonblank", "parameters": {"target": "scene"}}
  ]
}
```

The plan `scope` is one of `targets`, `layer`, `scene`, or `overhaul` and is
persisted with the run before any provider attempt. `targets` and `layer`
permit changes only to the declared IDs and their contained/owned children;
`scene` permits edits anywhere but preserves every existing element ID; and
`overhaul` permits replacement or addition anywhere but also preserves every
existing element ID. A scope violation is rejected when the candidate is
applied, even if the prompt mentions an out-of-scope element. Whole-element
deletion remains subject to the explicit delete-intent contract documented for
AI edits.

The only success-criteria types are `object_exists`, `property_equals`,
`count_between`, and `renders_nonblank`. Target IDs are stable scene element
IDs and are validated against the current target scene for edit/selection runs;
unknown IDs or criterion types are rejected before implementation. Existing
runs created before this field was added remain readable with `plan: null`.
Plan revisions are additive and immutable once stored; a future revision is a
new plan object rather than an in-place mutation.

## AI-run plan evaluation and retries (#657)

Each run snapshots the owner's `AIRetryPreference` at start as
`auto_retry_enabled` and `max_retries`; changing the preference never changes
an already-running run. A disabled preference permits exactly one provider
attempt. An enabled preference permits one initial attempt plus the stored
retry count, bounded by the server's maximum attempt policy. The run detail
includes `criterion_results` (one entry per attempt), `retries_remaining`, and
the snapshotted retry settings.

After every schema-valid provider result, the server evaluates every
`plan.success_criteria` item. A run becomes `awaiting_review` only when all
criteria pass. A failed evaluation stores per-criterion feedback in
`validation_summary`, includes that feedback and the current edit scene in the
next provider prompt, and retries only while the run's retry budget remains.
Failed attempts never populate `candidate_scene` or `candidate_patch`; only a
fully passing attempt can be accepted. Cancellation and exhausted retry
budgets are terminal. The run quota counter is charged once for every provider
call, including failed and automatically retried calls.

## Generated art-piece refinement (#658)

`POST /api/art-pieces/<public_id>/refine/` is owner-only and accepts an
`instruction` plus optional `target_references`. It creates a persisted refine
run containing a bounded plan, retry snapshot, attempt count, and the latest
provider `edits` result. Each edit is `{search, replace}`; the server requires
every search to match exactly once after whitespace normalization and applies
the complete edit set to a copy of the current source. Ambiguous, unmatched,
engine-invalid, or validation-failing output rejects the whole attempt and
feeds the real current source plus failure feedback into the next attempt.

Only an all-valid attempt creates the next immutable `ArtPieceVersion` and
moves the piece's `current_version` pointer. Failed or cancelled runs leave
the stored source unchanged. The run snapshots `AIRetryPreference`, charges
the art-piece rate and daily quota counters once per provider call, and
supports all registered generative engines. Private pieces and runs remain
owner-scoped and return `404` to other users.

The owner editor discovers refinement targets from the current source using
the explicit marker `data-augmentr-part="<stable-id>"` on a declared element,
or the JavaScript comment form `@augmentr-part <stable-id>`. Media targets
use `data-augmentr-asset="<stable-id>"` or `@augmentr-asset <stable-id>`;
the editor sends only IDs selected as chips, never display labels. A source
with no part markers still exposes its discovered assets and a hint that no
parts were declared.

## Generated art-piece regions (#818)

`POST /api/ai/art-pieces/generate/` keeps the existing `library`, `code`, and
`usage` fields and adds `regions` plus `warnings`. `regions` is an ordered
array of `{name, start, end}` entries using 1-based inclusive source-line
boundaries. JavaScript-like engines use `// @layer Name` markers; SVG uses
`<g id="Name">` groups; markup engines may use the equivalent HTML comment
marker. Duplicate names receive numeric suffixes (`Name 2`, `Name 3`, ...).
Missing markers are non-blocking and return an empty `regions` array plus the
`missing_layer_markers` warning.

## Generated art-piece refinement mentions (#819)

`POST /api/art-pieces/<public_id>/refine/` accepts an additive `mentions`
array of at most 10 `{kind, id}` objects. `kind` is one of `ink`, `asset`,
`element`, or `region`; each id is bounded to 200 characters. The server
resolves mentions against the current piece source and metadata, then appends
a bounded structured target block to the provider prompt. An unknown or
owner-inaccessible mention returns HTTP 422 with `error: "unresolved_mention"`
and no provider call or refine run is created.

## Global site metadata settings (#586)

The application-admin-only `GET|PATCH /api/admin/settings/` contract includes
`site_description` (a bounded plain-text description) and `metadata_tags` (a
bounded list of unique plain-text tags). Existing settings keep deterministic
empty defaults. Updates use the existing optimistic-concurrency `revision`
field; malformed or oversized values are rejected atomically. The anonymous
`GET /api/site-theme/` projection may include these safe public fields for
metadata consumers, but never exposes admin-only settings or sensitive data.

## Server-rendered public share metadata (#653)

The anonymous `GET /api/public/share-meta/<kind>/<public_id>/` endpoint is a
privacy-gated projection used by the SPA web server when it builds no-JS HTML
for public piece routes. `<kind>` is one of `2d`, `3d`, or `generated`; a
private, unpublished, deleted, missing, or versionless item returns `404`
without confirming its existence. A successful response contains only the
public title, description, canonical path, and `image_url`; `image_url` is
`null` when the current thumbnail is explicitly marked fallback.

`GET /api/public/share-image/<kind>/<public_id>.png` returns a public,
opaque `1200x630` PNG share image made by fitting the stored current
thumbnail into the share-card dimensions. It applies the same publication
gate as the metadata endpoint and never executes generated art source. These
routes are additive; the existing card thumbnail URLs remain unchanged.

The same metadata service provides anonymous projections for the site shell:

- `GET /api/public/share-meta/site/home/` returns configured site title,
  description, `/` canonical path, and the default share image.
- `GET /api/public/share-meta/site/profile/<handle>/` returns a public
  profile title (`<display name> on AugmentrART`), a bio truncated to 200
  characters, and the profile avatar or best available public-piece image.
- `GET /api/public/share-meta/site/collection/<handle>/<slug>/` returns the
  public collection title, description, canonical path, and the first real
  member thumbnail when available.

Missing or private profile/collection lookups receive generic site metadata;
they never expose profile or collection fields. The Vite dev/preview server
injects these projections into `/`, `/users/@<handle>`, and
`/users/@<handle>/collections/<slug>` together with an escaped canonical
`<link>` tag.

## Public profile handles (#551)

`GET /api/account/profile/` assigns a deterministic handle on first access when
the authenticated profile has none. The candidate is derived from the stable
account username, normalized to the handle grammar, and receives a numeric
suffix when needed; reserved application words are rejected and replaced with
an account-specific fallback. `PATCH /api/account/profile/` requires a valid,
unused handle and returns field-level validation errors for malformed,
reserved, or already-used values without changing the previous handle.

Changing a handle creates a durable redirect-history row. A request for an old
handle at `GET /api/users/@<handle>/` returns a permanent redirect to the
current API profile URL, and the frontend updates the browser URL to the
canonical `/users/@<current-handle>` route. Redirect history is owner-scoped
through the profile relation and is never exposed in public profile payloads.

The anonymous `GET /api/users/@<handle>/` response remains backward-compatible
with its existing `profile` and `pieces` fields and additionally exposes
`collections`. Only published, public, non-deleted collections owned by the
profile are included. Each collection entry contains its public `id`, `title`,
`slug`, canonical `viewer_url`, a first-public-member `thumbnail_url` when one
exists, and `item_count`; `item_count` and the thumbnail are computed from
publicly eligible members only, so private or unpublished members are never
leaked through the profile projection.

Each entry in the profile's `pieces` array includes `owner`, using the same
public attribution rule as gallery items: display name first, current public
handle as the fallback. Public piece detail payloads use that same resolved
attribution for visible author text and metadata.

`GET /api/account/profile/` returns `503 {"detail": "Profile settings are
temporarily unavailable."}` instead of an unhandled `500` when the database
is missing a schema element the view depends on (a pending migration not yet
applied to that environment), for both ordinary and application-admin
accounts (#571).

## Profile style catalog (#552)

`GET /api/account/profile/` returns the current `style_key` and an
`available_styles` catalog containing only enabled, server-managed styles.
`PATCH /api/account/profile/` accepts `style_key`; unknown or newly disabled
styles return field-level validation errors, while an existing assignment
remains readable after an administrator disables it. `theme_config` remains a
validated token-only compatibility override and cannot contain CSS, HTML, or
JavaScript.

## Vendor-aware saved AI models (#553)

`GET|POST /api/account/mistral-model-preferences/` remains supported as a
Mistral-only compatibility route. The canonical saved-model payload now also
contains `vendor`; `POST /api/account/ai-model-preferences/` accepts a
registered provider vendor, a provider-specific model slug, and an optional
label. Entries are owner-scoped, duplicate `(owner, vendor, slug)` entries
are rejected, and invalid or unknown providers return validation errors.
`GET /api/account/ai-model-preferences/` returns only the authenticated
owner's entries; no provider credential or secret is returned.

The assistant's vendor selector filters saved models to the selected vendor
and clears an incompatible model before submission. Existing Mistral records
and the legacy Mistral endpoint remain backward-compatible.

Application administrators can use `GET|POST /api/admin/profile-styles/` and
`PATCH /api/admin/profile-styles/<id>/` to manage the finite catalog. Anonymous
callers receive `401`, non-admins `403`, and updates require the current
integer `revision`. Styles contain only approved six-digit hex tokens for
`background`, `surface`, `text`, `muted`, and `accent`; paired `light` and
`dark` palettes are supported, and disabling a style hides it from new user
selections while global site settings safely fall back to the enabled
`default` style.

### Curated global/profile style system (#576)

The style catalog remains server-managed and CSS-injection-safe. Each style
may expose approved color tokens plus bounded presentation options for
typography, density, corner radius, and border treatment. `GET
/api/admin/settings/` and `GET /api/site-theme/` expose the active global
`style_key`; the site theme response also exposes the effective approved
presentation options. `PATCH /api/admin/settings/` accepts an enabled
catalog `style_key` and preserves the existing revision requirement.

`GET|PATCH /api/account/profile/` continues to expose/select `style_key` and
returns the selected style's approved presentation options. A profile whose
style is unset or `default` has no profile-specific style override: its public
profile and derivative collection surfaces inherit the effective global site
style. An explicit non-default catalog selection is an owner-scoped override
for that profile and its derivative public surfaces. The `default` catalog
entry remains available as the safe plain fallback when the global site style
itself is disabled or unavailable.
Unknown keys, malformed values, arbitrary CSS/HTML/JavaScript, and disabled
new selections are rejected or fall back to the documented defaults. Existing
legacy `theme_config` color overrides remain backward-compatible.

### Paired light/dark theme palettes (#642)

The site-settings and public-profile responses retain the legacy resolved
`theme_config` flat palette for existing consumers and additionally expose
`theme_palettes`:

```json
{
  "theme_config": {
    "background": "#0b0d12",
    "surface": "#151923",
    "text": "#f3f4f6",
    "muted": "#9ca3af",
    "accent": "#c084fc"
  },
  "theme_palettes": {
    "light": {
      "background": "#f8fafc",
      "surface": "#ffffff",
      "text": "#111827",
      "muted": "#64748b",
      "accent": "#7c3aed"
    },
    "dark": {
      "background": "#0b0d12",
      "surface": "#151923",
      "text": "#f3f4f6",
      "muted": "#9ca3af",
      "accent": "#c084fc"
    }
  }
}
```

`theme_config` updates accept either the legacy flat five-token object or an
object containing optional `light` and `dark` five-token objects. Legacy flat
values are treated as dark overrides; missing light values use the documented
default light palette. Resolution is `default palette < enabled catalog style
tokens < owner/site override`, independently for each mode. All tokens remain
exactly six-digit hexadecimal colors; unknown keys and malformed values are
rejected. The JSON fields are additive, so existing rows require no destructive
rewrite or migration.

### Shared parity theme design system (#724)

The authenticated profile and application-admin settings payloads additionally
expose the shared design contract:

- `style_key` selects one of the ten enabled layout styles;
- `palette_key` selects one of the ten named color palettes;
- `palette_overrides` contains optional per-mode semantic color overrides; and
- `presentation_overrides` contains optional validated layout overrides; and
- `design_palettes` contains the resolved semantic palettes used by the
  preview and public profile surfaces.

The semantic palette keys are `background`, `foreground`, `muted`,
`muted_foreground`, `primary`, `primary_foreground`, `secondary`,
`secondary_foreground`, `accent`, `accent_foreground`, `destructive`, and
`destructive_foreground`. Each key exists independently under `light` and
`dark`. Palette values are validated CSS colors limited to six-digit hex or
the bounded HSL form used by the original theme implementation; CSS, HTML,
JavaScript, URLs, and arbitrary declarations are rejected.

`GET /api/account/profile/` includes `available_palettes` and the selected
`palette_key`, `palette_overrides`, and `design_palettes`. Its `PATCH` accepts
those fields together with the existing optimistic `revision`; invalid palette
keys or values reject the whole update without changing the profile.

`GET|PATCH /api/admin/settings/` includes and accepts the same palette fields,
using the existing optimistic `revision` contract. `GET /api/site-theme/`
returns the effective `palette_key` and resolved `design_palettes` for
anonymous shell/profile consumers, while retaining the legacy five-token
`theme_config` and `theme_palettes` fields for older clients.

Both settings surfaces render the same iframe-backed preview document. The
preview is an inspection surface only: it receives the resolved style and
palette definition through a sandboxed `srcDoc`, and it must not execute
arbitrary application code or make network requests.

### Canonical public piece URLs (#578)

`GET /api/users/@<handle>/pieces/<piece-slug>/` resolves a published public
2D project, 3D project, or generated art piece owned by the profile. Slugs are
persisted, lowercase, normalized identifiers and are unique per owner and
piece family. A caller may provide a custom slug through the owner mutation
path; omitted slugs remain title-derived and collisions receive deterministic
numeric suffixes. Private, deleted, archived, and missing pieces return the
same not-found behavior as the existing public detail routes. The response
includes `canonical_url`, `viewer_url`, and renderer/type information.

The frontend canonical route is `/users/@<handle>/pieces/<piece-slug>`. Existing
identifier-based viewer routes remain backward-compatible shims and are not
removed. A slug change affects only the current canonical path; the existing
identifier route continues to resolve the same piece, and reverting the slug
through the owner mutation restores the prior canonical path without creating
a new version.

### Canonical generated art-piece links (#600)

Published generated art pieces in profile, gallery, and collection-card
payloads expose the owner-scoped canonical `regular_url` at
`/users/@<handle>/pieces/<piece-slug>`. The slug is the persisted
`public_slug`; callers must not reconstruct it from the title or public ID.
The existing `/art-pieces/p/<public_id>` and embed routes remain supported as
compatibility URLs while the canonical immersive and owner-editor surfaces are
completed by their respective route contracts. A canonical resolver response
includes the generated piece payload so the frontend can render the regular
piece without replacing the browser URL with a legacy identifier route.

Owner-scoped `POST /api/art-pieces/` and `PATCH /api/art-pieces/<public_id>/`
accept optional `public_slug` text. The server normalizes it with the shared
slug policy, rejects an empty normalized custom value or an owner collision,
and preserves the existing identifier route when a slug changes.

When the canonical resolver is requested by the piece author, the generated
piece response may also include `edit_url` with the owner-scoped
`/users/@<handle>/edit/<piece-slug>` path. Anonymous and non-owner responses
omit this field. Canonical viewers use the resolver's canonical URL for their
immersive link and render the edit action only when `edit_url` is present;
legacy UUID viewer and embed URLs remain compatibility shims.

### Owner art-piece editor links (#601)

`GET /api/users/@<handle>/edit/<piece-slug>/` requires an authenticated
request whose user owns the matching non-deleted art piece. It returns the
owner/editor payload used by the frontend to mount the editor at
`/users/@<handle>/edit/<piece-slug>`. Anonymous, non-owner, missing, and
deleted pieces all return the same `404` response; the endpoint never exposes
owner metadata to unauthorized callers. Existing UUID editor API routes remain
supported for compatibility.

### Shared public piece-card contract (#602)

Profile and public-gallery cards use the same presentation contract: a
fixed-ratio thumbnail, explicit accessible fallback when the URL is absent or
fails, title, renderer/engine metadata, attribution, and keyboard-visible
focus. The card component receives its destination from the surface that owns
the link; it does not infer or hard-code a viewer route.

Public profile piece entries additionally expose `slug` and `regular_url` for
every published piece family (authored 2D/3D and generated), so profile
consumers never need to reconstruct a route from an ID.
They also expose the public `description`, ISO-8601 `published_at`, and
capability `engine` values used by the editorial profile card; private and
unpublished records are excluded before serialization.

Public gallery list items additionally expose `viewer_url`; remix provenance
includes `source_viewer_url` whenever the immediate source remains public.
Clients must use those API-owned URLs rather than reconstructing renderer- or
identifier-based paths.

### Canonical immersive art-piece route (#606)

Published generated art pieces may be opened at
`/users/@<handle>/immersive/<piece-slug>`. This route resolves the same
published version and capability data as regular view but owns the viewport
with overlay controls; it does not render a page-contained fixed-height
preview. Unsupported spatial navigation is disclosed by the renderer rather
than implied. Existing `/art-pieces/immersive/<public_id>` and
`/embed/art-pieces/immersive/<public_id>` routes remain compatible.

### Explicit engine on every piece (#770)

Every public piece is tied to one rendering library. The unified public gallery
(`GET /api/public/gallery/`) and profile piece lists now carry `engine` and
`engine_label` on authored 2D and 3D rows as well as generated rows (additive
fields; existing clients are unaffected). Authored 2D pieces resolve it from the
required scene `renderer.preferred` (`p5` -> `p5js`, `canvas2d`, `svg`). Authored 3D
scenes gained an OPTIONAL top-level `renderer.preferred` (`threejs` or `aframe`,
the only two 3D engines); a scene without it resolves to `threejs`, so no stored
scene is rewritten and no migration is involved. Collections have no engine.

### Art-piece engine capability contract (#614)

Generated art-piece API payloads expose the persisted `engine` identifier and
the separate `engine_label`; clients must use the identifier for filtering,
runtime selection, and routes. The stable identifiers are `canvas2d`, `svg`,
`p5js`, `c2js`, `c2js-interactive`, `threejs`, and `aframe`. Display labels
are `Canvas 2D`, `SVG`, `p5.js`, `C2.js`, `C2.js Interactive`, `Three.js`, and
`A-Frame`. The capability registry also exposes explicit booleans for regular,
immersive, embed, download, and editor support. A false capability means that
surface is not implemented and must not be inferred from the engine label.

The three newly registered engines are accepted as stable identifiers for
forward-compatible persistence. Their regular, immersive, and downloadable
surfaces use the runtime adapters; embed and editor consumers remain
capability-gated until their dependent contracts are implemented. Existing
four-engine rows and identifier-based routes remain compatible.

### Public gallery search (#581)

`GET /api/public/gallery/search/?q=<term>&scope=accounts|content` searches
only public profiles or published public content. Account results expose only
handle/display name/link fields; content results use the existing gallery card
contract. Blank queries return an empty result set, malformed scopes or terms
over 100 characters return `400`, and ordering is deterministic.

### Admin content search (#582)

`GET /api/admin/content/?q=<term>&account=<username-or-email>` remains
application-admin-only and applies both filters to safe administrative content
metadata. `q` matches title or description, while `account` resolves an exact
email or username substring internally; email addresses are never returned in
content rows. Missing filters preserve the existing full list contract.

### Project and Project3D content SEO/AEO metadata (#588)

The owner-scoped `PATCH /api/projects/<public_id>/` and
`PATCH /api/projects3d/<public_id>/` metadata contracts accept an optional
validated `seo_config` object using the same bounded shape as collections and
generated art pieces. Owner-scoped GET/list responses include the stored
configuration. Existing rows default to `{}` and the migration is additive;
no content is deleted or rewritten.

The anonymous `GET /api/public/projects/<public_id>/` and
`GET /api/public/projects3d/<public_id>/` responses include `seo_config` only
when the project is currently published and eligible for the existing public
detail gate. Private, draft, deleted, unpublished, and unauthorized projects
continue to return the existing not-found/authorization behavior without
exposing the field.

Both public detail responses also expose `viewer_url`. When the owner has a
public profile and generated slug, it is the canonical
`/users/@<handle>/pieces/<slug>` path; legacy identifier paths are retained
only as compatibility fallbacks for records that cannot yet resolve a
canonical profile route.

The frontend public 2D and 3D viewers apply the shared content-metadata
renderer to the returned configuration, including bounded title,
description, robots, canonical, Open Graph, Twitter, and JSON-LD output.
Existing identifier-based and canonical piece routes remain unchanged.

## Account billing contract (#440, #550)

Authenticated account billing is exposed through `/api/account/billing/` and
the frontend route `/account/billing`. `GET` returns the effective plan and
the user's latest PayPal subscription status. The returned plan pricing is
read from the active persisted `Plan` row: `price` is a two-decimal string,
`currency` is a three-letter code, and `interval` is the billing interval.
`POST` accepts a server-created
idempotency key and a published active plan key, creates a PayPal sandbox
subscription with the authenticated user's id as the provider correlation,
and returns only a provider approval URL plus an opaque checkout id. The
server records the checkout correlation before returning and never trusts
return-query parameters as proof of payment. PayPal webhook verification and
the existing billing service are the only paths that change subscription or
entitlement state.

The endpoint returns `401` for anonymous callers, `400` for malformed or
inactive plans, `409` for an idempotency-key conflict, `502` for an upstream
PayPal failure, and `200` for a status or successful idempotent retry. The
response contains no client secret, access token, raw provider payload, or
unverified entitlement claim.

Issue #550 adds subscriber self-service without changing webhook authority.
`GET` may return `subscription.can_manage`, `subscription.can_cancel`, and
`subscription.manage_url` for an active provider-backed subscription. The
manage URL is PayPal's hosted subscriptions page and is informational only;
the app never embeds or collects PayPal credentials. `POST` accepts
`{"action":"cancel","reason":"..."}` for the authenticated owner. The
server requests cancellation from PayPal, returns `202` with
`{"outcome":"pending_webhook"}`, and does not mutate the local subscription
until a verified webhook arrives. Missing subscription, already-terminal
state, provider failure, and malformed reasons return finite `400`/`502`
responses. Cancellation preserves the existing `paid_through` entitlement
policy.

### PayPal sandbox operator verification

The deterministic tests mock the approval transport; they do not create a
provider subscription. For the separately authorized sandbox roundtrip, use
the same `PAYPAL_MODE=sandbox` app credentials locally and in Replit, and keep
the existing webhook endpoint configured for the deployment being tested. Open
`/account/billing` as a fixture or sandbox buyer account, select the displayed
paid plan, and click **Subscribe with PayPal**. PayPal redirects to its
sandbox approval page: sign in there with a PayPal **sandbox personal/buyer**
account, not the sandbox business account that owns the app, then approve the
subscription. Return to the app and verify the subscription status only after
the webhook arrives. The server-side webhook remains the authority; the
browser return URL alone never grants paid access.

For local testing, the webhook must target the active HTTPS forwarding URL
for the local Django endpoint. Do not replace the Replit webhook with the
localhost-forwarding URL; maintain one provider webhook per target environment
or switch the callback only for the short local test and restore the deployed
URL immediately afterward. No production PayPal account or charge is needed.

This document is the canonical contract for the anonymous public gallery
listing API. It exists because the repository pre-write rule requires any
public API contract change to be documented **before** the product source
that implements it. Current contract owner: issue
[#491](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/491)
("Public gallery: unify authored and generated pieces with a visible type
filter").

## Endpoints at a glance

| Endpoint                             | Status                                                |
| ------------------------------------ | ----------------------------------------------------- |
| `GET /api/public/gallery/`           | **Canonical** unified listing (this document, #491).  |
| `GET /api/public/projects/`          | Legacy — frozen; unchanged response contract.         |
| `GET /api/public/art-pieces/`        | Legacy — frozen; unchanged response contract.         |
| `GET /art-pieces/gallery` (frontend) | Legacy route — redirect/shim to `/gallery?type=generated`. |

The two legacy API endpoints are **not** repurposed, extended, or removed by
the unified endpoint. Their existing response shapes (`results` keyset pages
for `/api/public/projects/`, an unpaginated list of public piece payloads for
`/api/public/art-pieces/`) remain stable for existing consumers; new gallery
work targets `/api/public/gallery/` only.

The legacy frontend route `/art-pieces/gallery` (currently
`PublicArtPieceGallery`) is also preserved: it must keep resolving, as a
backward-compatible redirect or shim rendering the unified gallery with its
type filter pre-set to **Generated** (`/gallery?type=generated`). The route is
never silently deleted.

## CMS pages (#517)

CMS pages are a separate content family from user artwork/projects. Public
page reads are published-only and expose bounded presentation metadata; drafts,
soft-deleted pages, private author data, and admin audit fields are never
returned. A renamed page preserves its old slug through a redirect record and
the canonical page is addressed by its current slug.

| Endpoint | Contract |
| --- | --- |
| `GET /api/pages/` | Anonymous navigation projection of published CMS pages marked `show_in_nav`, ordered by `sort_order`, title, and id; returns only `title`, `slug`, `nav_label`, and `sort_order`. Draft, deleted, and non-navigation pages are omitted. |
| `GET /api/pages/<slug>/` | Anonymous published-page read; returns `200` for the canonical page, `301` for a recorded old slug, and `404` for missing/draft/deleted pages. |
| `GET /api/admin/pages/` | Application-admin-only list of active published/draft pages with title, slug, status, updated time, author, navigation metadata, and revision. Anonymous callers receive `401`; non-admins receive `403`. |
| `POST /api/admin/pages/` | CSRF-protected application-admin create with bounded title, slug, description, status, navigation metadata, and optional system key. |
| `PATCH /api/admin/pages/<id>/` | CSRF-protected optimistic-concurrency update requiring the current `revision`; slug changes create redirect history. Supports publish/unpublish and navigation metadata changes. |
| `DELETE /api/admin/pages/<id>/` | CSRF-protected soft-delete. Required system pages cannot be deleted. |

Admin responses include `updated_by` as a display name only; no email,
provider identity, credentials, prompt, or billing data is exposed. Reserved
application paths and duplicate slugs are rejected. Public project and gallery
routes remain unchanged.

## `GET /api/public/gallery/`

Anonymous-reachable paginated listing merging published pieces and public
collections:

- **2D** — published `Project` records (authored canonical-scene pieces),
  eligible under exactly the same gate `scenes.gallery.eligible_projects`
  applies for the legacy `/api/public/projects/` endpoint
  (`visibility == public`, not soft-deleted, has a current version, and
  `published_at is not null`).
- **3D** — published `Project3D` records, eligible under
  `scenes.gallery.eligible_projects3d` (same gate shape).
- **Generated** — published generated `ArtPiece` records, eligible under
  exactly the same publication gate `PublicArtPieceListView` (the legacy
  `/api/public/art-pieces/` endpoint) applies
  (`scenes.art_piece_persistence.eligible_art_pieces`:
  `status == ArtPiece.Status.PUBLISHED`, joined owner and current version;
  soft-deleted pieces are excluded by the model's default manager).
- **Collections** — published `Collection` records whose owner has an enabled
  public profile and handle; soft-deleted and private collections are
  excluded. Collection cards use the canonical `/users/@handle/slug` viewer
  path and never expose member metadata in the gallery card.

Anonymous and signed-in requests receive **identical** response bodies: the
view never branches on `request.user`. No private or editing fields (scene
JSON, prompts, draft/session data, tags, descriptions, owner emails,
visibility/status internals) ever appear in any item.

### Query parameters

| Parameter   | Rule                                                                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`      | `all` (default when omitted; pieces and collections) \| `pieces` (2D + 3D + generated) \| `collections` (collections only) \| legacy `authored`/`generated` aliases. Any other value → **HTTP 400**. |
| `engine`    | Optional server-supported generated engine (`canvas2d`, `svg`, `p5js`, `c2js`, `c2js-interactive`, `threejs`, or `aframe`). It composes with `type`; authored-only results are empty. Any other value → **HTTP 400**. |
| `cursor`    | Opaque keyset token from a previous response's `next_cursor`. Malformed, or bound to a different `type` (see below) → **HTTP 400**.         |
| `page_size` | Positive integer, default `24` (`DEFAULT_PAGE_SIZE`), clamped to `60` (`MAX_PAGE_SIZE`); a non-integer value → **HTTP 400**. Same shape as the legacy `/api/public/projects/` endpoint. |

Error bodies are finite JSON. An invalid filter:

```json
{ "errors": { "type": ["Must be one of: all, pieces, collections, generated."] } }
```

The response also includes `engine_catalog`, an array of registry-derived
`{value, label, count, available}` entries for every stable engine. `available`
is false when the selected type has no published results for that engine;
registered-but-not-yet-implemented engines remain visible with explicit false
capabilities and must not be treated as runnable. The frontend uses this
catalog for its engine control and keeps the selected engine in the shareable
URL.

## Signup-time cloud-sync consent (#524)

A brand-new social-login account (Google/GitHub -- local password signup
remains closed) is shown an explicit, one-time choice between "Keep projects
local only" (pre-selected default) and "Enable optional cloud sync" before
the account is created. `LinkedProvidersSocialAccountAdapter.is_auto_signup_allowed`
(`backend/backend/social_account_adapter.py`) always returns `False` for a
genuinely new identity, so allauth's standard social-signup form
(`socialaccount/signup.html`, `POST /accounts/3rdparty/signup/`) is shown
instead of auto-creating the account; a returning user signing in through an
already-linked identity never reaches this form and is never re-prompted or
changed.

The extra `cloud_sync_choice` field (`backend/backend/social_signup_forms.py`'s
`CloudSyncSignupForm`, wired in as `SOCIALACCOUNT_FORMS['signup']`) only
offers "Enable optional cloud sync" while the site-wide
`SiteSettings.cloud_sync_enabled` switch is on; a forged/replayed request for
that value while the switch is off is rejected with a validation error, and
omitting the field entirely is rejected the same way -- there is no blank or
implicit choice. The pending social login is cleared from the session as
soon as the form is submitted once, so a duplicate/replayed POST has no
sociallogin to finalize and is redirected to the login page rather than
creating a second account.

The choice is recorded exactly once, at account creation, as a
`CloudSyncSignupConsent` row (`owner` one-to-one, `sync_enabled`,
`decided_at`). This is only an account-level preference record: choosing
"enabled" here creates no `CloudBackupProject` row and uploads no content --
a project must still be explicitly opted in through the existing
`POST /api/projects/<public_id>/cloud-backup/` flow below, which
independently re-enforces the site-wide switch and the `cloud_project_sync`
entitlement.

The same signup form also nudges for browser persistent storage (issue
#525), alongside a one-line privilege summary for each: cloud sync
("Uploads an opt-in backup copy of a project to our servers so it survives
clearing this browser") and persistent storage ("Asks this browser not to
automatically delete your local project data when device storage runs
low"). Unlike the cloud-sync choice, persistent storage is a pure browser
permission with no server-side record -- a plain (non-Django-form) checkbox,
checked by default, triggers a best-effort, fire-and-forget
`navigator.storage.persist()` call on submit that never blocks or delays
account creation and never claims a result the browser didn't actually
report. The real granted/denied state is always readable afterward, and
re-requestable, from the local storage dashboard below (issue #525).

## Scheduled cloud-backup snapshots (#530)

The server never pushes a snapshot on its own -- it has no independent copy
of a project's media (an `"image"` shape's `mediaAssetId` only ever resolves
against the browser's own local IndexedDB media library, #508/#512). Instead,
`GET`/`POST /api/projects/<public_id>/cloud-backup/` (below) additionally
return `snapshot_cadence_days`, `snapshot_archive_enabled` (both resolved
from the owner's current `Plan`), and `last_snapshot_at` (the most recent
manifest's timestamp, or `null`). The frontend (`useCloudBackupSchedule`,
`storage/cloudSnapshot.ts`) reads these once whenever a cloud-sync-eligible
project opens and, if due, silently builds and pushes one snapshot through
the existing manifest/asset endpoints below -- no repeating background timer,
no user-facing prompt, and a missed/failed check is simply retried next time
the project opens.

Per the #529 policy: the free plan defaults to a 7-day cadence with
`snapshot_archive_enabled=False`; paid/admin default to a 1-day cadence with
archiving on. When `snapshot_archive_enabled` is false, `PUT .../manifest/`
atomically trims every manifest revision except the one just written and
deletes any blob no longer referenced by it, immediately after that write --
"only the latest snapshot" applies to every manifest write on such a plan,
not only ones a client marks as "scheduled." An archive-enabled plan keeps
full history, governed only by the existing #522 retention policy below.

## Cloud backup protocol (#509)

Cloud backup is an authenticated, owner-only, provider-neutral protocol for
the local-first project repository. It is disabled unless the singleton
`SiteSettings.cloud_sync_enabled` is true; the server rejects sync requests
before entitlement or storage access when it is false. PostgreSQL BLOBs are
the initial provider implementation. Local projects and exports never depend
on these endpoints.

| Endpoint | Contract |
| --- | --- |
| `POST /api/projects/<public_id>/cloud-backup/` | Body `{\"enabled\": true}` explicitly opts a project into backup. `409` is returned for a disabled site switch or read-only backup. |
| `GET /api/projects/<public_id>/cloud-backup/manifest/` | Returns the owner's latest manifest and revision, or `404` when no backup exists. |
| `PUT /api/projects/<public_id>/cloud-backup/manifest/` | Body `{\"revision\": n, \"idempotency_key\": \"...\", \"manifest\": {...}}`. `revision` must be the current revision; a replay is idempotent and a stale write returns `409`. |
| `PUT /api/projects/<public_id>/cloud-backup/assets/<asset_id>/` | Stores one binary asset with `X-Asset-Checksum`, `X-Idempotency-Key`, and `X-Asset-Mime-Type`. Replays with the same checksum are idempotent; a mismatch returns `409`. |
| `GET /api/projects/<public_id>/cloud-backup/assets/<asset_id>/` | Returns the stored bytes for the owner while the backup is readable. |

Cloud-sync entitlement and controls (#511)

The server-resolved `cloud_project_sync` entitlement is required before a
project can be enabled for remote backup. A missing or inactive plan and an
explicit deny override fail closed. The account UI may explain this state
without reading project content. Local project operations and exports do not
depend on the entitlement or backup provider.

`POST /api/projects/<public_id>/cloud-backup/` accepts `{"action":
"enable"}` or `{"action": "pause"}` for the authenticated owner. Enable
requires the entitlement; pause is always allowed for an existing owner
backup. A paused backup remains locally usable and its existing remote copy is
retained, but future manifest/blob writes return `409` with
`cloud_backup_paused`. Entitlement loss uses the same read-only retention
boundary. Provider/network failures are surfaced as retryable client errors;
they never delete local data.

## Offline mutation acknowledgement protocol (#543)

The offline editor uses a separate authenticated mutation endpoint for
cloud-synchronizable mutations. It is deliberately not the cloud-backup
manifest endpoint: a mutation is an operation in the deterministic outbox,
not a replacement snapshot. The endpoint records the operation receipt and
returns the same acknowledgement for a replay of the same operation.

| Endpoint | Contract |
| --- | --- |
| `POST /api/projects/<public_id>/sync/mutations/` | Authenticated owner-only operation receipt. The JSON body contains `operation_id`, `client_sequence`, `kind` (`scene`, `metadata`, or `media-reference`), `payload`, `payload_checksum`, `schema_version`, `dependency_operation_ids`, and optional `client_created_at`. The first accepted operation returns `201`; an identical replay returns `200` with `replayed: true`. |

The server scopes operation identity to the authenticated owner and project.
Reusing an operation ID with a different checksum or payload returns `409`;
reusing a client sequence for a different operation also returns `409`.
Anonymous callers and non-owners cannot discover a project's mutation receipt.
The receipt is an acknowledgement journal for the sync/conflict stages; it
does not enable offline generation, publishing, gallery reads, or AI flows.

### Deterministic conflict resolution (#544)

A scene conflict-resolution payload uses this additional shape:

```json
{
  "type": "conflict-resolution",
  "base_version": "<SceneVersion id>",
  "choice": "keep-local | keep-remote | compose",
  "resolved_payload": {"...": "validated scene snapshot"},
  "audit": {
    "conflict_paths": ["..."],
    "local_operation_ids": ["..."],
    "remote_operation_ids": ["..."]
  }
}
```

The server locks the owner’s project, compares `base_version` with the
authoritative current version, validates the resolved snapshot, and creates a
new immutable `SceneVersion` only when the base is still current. A stale base
returns `409` with the authoritative remote snapshot and the preserved base,
local, remote-operation, and affected-identity context; no receipt or version
is created. The accepted receipt stores the resulting version link, so an
identical replay returns the same applied version without creating a second
version. Artwork-bearing data never uses last-write-wins.

The status GET returns `404` when the owner has not opted the project in yet;
the editor treats that as the ordinary “Enable cloud sync” state. A `409`
from enable explains that the account is ineligible without uploading content.

The manifest is JSON metadata only and must include stable scene/asset IDs;
asset records include a checksum and byte size. The configured plan quota is
checked before a new blob lands. Entitlement loss marks the backup read-only
and retains it; account deletion purges the backup. A future entitlement/UI
issue owns the transition controls. The endpoints return finite error codes:
`401` unauthenticated, `403` non-owner, `404` absent resource, `409` disabled,
stale, read-only, or checksum conflict, and `413` quota exhaustion.

### Cloud-sync availability and snapshot policy (#529)

Cloud sync is available to both free and paid/admin accounts, with different
cadence and archiving:

- **Free plan:** silent scheduled snapshots on a 7-day cadence. Only the
  latest snapshot is retained — no archive of prior snapshots beyond the
  current one.
- **Paid and application-admin accounts:** silent scheduled snapshots on the
  plan's configured cadence, with archived snapshots retained per the
  existing [Cloud-media retention policy (#522)](#cloud-media-retention-policy-522)
  grace periods below.

Scheduled snapshots are silent: no per-snapshot user approval, email, or
blocking in-app notification is generated. A manual "Sync now" action remains
available on any entitled project regardless of the scheduled cadence. This
policy governs cadence and archiving only; it does not change the opt-in
consent flow (#524), the manual sync transport (#509), the entitlement
resolver (#511/#519), or the retention grace periods/purge endpoint (#522).
Implementation of the scheduled job itself is tracked in #530.

## Cloud-media retention policy (#522)

The application-owned PostgreSQL/blob lifecycle is governed by one atomic
admin policy. The approved defaults are: active copies retained while active;
deleted, entitlement-expired, and disabled-sync copies retained for 30 days;
retroactive destructive purge requires explicit confirmation. Local IndexedDB
content is never affected.

| Endpoint | Contract |
| --- | --- |
| `GET /api/admin/cloud-retention/` | Application-admin only. Returns the finite grace periods, revision, and update metadata. |
| `PATCH /api/admin/cloud-retention/` | Application-admin only. Requires `revision`, accepts the three non-negative grace periods, and rejects stale/invalid writes atomically. |
| `POST /api/admin/cloud-retention/purge/` | Application-admin only. Requires `confirm_retroactive=true` when the request may purge eligible existing copies; accepts bounded `limit` (1–100); returns scanned/purged/retained counts and policy revision. |

Each remote backup carries a retention state (`active`, `deleted`,
`entitlement_expired`, or `sync_disabled`) and an optional `retain_until`.
Purge is idempotent, locks rows before deletion, and deletes only remote
manifests/blobs whose deadline has passed. The account-deletion policy remains
owned by #443.

An invalid cursor (malformed or reused under a different `type` than it was
issued for — see binding rule below):

```json
{ "errors": { "cursor": ["Invalid or expired cursor."] } }
```

### Response body

```json
{
  "results": [ /* gallery items, see below */ ],
  "next_cursor": "string | null",
  "has_more": true
}
```

`next_cursor` is `null` exactly when `has_more` is `false`. Clients page by
passing `next_cursor` back as `cursor` until it is `null`.

### Result items: discriminated union

Every item carries a **`kind`** discriminator with value `"2d"`, `"3d"`, or
`"generated"`. Every item includes:

| Field          | Meaning                                                                                                           |
| -------------- | ----------------------------------------------------------------------------------------------------------------- |
| `id`           | Stable public id (the record's `public_id` UUID as a string). Internal database pks never appear.                 |
| `title`        | Piece title.                                                                                                      |
| `owner`        | Owner attribution: the chosen display name, falling back to the current public handle; never the historical account username or email. |
| `published_at` | Publication timestamp (ISO 8601).                                                                                  |
| `thumbnail_url`| URL of the piece's gallery-card thumbnail.                                                                         |
| `viewer_url`   | Canonical profile-nested path `/users/@<handle>/pieces/<slug>`; legacy identifier paths are compatibility fallbacks only. |

Generated (`"kind": "generated"`) items additionally expose **`engine`** —
the piece's stable engine identifier — and **`engine_label`**, its display
label. The identifier is one of `canvas2d`, `svg`, `p5js`, `c2js`,
`c2js-interactive`, `threejs`, or `aframe`.
Generated items also expose **`thumbnail_is_fallback`**. It is `true` when
the thumbnail is the neutral placeholder created because no successful
capture has been uploaded yet, and `false` when it is a real captured
thumbnail. This lets clients distinguish an intentional placeholder from a
failed image request.

Example items:

```json
{
  "id": "6f9619ff-8b86-d011-b42d-00c04fc964ff",
  "kind": "2d",
  "title": "Bouncing balls",
  "owner": "alice",
  "published_at": "2026-09-08T10:00:00Z",
  "thumbnail_url": "/api/public/projects/6f9619ff-…/thumbnail.png",
  "viewer_url": "/users/@alice/pieces/bouncing-balls"
}
```

```json
{
  "id": "7b1c2d3e-…",
  "kind": "3d",
  "title": "Orbit study",
  "owner": "alice",
  "published_at": "2026-09-08T09:30:00Z",
  "thumbnail_url": "/api/projects3d/7b1c2d3e-…/thumbnail/",
  "viewer_url": "/users/@alice/pieces/orbit-study"
}
```

```json
{
  "id": "9c4d5e6f-…",
  "kind": "generated",
  "title": "Calm blue field",
  "owner": "alice",
  "published_at": "2026-09-08T09:00:00Z",
  "thumbnail_url": "/api/public/art-pieces/9c4d5e6f-…/thumbnail.png",
  "thumbnail_is_fallback": true,
  "viewer_url": "/users/@alice/pieces/calm-blue-field",
  "engine": "canvas2d"
}
```

### Global sort

All three kinds are merged into one global order, sorted by:

1. **Newest `published_at` first** (descending);
2. then a **documented stable kind rank** (`2d` before `3d` before
   `generated` — rank 0, 1, 2), applied only between rows with the exact same
   `published_at` instant;
3. then **public id descending** (the record's internal pk, used purely as a
   tiebreaker; it never appears in any response body).

### Cursor pagination and type binding

Pagination is keyset ("seek"), not offset — the same duplicate/gap-safe
strategy `scenes/gallery.py`'s module docstring documents for the legacy
endpoint: each page asks for "everything strictly after the last row I
returned" in the global order, so a piece publishing *between* page requests
never duplicates or drops rows already seen. The cursor encodes the last
row's `(published_at, kind, pk)` position plus the **`type` filter the cursor
was issued under**.

**A cursor is bound to its `type`:** a `next_cursor` issued by a
`type=generated` page is rejected with **HTTP 400** (and the
`{"errors": {"cursor": [...]}}` body above) when presented alongside any
other `type` (`all`, `authored`), and vice versa. Reusing a cursor across
filters would silently re-anchor the walk inside a different result set, so
the API refuses rather than returning ambiguous pages. Clients changing the
filter must start a fresh walk with no `cursor`.

## Capability consistency (#519)

`GET /api/account/entitlements/` retains its legacy `features` list and adds a
`capabilities` map keyed by the atomic registry. Each entry includes
`available`, `source` (`local`, `plan`, `role`, `override`, or `global`),
`local`, `remote`, `quota`, and `daily_cap`.

Application-admin policy endpoints are additive:

| Endpoint | Contract |
| --- | --- |
| `GET/POST /api/admin/roles/` | List or create reusable role sections. Role capabilities are a bounded map of registry keys. |
| `PATCH /api/admin/roles/<role_key>/` | Revision-checked atomic role update. |
| `GET/PATCH /api/admin/global-capabilities/` | Read or revision-check one global capability toggle. Cloud sync also updates the existing site-wide switch in the same transaction. |
| `GET/PATCH /api/admin/plans/?plan_key=<key>` | Existing plan contract, extended with `role_key` for role assignment. |

Global denial takes precedence over role, plan, and per-user overrides. The
resolver never hides local create/open/edit/import/export because a plan lacks
a remote capability; frontend surfaces omit unavailable optional controls.
Application admins are a separate authorization class and receive all
capabilities (subject to an explicit global shutdown); they are not assigned a
role or per-user capability matrix.

## Public profiles (#520)

| Endpoint | Contract |
| --- | --- |
| `GET/PATCH /api/account/profile/` | Authenticated owner profile settings with a revision check; fields are a unique handle, display name, bounded bio, URLs, profile-image URL metadata, visibility, and revision. |
| `GET /api/users/@<handle>/` | Anonymous public profile read with safe metadata and only explicitly public 2D/3D/generated pieces. Missing, inactive, or private profiles return `404`. |

Provider identities, email, prompts, credentials, billing, drafts, deleted
pieces, and private pieces never appear in the public response. A profile
handle is an opaque user-selected slug and conflicts return `409`.

## Account identities (#559)

| Endpoint | Contract |
| --- | --- |
| `GET /api/account/identities/` | Authenticated caller's linked provider identities only; each entry contains `provider`, `enabled`, and `connected_at`, with no provider uid, token, or handle. |
| `GET /api/account/identity-providers/` | Authenticated caller's provider registry view. Returns every configured provider with its display label and enabled state, so the UI never hard-codes an enabled/disabled decision. |
| `DELETE /api/account/identities/<provider>/` | Removes only the caller's linked identity, returning `409` when the operation would leave no usable enabled sign-in method. |

Linking uses allauth's top-level CSRF-protected `POST /accounts/<provider>/login/`
flow with `process=connect` and a return path to account settings. Provider
identity ownership conflicts fail closed and never merge local accounts.

## Managed application-admin roster (#560)

| Endpoint | Contract |
| --- | --- |
| `GET /api/admin/content/access/` | Application-admin-only roster of canonical local accounts, including username, verified email when present, and linked provider names; no provider uid, token, or handle is returned. |
| `POST /api/admin/content/access/` | Application-admin-only grant/revoke by exact local `username` or exact verified allauth email. The legacy `username` field remains accepted; new callers may send `identifier` plus boolean `granted`. Grants/revokes are idempotent and return the resolved account. |

## Admin entitlements (#561)

`GET /api/account/entitlements/` keeps its existing feature summary and
capability map. For quota-bearing capabilities, an application administrator
receives `unlimited: true` and `daily_cap: null`; ordinary users continue to
receive their configured numeric cap. Admin status is resolved from the
current `ApplicationAdmin` grant on every request. Daily-cap enforcement is
skipped only for the active grant; request-rate limits and successful-use
accounting remain in place, and revocation immediately restores the user's
plan/override cap without changing owned data.

## Account email aliases (#562)

The account settings security links use allauth's existing authenticated
`/accounts/email/` flow for adding, verifying, setting primary, and removing
aliases. The flow rejects unverified addresses for sign-in/admin resolution
and preserves the same local user and owned records. Verification sends are
handled by the configured server mail backend; no address ownership detail is
returned to another account.

## Password lifecycle (#563)

Social-first users use allauth's existing top-level
`/accounts/password/set/`, `/accounts/password/change/`, and
`/accounts/password/reset/` flows. These retain CSRF protection, recent
authentication/session policy, generic reset responses, expiring single-use
tokens, and the existing controlled local-signup policy; reset tokens are not
placed in application URLs after consumption or in client diagnostics.

## Theme customization (#521)

`GET /api/site-theme/` is anonymous-safe and returns the effective finite site
tokens (`background`, `surface`, `text`, `muted`, `accent`).
`GET/PATCH /api/admin/settings/` includes `theme_config` and applies an
optimistic revision check; only validated six-digit hex colors and known token
names are accepted. `GET/PATCH /api/account/profile/` includes the same
bounded `theme_config` object for the profile accent/presentation. Profile
tokens are applied only inside the profile surface and cannot alter shell,
authentication, or security styling. Invalid or unavailable configuration uses
the compiled safe defaults.

`GET /api/account/entitlements/` remains the authenticated caller's own
summary and adds a stable `capabilities` object keyed by the finite capability
registry. Each entry contains `available`, `source` (`local`, `plan`, or
`override`), `remote`, and `daily_cap`/`used`/`remaining` where applicable.
Local editor capabilities default to available for every plan; a missing plan
feature can deny only the affected remote or paid operation. An explicit
per-user override may intentionally allow or deny one named capability.

The registry includes `editor_2d_local`, `editor_3d_local`,
`generated_pieces`, `ai_scene_create`, `ai_scene_edit`, `ai_art_generate`,
`publishing`, and `cloud_project_sync`. Plan and override changes are
transactional and never mutate projects, versions, media, credentials, or
sessions. Frontend surfaces consume this map and omit unavailable optional
controls rather than rendering locked-feature prompts.

## Admin content operations (#518)

`GET /api/admin/content/` is application-admin-only and returns a bounded,
list-oriented view of server-owned projects, 3D projects, generated pieces,
their immutable versions, and cloud-backup media blobs. Local IndexedDB data is
never exposed or mutated by this API.

`POST /api/admin/content/actions/` accepts one explicit action payload:
`{"resource_type": "project|project3d|art_piece", "resource_id": "...", "action": "publish|unpublish|restore|delete"}`.
The action runs in one transaction, reuses the resource's existing publication
and soft-delete invariants, and records an `AdminContentAuditEvent`. Delete is
soft-delete only and is rejected for a current/reference-protected resource.

`POST /api/admin/content/access/` accepts
`{"username": "...", "granted": true|false}` to grant or revoke an
application-admin identity. This changes only the `ApplicationAdmin` grant;
the next environment reconciliation remains authoritative for configured
admin identities.

All write endpoints require the normal authenticated session and CSRF token.
Anonymous callers receive `401`; authenticated non-admins receive `403`;
invalid actions, stale/conflicting invariants, and protected deletes receive
finite `400`/`409` responses. Audit responses expose actor username, action,
resource kind/id, and timestamp, never credentials or private content.

## Owner collections (#556/#567)

The collection API is additive and does not change the existing public project,
3D project, art-piece, profile, or gallery routes. The first slice groups
server-owned published artwork; browser-local media records are not represented
because this repository has no shared server-side media table.

`GET /api/account/collections/` lists the authenticated user's non-deleted
collections. `POST /api/account/collections/` creates one with
`{"title":"...", "description":"..."}`. Collection titles are required;
slugs are generated deterministically and remain stable after creation unless
the owner explicitly edits the public slug.

`GET/PATCH/DELETE /api/account/collections/<uuid>/` reads or mutates an
owner's collection. `DELETE` is a soft delete. `POST
/api/account/collections/<uuid>/items/` replaces the complete ordered item
list using `{"items":[{"kind":"project|project3d|art_piece","id":"<public-id>"}]}`;
duplicates, foreign records, deleted records, and records that are not
currently public are rejected with `400` and the collection remains unchanged.
`POST /api/account/collections/<uuid>/publish/` and `/unpublish/` change only
the collection's publication state.

`GET /api/public/collections/<handle>/<slug>/` returns a published collection
only when the owner's public profile is enabled. Its `items` are in stored
position order and include `kind`, `id`, `title`, `viewer_url`, and
`thumbnail_url` (which may be null). Items that become private, unpublished,
or deleted are omitted without revealing their prior existence. Missing,
private, and deleted collections return `404`.

Public detail responses for projects, 3D projects, and generated art pieces
add a `collections` array containing only currently public, non-deleted
collection links: `{title, handle, slug, url}`. Private or unpublished
collections are omitted, and the field is absent from owner-only responses.

The canonical generated art-piece response from
`GET /api/users/@<handle>/pieces/<slug>/` includes a `versions` array when the
resolved piece is generated. Each entry is a public summary containing only
`sequence`, `engine`, `status`, `prompt`, `created_at`, and `model_label` (or
`null` when no model label was recorded). It never includes source code,
capabilities, or the raw generation-metadata object. The piece must be
published and belong to a public profile; private, unpublished, deleted, and
unknown pieces return `404` without revealing which condition applies.

`GET /api/account/collections/<uuid>/snapshot/` returns the same deterministic
online JSON representation for the owner. It is not an offline export and no
download or archival guarantee is implied. All account writes require the
normal session and CSRF protection; anonymous account calls return `401`, and
another user's collection is indistinguishable from not-found (`404`).

### Canonical public collection routes (#641)

Published collections are addressed by the owner-scoped canonical family
`/users/@<handle>/collections/<slug>`. The corresponding immersive page is
`/users/@<handle>/collections/<slug>/immersive`; the chrome-less immersive
embed remains `/embed/collections/@<handle>/<slug>`. Existing
`/users/@<handle>/<slug>`, its `/immersive` suffix, and the public API route
`/api/public/collections/<handle>/<slug>/` remain compatibility shims and
continue to resolve the same public collection. Canonical serializers emit
the new routes and canonical item links; they never reconstruct links from
collection or item IDs.

Collection creation derives a normalized slug from the title and adds an
owner-scoped numeric suffix on collision. Owners may set a custom normalized
slug through `PATCH /api/account/collections/<uuid>/` using `public_slug`.
Changing a slug records the previous slug in owner-scoped redirect history;
legacy slug requests return a permanent redirect to the current canonical
route. A failed collision or invalid value is atomic and leaves the current
slug and membership unchanged. No slug migration rewrites existing rows
destructively; removing a redirect is a rollback-safe administrative cleanup,
not part of the owner mutation.
