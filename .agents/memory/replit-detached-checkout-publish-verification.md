# Replit detached checkout publish verification

Replit's Git panel can report a stale authentication/rebase error while the
workspace shell is already detached at the desired `origin/main` revision.
For production evidence, inspect the shell's `git rev-parse HEAD origin/main`
and `git status` before deciding the checkout is stale; when the exact reviewed
SHA is present, a normal Republish followed by live canonical-route and smoke
verification can close the deployment boundary. Do not force-reset or abort a
rebase merely to clear a stale panel message.
