---
name: Mistral credential rotation
description: Operational rule for rotating the encryption root for personal Mistral credentials.
---

During a root-key rotation, configure the new Fernet root as active and retain
the old root in the previous-key list. Run the credential re-encryption command
successfully before removing an old root.

**Why:** Removing an old root before its ciphertext is re-encrypted makes the
affected personal provider keys unreadable; plaintext must never be recovered
or logged as part of this process.

**How to apply:** Treat a failed re-encryption command as a reason to retain
the applicable prior root and remediate the failed records before retirement.