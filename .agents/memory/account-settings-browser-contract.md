# Account-settings browser contract

The public landing destination for anonymous and unauthorized redirects is
`/gallery?type=all`, not `/`. Browser acceptance tests that exercise logout,
account deletion, or protected admin routes should assert that canonical
destination.

The account settings page uses progressive disclosure: only the Public profile
section is expanded by default. Tests for plan, management, credentials, saved
models, personas, or retry controls must explicitly expand the relevant
section before asserting content or interacting with its controls.
