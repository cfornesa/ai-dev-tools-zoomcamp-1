# Collection parity matrix

Source surfaces: the external owner repository’s collection routes and collection runtime, compared with this repo’s owner collection management, public collection detail, immersive collection, and collection embed routes.

| Surface | External reference | This repo | Classification | Evidence / follow-up |
| --- | --- | --- | --- | --- |
| Collection title and description | Collection detail identifies the collection and renders its description | `PublicCollection` renders title and description | Same | `collectionParityMatrix.spec.ts` at 1280x900 and 375x812 |
| Owner attribution | Public collection links back to the owner/profile surface | Public collection header links to `@handle` | Same | Browser assertions in parity spec |
| Ordered collection items | Detail surface preserves and renders ordered items | `collection.items` renders as an ordered list of cards | Same | Three published project fixture items; browser assertions |
| Collection gallery card | Gallery card includes preview, title, and short descriptive label | Public gallery collection card includes preview, title, and label | Same | Existing `publicGalleryCollections.spec.ts` |
| Immersive collection route | Collection has a dedicated immersive presentation with navigation controls | `/users/@handle/collections/:slug/immersive` provides bounded stage, next/reset, zoom, fullscreen, and embeds | Same | Existing `immersiveCollection.spec.ts` |
| Chrome-less collection embed | Collection can be embedded without the full page chrome | `/embed/collections/@handle/:slug` hides page heading/chrome and retains navigation | Same | Existing `collections.spec.ts` and `immersiveCollection.spec.ts` |
| Explicit item count on detail | External collection detail exposes the collection item count | Current public collection detail relies on the item list and has no explicit count | Gap | New criterion-ready issue [#823](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/823) |
| Complete collection download | External collection detail exposes a complete collection download action | Current public collection detail has no complete-collection download action | Gap | New criterion-ready issue [#823](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/823) |
| Legacy collection URLs | External route changes must remain addressable | Legacy regular and immersive collection URLs redirect permanently to canonical routes | Same | Existing `collections.spec.ts` |

The audit is presentation-only. It does not reopen the closed collection-domain issues or implement #823; #823 is the routed implementation item for the two identified gaps.
