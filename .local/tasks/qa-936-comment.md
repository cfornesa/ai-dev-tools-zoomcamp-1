## QA: BLOCKED / DEPENDENCY BOUNDARY

Task-distillation re-audited #936 after #956. The local 2D export child is
closed, but parent #935 still has unimplemented server-backed 2D/3D/generated
export scope. No import implementation should begin until the parent export
contract is complete and its package fixtures are available.

The missing criterion-ready child was checked against the open backlog and
created as #965 (server-backed 2D, 3D, and generated package export). No code,
local data, production data, or browser state was changed for #936.
