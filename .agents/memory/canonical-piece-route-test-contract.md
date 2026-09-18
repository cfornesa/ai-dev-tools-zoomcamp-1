# Canonical art-piece route test contract

Canonical generated-piece tests should assert the user-facing slug routes:
`/users/@handle/pieces/{slug}`, `/users/@handle/immersive/{slug}`, and
`/users/@handle/edit/{slug}`. UUID routes remain compatibility shims and are
not the expected destination for new profile, gallery, studio, or owner-editor
links.

Owner-management tests must scope published public-link assertions to the
current fixture rather than assuming the database contains no older fixture
pieces. Profile tests must wait for the asynchronous settings payload before
editing controlled inputs, and must explicitly enable public visibility when
testing the public route.
