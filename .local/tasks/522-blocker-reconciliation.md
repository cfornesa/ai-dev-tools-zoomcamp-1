# Blocker reconciliation — #522

Status: DEPENDENCY-BLOCKED.

The sole remaining open issue owns remote cloud-media retention/deletion
semantics. #443 is account deletion; #509/#511 are sync transport and
entitlement boundaries. No duplicate or new follow-up issue is needed.

Owner action required before engineering: approve a finite matrix for active,
deleted, cancelled/expired, and disabled-sync remote copies; identify the
storage lifecycle owner/provider contract; and decide whether destructive
retroactive purge requires explicit confirmation. Until then, no storage
vendor, commercial default, schema, or purge behavior should be invented.
