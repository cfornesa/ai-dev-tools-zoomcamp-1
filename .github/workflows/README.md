# GitHub Actions dependency pins

All third-party GitHub Actions in this directory are pinned to immutable
40-character commit references. The release labels in the workflow comments
and this table are documentation only; changing a label does not change what
CI executes.

| Action | Reviewed release | Immutable commit |
| --- | --- | --- |
| `actions/checkout` | `v5` | `fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09` |
| `raven-actions/actionlint` | `v2` | `3d39aea434753780c3b3d4a1a31c854b4dbf49d7` |
| `astral-sh/setup-uv` | `v7` | `37802adc94f370d6bfd71619e3f0bf239e1f3b78` |
| `actions/setup-node` | `v6` | `249970729cb0ef3589644e2896645e5dc5ba9c38` |
| `actions/upload-artifact` | `v4` | `ea165f8d65b6e75b540449e92b4886f43607fa02` |
| `actions/github-script` | `v7` | `f28e40c7f34bde8b3046d885e986cb6290c5673b` |

## Upgrade policy

Action upgrades are intentional dependency changes. To upgrade one:

1. Review the upstream release notes and resolve the release tag to its
   immutable commit.
2. Update every matching workflow reference and the table above in the same
   change. Keep the release label comment beside each workflow pin.
3. Run `make check-workflows` and review the resulting workflow diff before
   merging.