"""A real `AISceneProvider` backed by the Mistral API (Task 46/47/50).

`docs/plan.md`'s "AI provider and cost control" section: "Use Mistral API
through Django server-side endpoints as the initial hosted provider ...
AI returns strict schema-constrained JSON, never arbitrary JavaScript."

`MistralSceneProvider` implements both `create_scene` (Task 46/47, prompt
-> complete scene) and `edit_scene` (Task 50, prompt + current scene ->
allowlisted JSON Patch -> patched draft scene).

## edit_scene: patch generation, not full-scene regeneration

Unlike `create_scene`, `edit_scene` constrains Mistral's `response_format`
to a small JSON Patch document schema (`_EDIT_RESPONSE_JSON_SCHEMA`) —
an array of `{op, path, value?}` operations — rather than a complete
scene. This is deliberately narrower than `AIEditSceneRequest`'s
docstring in `ai_provider/interface.py` (which describes a provider
returning "the complete edited scene"): Task 50's acceptance criteria
requires the response to literally *contain the patch* ("A successful
response contains the patch, resulting draft scene, and concise change
summary"), and requires that "only documented JSON Patch operations and
paths are accepted" -- both only make sense if Mistral is asked to
produce a patch, not a full document, in the first place. `edit_scene`
(the `AISceneProvider` ABC method) still returns a plain
`AIOperationResult` carrying the *resulting* scene, for interface
compatibility with `create_scene`/`FakeAISceneProvider`/every other
caller of the shared interface; `edit_scene_with_patch` is the richer
entry point (used by `scenes/ai_api.py`'s edit endpoint) that also
returns the patch document itself and a change summary.

Patch handling, in order:

1. Mistral is asked (schema-constrained) for a JSON Patch array.
2. An **empty patch is treated as a rejection, not a trivial success**:
   `docs/plan.md` never says the model is guaranteed to find a
   meaningful edit, and a "successful" draft that is byte-for-byte
   identical to the input would be indistinguishable from a bug to the
   end user. See `EMPTY_PATCH_PREFIX`.
3. `scenes.patch.validate_patch_operations` checks the raw patch against
   the allowlisted ops/paths and protected-field list *before* it is
   ever applied — a patch that touches `/id`, `/schemaVersion`,
   `/randomness/seed`, any other item's `id` field in place, or any path
   outside the documented allowlist is rejected outright, with a
   `INVALID_PATCH_PREFIX`-tagged message identifying the specific reason
   (`scenes.patch.PatchErrorReason`) so `scenes/ai_api.py` can map it to
   its own explicit HTTP response. This call also passes `request.prompt`
   (issue #158): a patch touching an existing shape/group/binding/layer/
   graph node/connection the prompt text gives no reasonable reference to
   is rejected as `PatchErrorReason.UNREFERENCED_ELEMENT`, unless the
   prompt is itself bulk/global in scope — see `scenes/patch.py`'s
   docstring's "Prompt-element reference check" section for the full
   mechanism and its deliberately simple word-list bulk-scope heuristic.
4. Only a patch that passes step 3 is applied, via `scenes.patch.apply_patch`,
   to a **deep copy** of `request.current_scene` — the original the
   caller passed in is never mutated.
5. The resulting scene still goes through the same
   `ai_provider.interface.execute()` / `scenes.validation.validate_scene`
   path `create_scene` uses (full schema + `schema/limits.json` resource
   limits) before being considered a success — an allowlisted patch can
   still produce a scene that is, say, over a shape-count limit, and
   that must be caught exactly like a bad `create_scene` output.

Nothing here writes a `SceneVersion` or touches saved project state —
this module has no database access at all; persistence is exclusively
`scenes/api.py`'s concern, triggered later by an explicit user Accept
action (Task 48).

## How the schema constraint is enforced

Two independent layers, per `docs/plan.md`'s "AI output rules" ("Server
validates output ... before preview" — never trust the provider alone):

1. **Provider-side constraint**: the chat request's `response_format` is
   set to Mistral's `json_schema` mode
   (https://docs.mistral.ai/capabilities/structured-output/), passing
   `scenes.validation.SCENE_SCHEMA` (the same canonical schema the
   frontend and `scenes.validation.validate_scene` already enforce) as
   the target shape. This is the "constrained" half of the acceptance
   criteria's "instructed or constrained" — it makes Mistral emit JSON
   matching the schema's shape directly, not prose or JavaScript wrapped
   in markdown fences.
2. **Server-side re-validation**: `_invoke` never returns validated
   output directly — it hands its raw parsed JSON to
   `ai_provider.interface.execute()`, which runs
   `scenes.validation.validate_scene` (schema + `schema/limits.json`
   complexity/payload caps) before any result is considered a success.
   This is the "instructed" half's backstop: `response_format` is a
   strong hint, not a guarantee (a model can still violate `strict`
   schemas in edge cases, and older/other Mistral models don't support
   `json_schema` mode at all), so nothing this provider produces reaches
   a caller without passing the exact same validator a manual save does.

## Timeout, size, and failure handling

- `REQUEST_TIMEOUT_MS` bounds how long one Mistral call may run before
  it is treated as `AIProviderTimeoutError` (-> `AIErrorCategory.TIMEOUT`).
- `MAX_RAW_RESPONSE_BYTES` bounds the raw response text *before* it is
  even JSON-parsed — a safety net independent of (and larger than)
  `schema/limits.json`'s `maxScenePayloadBytes`, which only applies to a
  document that has already parsed as JSON and reached
  `scenes.validation.validate_scene`. A response that fails this earlier,
  cruder check is reported as `AIProviderRejectionError` with a
  `response_too_large:`-prefixed message so `scenes/ai_api.py` can map it
  to its own explicit HTTP status distinct from a generic provider
  rejection (see that module's `_RESULT_TO_RESPONSE`).
- Any other Mistral SDK/HTTP failure (5xx, malformed response, connection
  error) is normalized to `AIProviderRejectionError` ("provider failure").
  A 429 (or a Mistral-reported rate/quota error) is normalized to
  `AIProviderQuotaError` instead, distinct from this server's own
  independent per-user quota/rate limiting in `scenes/ai_api.py`.

## API key handling

The Mistral client is constructed lazily, on first use, via
`ai_provider.config.get_provider_api_key(MISTRAL_API_KEY_ENV_VAR)` —
never at import time and never accepting a key as a constructor/request
parameter (see that module's docstring and
`tests/test_ai_provider_key_and_logging_safety.py`). Tests construct
`MistralSceneProvider(client=<mock>)` directly, which skips key lookup
entirely — no real `MISTRAL_API_KEY` is ever required to exercise this
module.
"""

from __future__ import annotations

import json
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

import httpx

from ai_provider.errors import (
    AIProviderCancelledError,
    AIProviderQuotaError,
    AIProviderRejectionError,
    AIProviderTimeoutError,
)
from ai_provider.interface import (
    AICreateSceneRequest,
    AIEditSceneRequest,
    AIError,
    AIErrorCategory,
    AIOperation,
    AIOperationResult,
    AISceneProvider,
    AIUsageMetadata,
    execute,
)
from ai_provider.interface3d import (
    AICreateScene3DRequest,
    AIEditScene3DRequest,
    AIOperationResult3D,
    AIScene3DProvider,
    execute3d,
)
from scenes.patch import (
    PatchError,
    apply_patch,
    summarize_patch,
    validate_patch_operations,
    worst_reason,
)
from scenes.patch3d import validate_patch_operations3d
from scenes.validation import SCENE_SCHEMA
from scenes.validation3d import SCENE3D_SCHEMA

# The model used for scene creation. Overridable via the MISTRAL_MODEL
# environment variable (optional -- unlike MISTRAL_API_KEY, this has a
# sane default and is never required to be set).
DEFAULT_MODEL = "mistral-large-latest"

# How long one create_scene call may run before it's treated as a timeout.
# docs/plan.md doesn't pin an exact number; 20s is chosen as generous
# enough for a large structured-output completion while still bounding a
# single HTTP request in a synchronous Django view.
REQUEST_TIMEOUT_MS = 20_000

# A crude, pre-JSON-parse safety net on the raw response text, independent
# of (and deliberately larger than) schema/limits.json's
# maxScenePayloadBytes (307200 / 300KB), which only applies to a document
# that already parsed as JSON. 400KB gives headroom for whitespace/
# formatting the model might emit around the JSON payload while still
# bounding worst-case memory/parse cost.
MAX_RAW_RESPONSE_BYTES = 400_000

# Estimated, non-authoritative USD-per-1K-token rates for cost-metadata
# logging only (Task 45's AIUsageMetadata.estimated_cost_usd). Not wired
# to real Mistral billing; update if/when a billing integration lands.
_ESTIMATED_PROMPT_COST_PER_1K = 0.002
_ESTIMATED_COMPLETION_COST_PER_1K = 0.006

# Public: scenes/ai_api.py inspects a PROVIDER_REJECTION error's message
# for this prefix to give an oversized-response failure its own explicit
# HTTP status (413) distinct from a generic provider failure (502) --
# AIErrorCategory itself has no dedicated "response too large" member.
RESPONSE_TOO_LARGE_PREFIX = "response_too_large:"

# Public: scenes/ai_api.py inspects a PROVIDER_REJECTION error's message
# for these prefixes to give edit_scene's patch-specific rejection modes
# their own explicit HTTP responses, distinct from a generic provider
# failure and from each other (Task 50's acceptance criteria calls out
# "patch failure, invalid path, stale base, oversized patch" as separate
# documented outcomes -- stale base is detected entirely in
# scenes/ai_api.py before a provider is ever called, so it has no prefix
# here).
EMPTY_PATCH_PREFIX = "empty_patch:"
INVALID_PATCH_PREFIX = "invalid_patch:"
PATCH_APPLY_FAILED_PREFIX = "patch_apply_failed:"

_SYSTEM_PROMPT = """You generate a single canonical scene document for a gesture-reactive \
animation editor. Follow these rules exactly:

- Respond with ONLY a single JSON object -- no prose, no markdown code \
fences, no explanation before or after it.
- The JSON object must conform to the provided JSON Schema (schemaVersion, \
canvas, renderer, layers, shapes, groups, bindings, graph, accessibility, \
and randomness are the top-level fields).
- Never include executable JavaScript, code strings, or anything a runtime \
would eval() -- node "params" accept only number/string/boolean/null leaf \
values.
- schemaVersion must be exactly 1.
- Every binding's "targetProperty" must be exactly one of: "positionX", \
"positionY", "scaleX", "scaleY", "rotation", "opacity", "fill", "stroke", \
"backgroundColor", "palette", "globalForce", "triggerPreset", \
"toggleLayer", "emitParticles", "resetScene" -- there is no "width" or \
"height" target; to make a shape appear larger or smaller, bind \
"scaleX"/"scaleY" instead.
- Every binding's "signal" must be exactly one of: "indexTipX", \
"indexTipY", "palmX", "palmY", "handDepth", "handSpeed", "pinchStrength", \
"pinchDistance", "gestureConfidence", "handPresence", "handDistance", \
"handsClose", "handsFar", "gestureState:openPalm", \
"gestureState:closedFist", "gestureState:pointingUp", \
"gestureState:thumbsUp", "gestureState:victory", "gestureState:none", \
"event:pinchStart", "event:pinchEnd", "event:gestureEnter", \
"event:gestureExit", "event:handAppear", "event:handDisappear", \
"event:handsBecameClose", or "event:handsBecameFar" -- never invent a new \
signal name.
- Keep the scene well within these limits: at most 200 shapes, 50 groups, \
20 layers, 100 graph nodes, 150 graph connections, 3 conditional nodes, \
100 bindings, and 4 particle emitters.
- Every id referenced by a binding, group, or connection must exist \
elsewhere in the document.
- Every shape requires its own specific fields beyond the common ones: \
"circle" requires "radius"; "rect" requires "width", "height", and \
"cornerRadius"; "line" requires "x2" and "y2"; "path" requires "points" \
and "closed"; "particleEmitter" requires "rate", "size", "lifespan", \
"speed", and "palette".
- Every shape is its own independent layer: no two shapes may share the \
same "layerId" -- each shape needs a distinct layer with a distinct id, \
even if you otherwise reuse a shared style or transform.
- If you include "demoSignals", it may only contain these keys: "palmX", \
"palmY", "pinchStrength", "handDistance", "gestureState" -- no other key \
(e.g. "handPresence") is ever allowed there, even though it is a valid \
"signal" value elsewhere.
- When the user's prompt implies a name for a shape (e.g. "add a sun" \
implies naming that shape "Sun"), set that shape's optional "name" \
field accordingly, so a later prompt in the same session can address it \
back by that name. Leave "name" unset when no name is implied."""

_EDIT_SYSTEM_PROMPT = """You propose a minimal JSON Patch editing an existing gesture-reactive \
animation scene document. Follow these rules exactly:

- Respond with ONLY a single JSON array of patch operations -- no prose, \
no markdown code fences, no explanation before or after it.
- Each operation is an object with "op" (one of "add", "replace", or \
"remove" -- no other op is ever accepted), "path" (a JSON Pointer string \
into the scene document), and "value" (required for "add"/"replace", \
omitted for "remove").
- Propose the SMALLEST set of operations that fulfills the requested \
edit. Do not rewrite or re-emit unrelated parts of the scene.
- NEVER target these paths -- any operation touching them is rejected \
outright: "/schemaVersion", "/id" (the scene's own identity), \
"/randomness/seed", or any existing item's own "id" field (e.g. \
"/shapes/2/id"). You may add or remove a whole shape/group/binding/node/ \
connection/layer (its own "id" lives inside the added/removed value), \
but you may never rename an existing item's id in place.
- Only these paths may be targeted, each at element or property \
granularity (never a bare whole-array replace like "/shapes" on its \
own): "/shapes/...", "/groups/...", "/bindings/...", "/layers/...", \
"/graph/nodes/...", "/graph/connections/...", "/accessibility/...", \
"/demoSignals" (or under it), "/canvas/backgroundColor" exactly, and \
"/randomness/enabled" exactly.
- If the requested edit cannot be expressed within these constraints, \
respond with an empty JSON array: [].
- You may address an existing shape by its "name" field when the scene \
document shows one set (e.g. "the shape named Sun" or "rename Sun to \
Moon" both refer to whichever shape currently has "name": "Sun") -- you \
do not need to already know its id. When you add a new shape the prompt \
implies a name for, set that shape's "name" field so a later prompt can \
address it back the same way."""

# Issue #232: the 3D counterpart of _SYSTEM_PROMPT/_EDIT_SYSTEM_PROMPT,
# targeting schema/scene3d.schema.json (a genuinely separate document
# family from the 2D canonical scene per #208's decision -- never mix
# these prompts/schemas with the 2D ones above).
_SYSTEM_PROMPT_3D = """You generate a single canonical 3D scene document for a \
gesture-reactive animation editor. Follow these rules exactly:

- Respond with ONLY a single JSON object -- no prose, no markdown code \
fences, no explanation before or after it.
- The JSON object must conform to the provided JSON Schema (schemaVersion, \
documentType, id, scene, camera, lights, groups, objects, and randomness \
are the top-level fields).
- schemaVersion must be exactly 1. documentType must be exactly "scene3d".
- Every object's "type" must be exactly one of: "box", "sphere", \
"cylinder", "plane" -- each requires its own specific dimension fields \
(box: width/height/depth; sphere: radius; cylinder: radiusTop/ \
radiusBottom/height; plane: width/height).
- Every light is an object requiring "id", "type", "color", and \
"intensity" -- never a bare number or string. Its "type" must be exactly \
one of: "directional", "point", "ambient". A "point" light additionally \
requires "position"; a "directional" light additionally requires \
"direction"; "ambient" needs neither.
- Every object's "groupId" must be an existing group's id, or null.
- When the user's prompt implies a name for an object or light (e.g. \
"add a sun" implies naming that light or object "Sun"), set its optional \
"name" field accordingly, so a later prompt in the same session can \
address it back by that name. Leave "name" unset when no name is \
implied.
- Keep the scene well within reasonable limits: at most a few dozen \
objects, groups, and lights each."""

_EDIT_SYSTEM_PROMPT_3D = """You propose a minimal JSON Patch editing an existing 3D \
gesture-reactive animation scene document. Follow these rules exactly:

- Respond with ONLY a single JSON array of patch operations -- no prose, \
no markdown code fences, no explanation before or after it.
- Each operation is an object with "op" (one of "add", "replace", or \
"remove" -- no other op is ever accepted), "path" (a JSON Pointer string \
into the scene3d document), and "value" (required for "add"/"replace", \
omitted for "remove").
- Propose the SMALLEST set of operations that fulfills the requested \
edit. Do not rewrite or re-emit unrelated parts of the scene.
- NEVER target these paths -- any operation touching them is rejected \
outright: "/schemaVersion", "/documentType", "/id" (the scene's own \
identity), "/randomness/seed", or any existing item's own "id" field \
(e.g. "/objects/2/id"). You may add or remove a whole object/group/light \
(its own "id" lives inside the added/removed value), but you may never \
rename an existing item's id in place.
- Only these paths may be targeted, each at element or property \
granularity (never a bare whole-array replace like "/objects" on its \
own): "/objects/...", "/groups/...", "/lights/...", "/camera/..." \
(property-level: position/target/fov/near/far), "/scene/backgroundColor" \
exactly, and "/randomness/enabled" exactly.
- If the requested edit cannot be expressed within these constraints, \
respond with an empty JSON array: [].
- You may address an existing object, group, or light by its "name" \
field when the scene document shows one set (e.g. "the object named \
Sun" or "rename Sun to Moon" both refer to whichever element currently \
has "name": "Sun") -- you do not need to already know its id. When you \
add a new object or light the prompt implies a name for, set its "name" \
field so a later prompt can address it back the same way."""

_RESPONSE_JSON_SCHEMA_3D: dict[str, Any] = {
    k: v for k, v in SCENE3D_SCHEMA.items() if k not in ("$schema", "$id")
}


# A response_format-compatible JSON Schema constraining Mistral's output to
# a small, documented JSON Patch dialect (see scenes/patch.py for the full
# allowlist/protected-field enforcement this schema only partially
# expresses -- response_format is a hint, scenes.patch is the backstop).
_EDIT_RESPONSE_JSON_SCHEMA: dict[str, Any] = {
    "type": "array",
    "items": {
        "type": "object",
        "properties": {
            "op": {"type": "string", "enum": ["add", "replace", "remove"]},
            "path": {"type": "string"},
            "value": {},
        },
        "required": ["op", "path"],
    },
}


def _estimate_cost_usd(prompt_tokens: int, completion_tokens: int) -> float:
    return round(
        (prompt_tokens / 1000) * _ESTIMATED_PROMPT_COST_PER_1K
        + (completion_tokens / 1000) * _ESTIMATED_COMPLETION_COST_PER_1K,
        6,
    )


def _raiser(exc: BaseException) -> Callable[[], Any]:
    def _raise() -> Any:
        raise exc

    return _raise


def _coerce_message_content_to_text(content: Any) -> str:
    """Mistral's assistant message content can be a plain string or a list of
    content chunks; join text-shaped chunks defensively rather than assuming
    a shape json_schema mode should never actually produce."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for chunk in content:
            if isinstance(chunk, str):
                parts.append(chunk)
            elif isinstance(chunk, dict) and isinstance(chunk.get("text"), str):
                parts.append(chunk["text"])
            else:
                text_attr = getattr(chunk, "text", None)
                if isinstance(text_attr, str):
                    parts.append(text_attr)
        return "".join(parts)
    return ""


# A response_format-compatible JSON Schema derived from the canonical
# schema. $schema/$id are stripped: they describe the schema document
# itself, not the response shape, and some providers reject unrecognized
# top-level schema metadata keywords in structured-output mode.
_RESPONSE_JSON_SCHEMA: dict[str, Any] = {
    k: v for k, v in SCENE_SCHEMA.items() if k not in ("$schema", "$id")
}


@dataclass(frozen=True)
class AIEditScenePatchResult:
    """The richer result `edit_scene_with_patch` returns (Task 50).

    `result` is the same `AIOperationResult` `AISceneProvider.edit_scene`
    (the ABC method) returns -- carrying the *resulting* patched scene on
    success, or a normalized error. `patch` and `change_summary` are only
    populated on success (`result.success`); a rejected/errored edit never
    exposes patch content the caller shouldn't build a draft preview from.
    """

    result: AIOperationResult
    patch: list[dict[str, Any]] | None = None
    change_summary: str | None = None


def _edit_error(
    usage: AIUsageMetadata, category: AIErrorCategory, message: str
) -> AIEditScenePatchResult:
    return AIEditScenePatchResult(
        result=AIOperationResult(
            operation=AIOperation.EDIT_SCENE,
            usage=usage,
            error=AIError(category=category, message=message),
        )
    )


@dataclass(frozen=True)
class AIEditScene3DPatchResult:
    """The 3D counterpart of `AIEditScenePatchResult` (issue #232)."""

    result: AIOperationResult3D
    patch: list[dict[str, Any]] | None = None
    change_summary: str | None = None


def _edit_error_3d(
    usage: AIUsageMetadata, category: AIErrorCategory, message: str
) -> AIEditScene3DPatchResult:
    return AIEditScene3DPatchResult(
        result=AIOperationResult3D(
            operation=AIOperation.EDIT_SCENE,
            usage=usage,
            error=AIError(category=category, message=message),
        )
    )


class MistralSceneProvider(AISceneProvider, AIScene3DProvider):
    """`AISceneProvider` backed by the real Mistral API. Implements both
    `create_scene` (Task 46/47) and `edit_scene` (Task 50) for the 2D
    document family, and (issue #232) `create_scene3d`/`edit_scene3d` for
    the 3D document family -- one provider instance serves both, since
    both go through the same Mistral account/credential."""

    def __init__(
        self,
        client: Any | None = None,
        *,
        api_key: str | None = None,
        model: str | None = None,
        timeout_ms: int = REQUEST_TIMEOUT_MS,
        persona_prompt: str | None = None,
    ):
        # `client` is an injection point: tests pass a mock/fake client so
        # this provider never opens a socket or reads MISTRAL_API_KEY under
        # test. A real caller (the create-scene view) constructs this with
        # no arguments, and the real client is built lazily on first use.
        self._client = client
        self._api_key = api_key
        self.model = model or DEFAULT_MODEL
        self.timeout_ms = timeout_ms
        # Issue #260: an optional Persona's additive prompt text, appended
        # as a second system message after the mandatory technical prompt
        # in every create/edit call below -- never merged into or replacing
        # it. `None`/blank means "no persona selected" (unchanged behavior).
        self.persona_prompt = persona_prompt or None

    def _system_messages(self, mandatory_prompt: str) -> list[dict[str, str]]:
        """Builds the leading system-message list for one Mistral call:
        the mandatory technical prompt always first and unmodified, plus
        (issue #260) the selected Persona's additive text as a second,
        separate system message when one is set. Centralizing this in one
        place is what lets a regression test assert the mandatory prompt's
        content never changes whether or not a persona is present."""
        messages = [{"role": "system", "content": mandatory_prompt}]
        if self.persona_prompt:
            messages.append({"role": "system", "content": self.persona_prompt})
        return messages

    @property
    def client(self) -> Any:
        if self._client is None:
            # Imported lazily so importing this module never requires the
            # mistralai package's transitive dependencies to be usable in
            # environments that only need the fake/interface for tests.
            from mistralai.client import Mistral

            if not self._api_key:
                # Backward-compatible direct construction for the legacy unit
                # test/injection surface. Production request code always
                # supplies a decrypted, owner-scoped api_key.
                from ai_provider.config import get_provider_api_key

                self._api_key = get_provider_api_key("MISTRAL_API_KEY")
            self._client = Mistral(api_key=self._api_key)
        return self._client

    def create_scene(self, request: AICreateSceneRequest) -> AIOperationResult:
        usage, produce = self._invoke(request.prompt, request.schema_version)
        return execute(AIOperation.CREATE_SCENE, usage, produce)

    def edit_scene(self, request: AIEditSceneRequest) -> AIOperationResult:
        """`AISceneProvider` ABC compliance: delegates to
        `edit_scene_with_patch` and returns just its `AIOperationResult`,
        matching `create_scene`'s (and every other provider's) return
        shape. Callers that need the patch document/change summary too
        (`scenes/ai_api.py`'s edit endpoint) should call
        `edit_scene_with_patch` directly instead.
        """
        return self.edit_scene_with_patch(request).result

    def edit_scene_with_patch(self, request: AIEditSceneRequest) -> AIEditScenePatchResult:
        usage, produce_patch = self._invoke_edit(request.prompt, request.current_scene)

        try:
            raw_patch = produce_patch()
        except AIProviderTimeoutError as exc:
            return _edit_error(usage, AIErrorCategory.TIMEOUT, str(exc))
        except AIProviderCancelledError as exc:
            return _edit_error(usage, AIErrorCategory.CANCELLED, str(exc))
        except AIProviderQuotaError as exc:
            return _edit_error(usage, AIErrorCategory.QUOTA_EXCEEDED, str(exc))
        except AIProviderRejectionError as exc:
            return _edit_error(usage, AIErrorCategory.PROVIDER_REJECTION, str(exc))

        # Empty-patch policy (documented in this module's docstring): an
        # empty patch is rejected, not treated as a trivial no-op success.
        if not raw_patch:
            return _edit_error(
                usage,
                AIErrorCategory.PROVIDER_REJECTION,
                f"{EMPTY_PATCH_PREFIX} Mistral proposed no changes for this edit request.",
            )

        patch_errors = validate_patch_operations(
            raw_patch, scene=request.current_scene, prompt=request.prompt
        )
        if patch_errors:
            reason = worst_reason(patch_errors)
            detail = "; ".join(f"[{e.index}] {e.message}" for e in patch_errors[:5])
            return _edit_error(
                usage,
                AIErrorCategory.PROVIDER_REJECTION,
                f"{INVALID_PATCH_PREFIX}{reason} {detail}",
            )

        try:
            draft_scene = apply_patch(request.current_scene, raw_patch)
        except PatchError as exc:
            return _edit_error(
                usage, AIErrorCategory.PROVIDER_REJECTION, f"{PATCH_APPLY_FAILED_PREFIX} {exc}"
            )

        result = execute(AIOperation.EDIT_SCENE, usage, lambda: draft_scene)
        if not result.success:
            return AIEditScenePatchResult(result=result)

        return AIEditScenePatchResult(
            result=result,
            patch=raw_patch,
            change_summary=summarize_patch(raw_patch),
        )

    def _invoke(
        self, prompt: str, schema_version: int
    ) -> tuple[AIUsageMetadata, Callable[[], dict[str, Any]]]:
        """Perform the real (or mocked) Mistral call and return the usage
        metadata to attach plus a zero-arg callable for `execute()`'s
        `produce_scene`: it either returns the raw parsed scene dict, or
        raises one of the four documented `ai_provider.errors` exceptions.
        Doing the network call here (rather than inside the callable
        `execute()` invokes) is what lets real token-usage metadata --
        only known once Mistral responds -- be attached to the result even
        on failure, matching `AIOperationResult.usage`'s "always present"
        contract without duplicating `execute()`'s own validation/error
        normalization.
        """
        zero_usage = AIUsageMetadata(prompt_tokens=0, completion_tokens=0, estimated_cost_usd=0.0)

        try:
            response = self.client.chat.complete(
                model=self.model,
                messages=[
                    *self._system_messages(_SYSTEM_PROMPT),
                    {"role": "user", "content": prompt},
                ],
                response_format={
                    "type": "json_schema",
                    "json_schema": {
                        "name": "canonical_scene",
                        "schema_definition": _RESPONSE_JSON_SCHEMA,
                        "strict": False,
                    },
                },
                temperature=0.2,
                timeout_ms=self.timeout_ms,
            )
        except httpx.TimeoutException:
            return zero_usage, _raiser(
                AIProviderTimeoutError(f"Mistral did not respond within {self.timeout_ms}ms.")
            )
        except httpx.HTTPError:
            return zero_usage, _raiser(
                AIProviderRejectionError("Mistral request failed (network/connection error).")
            )
        except Exception as exc:  # Mistral SDK error types (lazy-imported below)
            from mistralai.client.errors import MistralError

            if not isinstance(exc, MistralError):
                raise  # a genuine bug, not a documented provider condition

            status = getattr(exc, "status_code", None)
            if status == 429:
                return zero_usage, _raiser(
                    AIProviderQuotaError(
                        "Mistral reported its account/API rate limit or quota was exceeded."
                    )
                )
            if status in (408, 504):
                return zero_usage, _raiser(
                    AIProviderTimeoutError(f"Mistral reported a request timeout (status {status}).")
                )
            return zero_usage, _raiser(
                AIProviderRejectionError(f"Mistral provider request failed (status {status}).")
            )

        usage_info = getattr(response, "usage", None)
        prompt_tokens = int(getattr(usage_info, "prompt_tokens", 0) or 0)
        completion_tokens = int(getattr(usage_info, "completion_tokens", 0) or 0)
        usage = AIUsageMetadata(
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            estimated_cost_usd=_estimate_cost_usd(prompt_tokens, completion_tokens),
        )

        try:
            choice = response.choices[0]
            content = choice.message.content
        except (AttributeError, IndexError, TypeError):
            return usage, _raiser(
                AIProviderRejectionError("Mistral response contained no message content.")
            )

        text = _coerce_message_content_to_text(content)
        raw_bytes = len(text.encode("utf-8"))
        if raw_bytes > MAX_RAW_RESPONSE_BYTES:
            return usage, _raiser(
                AIProviderRejectionError(
                    f"{RESPONSE_TOO_LARGE_PREFIX} Mistral's response was {raw_bytes} bytes, "
                    f"exceeding the {MAX_RAW_RESPONSE_BYTES}-byte limit."
                )
            )

        try:
            scene = json.loads(text)
        except (json.JSONDecodeError, TypeError):
            return usage, _raiser(AIProviderRejectionError("Mistral response was not valid JSON."))

        if not isinstance(scene, dict):
            return usage, _raiser(
                AIProviderRejectionError("Mistral response JSON was not a scene object.")
            )

        return usage, (lambda: scene)

    def _invoke_edit(
        self, prompt: str, current_scene: dict[str, Any]
    ) -> tuple[AIUsageMetadata, Callable[[], list[Any]]]:
        """Same shape/purpose as `_invoke`, but for `edit_scene`: the
        callable returns the raw parsed JSON Patch array (not yet
        allowlist-validated or applied -- that happens in
        `edit_scene_with_patch`), or raises one of the four documented
        provider exceptions.
        """
        zero_usage = AIUsageMetadata(prompt_tokens=0, completion_tokens=0, estimated_cost_usd=0.0)
        user_content = (
            "Current scene (JSON):\n" + json.dumps(current_scene) + "\n\nRequested edit:\n" + prompt
        )

        try:
            response = self.client.chat.complete(
                model=self.model,
                messages=[
                    *self._system_messages(_EDIT_SYSTEM_PROMPT),
                    {"role": "user", "content": user_content},
                ],
                response_format={
                    "type": "json_schema",
                    "json_schema": {
                        "name": "scene_json_patch",
                        "schema_definition": _EDIT_RESPONSE_JSON_SCHEMA,
                        "strict": False,
                    },
                },
                temperature=0.2,
                timeout_ms=self.timeout_ms,
            )
        except httpx.TimeoutException:
            return zero_usage, _raiser(
                AIProviderTimeoutError(f"Mistral did not respond within {self.timeout_ms}ms.")
            )
        except httpx.HTTPError:
            return zero_usage, _raiser(
                AIProviderRejectionError("Mistral request failed (network/connection error).")
            )
        except Exception as exc:  # Mistral SDK error types (lazy-imported below)
            from mistralai.client.errors import MistralError

            if not isinstance(exc, MistralError):
                raise  # a genuine bug, not a documented provider condition

            status = getattr(exc, "status_code", None)
            if status == 429:
                return zero_usage, _raiser(
                    AIProviderQuotaError(
                        "Mistral reported its account/API rate limit or quota was exceeded."
                    )
                )
            if status in (408, 504):
                return zero_usage, _raiser(
                    AIProviderTimeoutError(f"Mistral reported a request timeout (status {status}).")
                )
            return zero_usage, _raiser(
                AIProviderRejectionError(f"Mistral provider request failed (status {status}).")
            )

        usage_info = getattr(response, "usage", None)
        prompt_tokens = int(getattr(usage_info, "prompt_tokens", 0) or 0)
        completion_tokens = int(getattr(usage_info, "completion_tokens", 0) or 0)
        usage = AIUsageMetadata(
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            estimated_cost_usd=_estimate_cost_usd(prompt_tokens, completion_tokens),
        )

        try:
            choice = response.choices[0]
            content = choice.message.content
        except (AttributeError, IndexError, TypeError):
            return usage, _raiser(
                AIProviderRejectionError("Mistral response contained no message content.")
            )

        text = _coerce_message_content_to_text(content)
        raw_bytes = len(text.encode("utf-8"))
        if raw_bytes > MAX_RAW_RESPONSE_BYTES:
            return usage, _raiser(
                AIProviderRejectionError(
                    f"{RESPONSE_TOO_LARGE_PREFIX} Mistral's response was {raw_bytes} bytes, "
                    f"exceeding the {MAX_RAW_RESPONSE_BYTES}-byte limit."
                )
            )

        try:
            patch = json.loads(text)
        except (json.JSONDecodeError, TypeError):
            return usage, _raiser(AIProviderRejectionError("Mistral response was not valid JSON."))

        if not isinstance(patch, list):
            return usage, _raiser(
                AIProviderRejectionError("Mistral response JSON was not a patch array.")
            )

        return usage, (lambda: patch)

    # --- Issue #232: the 3D document-family counterparts -----------------

    def create_scene3d(self, request: AICreateScene3DRequest) -> AIOperationResult3D:
        usage, produce = self._invoke_3d(request.prompt)
        return execute3d(AIOperation.CREATE_SCENE, usage, produce)

    def edit_scene3d(self, request: AIEditScene3DRequest) -> AIOperationResult3D:
        return self.edit_scene3d_with_patch(request).result

    def edit_scene3d_with_patch(self, request: AIEditScene3DRequest) -> AIEditScene3DPatchResult:
        usage, produce_patch = self._invoke_edit_3d(request.prompt, request.current_scene)

        try:
            raw_patch = produce_patch()
        except AIProviderTimeoutError as exc:
            return _edit_error_3d(usage, AIErrorCategory.TIMEOUT, str(exc))
        except AIProviderCancelledError as exc:
            return _edit_error_3d(usage, AIErrorCategory.CANCELLED, str(exc))
        except AIProviderQuotaError as exc:
            return _edit_error_3d(usage, AIErrorCategory.QUOTA_EXCEEDED, str(exc))
        except AIProviderRejectionError as exc:
            return _edit_error_3d(usage, AIErrorCategory.PROVIDER_REJECTION, str(exc))

        if not raw_patch:
            return _edit_error_3d(
                usage,
                AIErrorCategory.PROVIDER_REJECTION,
                f"{EMPTY_PATCH_PREFIX} Mistral proposed no changes for this edit request.",
            )

        patch_errors = validate_patch_operations3d(
            raw_patch, scene=request.current_scene, prompt=request.prompt
        )
        if patch_errors:
            reason = worst_reason(patch_errors)
            detail = "; ".join(f"[{e.index}] {e.message}" for e in patch_errors[:5])
            return _edit_error_3d(
                usage,
                AIErrorCategory.PROVIDER_REJECTION,
                f"{INVALID_PATCH_PREFIX}{reason} {detail}",
            )

        try:
            draft_scene = apply_patch(request.current_scene, raw_patch)
        except PatchError as exc:
            return _edit_error_3d(
                usage, AIErrorCategory.PROVIDER_REJECTION, f"{PATCH_APPLY_FAILED_PREFIX} {exc}"
            )

        result = execute3d(AIOperation.EDIT_SCENE, usage, lambda: draft_scene)
        if not result.success:
            return AIEditScene3DPatchResult(result=result)

        return AIEditScene3DPatchResult(
            result=result,
            patch=raw_patch,
            change_summary=summarize_patch(raw_patch),
        )

    def _invoke_3d(self, prompt: str) -> tuple[AIUsageMetadata, Callable[[], dict[str, Any]]]:
        """Same shape/purpose as `_invoke`, targeting `scene3d`."""
        zero_usage = AIUsageMetadata(prompt_tokens=0, completion_tokens=0, estimated_cost_usd=0.0)

        try:
            response = self.client.chat.complete(
                model=self.model,
                messages=[
                    *self._system_messages(_SYSTEM_PROMPT_3D),
                    {"role": "user", "content": prompt},
                ],
                response_format={
                    "type": "json_schema",
                    "json_schema": {
                        "name": "canonical_scene3d",
                        "schema_definition": _RESPONSE_JSON_SCHEMA_3D,
                        "strict": False,
                    },
                },
                temperature=0.2,
                timeout_ms=self.timeout_ms,
            )
        except httpx.TimeoutException:
            return zero_usage, _raiser(
                AIProviderTimeoutError(f"Mistral did not respond within {self.timeout_ms}ms.")
            )
        except httpx.HTTPError:
            return zero_usage, _raiser(
                AIProviderRejectionError("Mistral request failed (network/connection error).")
            )
        except Exception as exc:  # Mistral SDK error types (lazy-imported below)
            from mistralai.client.errors import MistralError

            if not isinstance(exc, MistralError):
                raise  # a genuine bug, not a documented provider condition

            status = getattr(exc, "status_code", None)
            if status == 429:
                return zero_usage, _raiser(
                    AIProviderQuotaError(
                        "Mistral reported its account/API rate limit or quota was exceeded."
                    )
                )
            if status in (408, 504):
                return zero_usage, _raiser(
                    AIProviderTimeoutError(f"Mistral reported a request timeout (status {status}).")
                )
            return zero_usage, _raiser(
                AIProviderRejectionError(f"Mistral provider request failed (status {status}).")
            )

        usage_info = getattr(response, "usage", None)
        prompt_tokens = int(getattr(usage_info, "prompt_tokens", 0) or 0)
        completion_tokens = int(getattr(usage_info, "completion_tokens", 0) or 0)
        usage = AIUsageMetadata(
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            estimated_cost_usd=_estimate_cost_usd(prompt_tokens, completion_tokens),
        )

        try:
            choice = response.choices[0]
            content = choice.message.content
        except (AttributeError, IndexError, TypeError):
            return usage, _raiser(
                AIProviderRejectionError("Mistral response contained no message content.")
            )

        text = _coerce_message_content_to_text(content)
        raw_bytes = len(text.encode("utf-8"))
        if raw_bytes > MAX_RAW_RESPONSE_BYTES:
            return usage, _raiser(
                AIProviderRejectionError(
                    f"{RESPONSE_TOO_LARGE_PREFIX} Mistral's response was {raw_bytes} bytes, "
                    f"exceeding the {MAX_RAW_RESPONSE_BYTES}-byte limit."
                )
            )

        try:
            scene = json.loads(text)
        except (json.JSONDecodeError, TypeError):
            return usage, _raiser(AIProviderRejectionError("Mistral response was not valid JSON."))

        if not isinstance(scene, dict):
            return usage, _raiser(
                AIProviderRejectionError("Mistral response JSON was not a scene object.")
            )

        return usage, (lambda: scene)

    def _invoke_edit_3d(
        self, prompt: str, current_scene: dict[str, Any]
    ) -> tuple[AIUsageMetadata, Callable[[], list[Any]]]:
        """Same shape/purpose as `_invoke_edit`, targeting `scene3d`."""
        zero_usage = AIUsageMetadata(prompt_tokens=0, completion_tokens=0, estimated_cost_usd=0.0)
        user_content = (
            "Current scene3d (JSON):\n"
            + json.dumps(current_scene)
            + "\n\nRequested edit:\n"
            + prompt
        )

        try:
            response = self.client.chat.complete(
                model=self.model,
                messages=[
                    *self._system_messages(_EDIT_SYSTEM_PROMPT_3D),
                    {"role": "user", "content": user_content},
                ],
                response_format={
                    "type": "json_schema",
                    "json_schema": {
                        "name": "scene3d_json_patch",
                        "schema_definition": _EDIT_RESPONSE_JSON_SCHEMA,
                        "strict": False,
                    },
                },
                temperature=0.2,
                timeout_ms=self.timeout_ms,
            )
        except httpx.TimeoutException:
            return zero_usage, _raiser(
                AIProviderTimeoutError(f"Mistral did not respond within {self.timeout_ms}ms.")
            )
        except httpx.HTTPError:
            return zero_usage, _raiser(
                AIProviderRejectionError("Mistral request failed (network/connection error).")
            )
        except Exception as exc:  # Mistral SDK error types (lazy-imported below)
            from mistralai.client.errors import MistralError

            if not isinstance(exc, MistralError):
                raise  # a genuine bug, not a documented provider condition

            status = getattr(exc, "status_code", None)
            if status == 429:
                return zero_usage, _raiser(
                    AIProviderQuotaError(
                        "Mistral reported its account/API rate limit or quota was exceeded."
                    )
                )
            if status in (408, 504):
                return zero_usage, _raiser(
                    AIProviderTimeoutError(f"Mistral reported a request timeout (status {status}).")
                )
            return zero_usage, _raiser(
                AIProviderRejectionError(f"Mistral provider request failed (status {status}).")
            )

        usage_info = getattr(response, "usage", None)
        prompt_tokens = int(getattr(usage_info, "prompt_tokens", 0) or 0)
        completion_tokens = int(getattr(usage_info, "completion_tokens", 0) or 0)
        usage = AIUsageMetadata(
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            estimated_cost_usd=_estimate_cost_usd(prompt_tokens, completion_tokens),
        )

        try:
            choice = response.choices[0]
            content = choice.message.content
        except (AttributeError, IndexError, TypeError):
            return usage, _raiser(
                AIProviderRejectionError("Mistral response contained no message content.")
            )

        text = _coerce_message_content_to_text(content)
        raw_bytes = len(text.encode("utf-8"))
        if raw_bytes > MAX_RAW_RESPONSE_BYTES:
            return usage, _raiser(
                AIProviderRejectionError(
                    f"{RESPONSE_TOO_LARGE_PREFIX} Mistral's response was {raw_bytes} bytes, "
                    f"exceeding the {MAX_RAW_RESPONSE_BYTES}-byte limit."
                )
            )

        try:
            patch = json.loads(text)
        except (json.JSONDecodeError, TypeError):
            return usage, _raiser(AIProviderRejectionError("Mistral response was not valid JSON."))

        if not isinstance(patch, list):
            return usage, _raiser(
                AIProviderRejectionError("Mistral response JSON was not a patch array.")
            )

        return usage, (lambda: patch)


__all__ = [
    "DEFAULT_MODEL",
    "EMPTY_PATCH_PREFIX",
    "INVALID_PATCH_PREFIX",
    "MAX_RAW_RESPONSE_BYTES",
    "PATCH_APPLY_FAILED_PREFIX",
    "REQUEST_TIMEOUT_MS",
    "RESPONSE_TOO_LARGE_PREFIX",
    "AIEditScene3DPatchResult",
    "AIEditScenePatchResult",
    "MistralSceneProvider",
]
