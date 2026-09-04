# Public gallery published-piece boundary

The header `/gallery` route is the structured authored-piece gallery. It
currently fetches only 2D `Project` records from `/api/public/projects/`;
published `Project3D` records have public detail/publish endpoints but no
gallery-list contract. Generated `ArtPiece` records use the separate,
unlinked `/art-pieces/gallery` route and are not interchangeable with
structured authored pieces.

Issue #392 owns the mixed 2D/3D `/gallery` listing contract. The related
owner-visible follow-ups are #393 (actual 3D thumbnails), #394 (3D
publication discoverability), #395/#396 (clearable 2D/3D selection), and
#397/#398 (2D/3D editor containment). Keep closed #46, #243, #296, #315,
#319, #320, #324, #325, #338, #376, and #377 immutable; they cover earlier
gallery, thumbnail, publish/viewer, generated-art, parity, and route/layout
transactions.
