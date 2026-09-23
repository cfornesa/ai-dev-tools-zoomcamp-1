# Implementation source priority and Creatrweb hosting

For piece-related implementation, use the local `augment-humankind-react-node`
repository as the primary React implementation reference and the local
`augment-humankind` repository as the ultimate functional/source-of-truth
reference. Apply this priority to piece URLs, social sharing, prompt-to-product
and output workflows, and related piece-surface behavior; adapt the contracts
to this project's Django/React architecture rather than copying schemas
blindly.

The Replit project that hosts this specific application and its
`augmentrart.com` deployment is `creatrweb` at `replit.com/@fornesus/creatrweb`,
linked to `cfornesa/ai-dev-tools-zoomcamp-1`. Before republishing, push the
reviewed commit, use the Creatrweb Git tab to sync with `origin/main`, verify
the exact reviewed commit in the Replit workspace, then publish and run the
required production smoke, schema/table, and browser checks. Treat a Git-tab
merge-conflict message as a synchronization blocker until the workspace and
remote state are reconciled; never publish an unverified checkout.
