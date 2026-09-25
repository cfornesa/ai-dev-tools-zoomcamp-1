# Profile and personalization parity matrix

Source surfaces: the external owner profile settings form and theme helpers, compared with this repo’s account profile settings, public profile route, profile style catalog, and tokenized profile cascade.

| External field/control | This repo | Classification | Evidence / follow-up |
| --- | --- | --- | --- |
| Display name / public name | Account settings edits display name; public profile renders it as the heading | Same | `profileParityMatrix.spec.ts` at 1280x900 and 375x812 |
| Unique username / handle | Account settings edits the public handle; canonical profile route follows the saved handle | Same | Browser settings-to-public-profile flow |
| Bio (bounded text) | Account settings edits bio; public profile renders plain text | Same | Browser settings-to-public-profile flow |
| Website | Account settings edits a URL; public profile renders a safe external link | Same | Browser settings-to-public-profile flow |
| Profile photo presentation | Public profile renders the configured image URL with accessible avatar alt text | Same by design | Browser screenshot and image assertion; upload/remove is separately routed |
| Profile photo upload/remove workflow | External settings upload or remove a file; this repo currently exposes a URL field instead | Gap | New criterion-ready issue [#824](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/824) |
| Theme preference | External helper supports light/dark/system preference; this repo shell supports the same preference independently of profile styling | Same by design | Existing design-scheme and profile-style evidence |
| Palette | External style keys use owner-scoped color tokens; this repo uses an allowlisted light/dark palette catalog plus safe overrides | Same by design | Existing `profileStyles.spec.ts`, backend profile-style tests |
| Typography, density, radius, borders, shadow, backdrop | External theme helper applies style keys; this repo exposes these as finite presentation controls and CSS variables | Same by design | Browser settings flow and `PublicProfile` style cascade tests |
| Public profile pieces/collections | External profile lists public content; this repo lists public collections and pieces with canonical cards | Same | Existing public profile/gallery coverage plus browser screenshots |
| Social links | External source profile is limited to core website/profile fields; this repo additionally exposes validated social links | Different by design | Additive privacy-safe surface; no gap |
| Email and admin role fields | External admin form includes email/role context; this audit excludes admin-only fields | Different by design | Explicitly out of scope in #805 |

The only actionable parity gap found in this audit is #824. Closed profile/theme issues remain closed and are not reopened.
