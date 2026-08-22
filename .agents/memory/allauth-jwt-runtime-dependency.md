---
name: Allauth JWT runtime dependency
description: Runtime dependency behavior observed in the django-allauth OAuth callback.
---

The project pins `PyJWT` explicitly rather than relying on django-allauth's
package metadata to install it.

**Why:** The installed allauth release imports `jwt` while validating OAuth
callback state, but its resolved dependency metadata did not include PyJWT.
That allowed startup and OAuth initiation to pass while the real callback
failed with `ModuleNotFoundError`.

**How to apply:** When upgrading or reinstalling allauth, keep an explicit
PyJWT dependency and exercise a real or callback-level OAuth test, not only
the login redirect.