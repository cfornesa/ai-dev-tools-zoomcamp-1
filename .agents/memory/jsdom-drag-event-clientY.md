# jsdom drag-and-drop events silently drop `clientY`/`clientX`

jsdom has no `DragEvent` (or `MouseEvent`) constructor at all
(`window.DragEvent` is `undefined`). `@testing-library/dom`'s
`fireEvent.dragStart`/`dragOver`/`drop` sugar looks up
`window.DragEvent || window.Event` for a constructor and passes your
`clientY`/`clientX` (or any other custom prop) through *that
constructor's* `init` dictionary. Since it falls back to the plain
`Event` constructor, `new Event(type, { clientY: 5, ... })` silently
**ignores** `clientY` — it isn't a recognized `EventInit` key, and the
constructor path (unlike the IE11-polyfill `document.createEvent`
fallback lower in `@testing-library/dom`'s `events.js`) never copies
unrecognized keys onto the created event.

Symptom: a React `onDragOver`/`onDrop` handler that reads
`event.clientY` sees `undefined`, not the value you passed to
`fireEvent.dragOver(el, { clientY: 5 })` — with no error, so any
geometry-dependent logic (e.g. computing a drop zone) silently computes
against `undefined` and produces a wrong-but-non-throwing result. This
first surfaced building `LayersPanel.tsx`'s pointer drag-and-drop (issue
#127): every `zoneForRow` computation based on `event.clientY` came back
as if `clientY` were `0`/`NaN`, so `EditorWorkspace.layers.test.tsx`'s
reorder assertions failed even though the same logic worked correctly in
a real browser (`frontend/e2e/layersPanel.spec.ts`, driven by real
Chromium's real `DragEvent`).

Fix: build the event by hand instead of using the `fireEvent.drag*`
sugar, and assign custom properties directly onto the instance — a plain
own-property assignment, not routed through any constructor's `init`
dictionary — then fire it with the two-argument `fireEvent(element,
event)` form:

```ts
function makeDragEvent(type: string, props: Record<string, unknown>): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, props); // clientY, dataTransfer, etc.
  return event;
}
fireEvent(element, makeDragEvent('dragover', { clientY: 5, dataTransfer }));
```

This works because React's synthetic event layer reads
`nativeEvent.clientY` off whatever object it receives — it only needs the
property to exist, not a "real" `DragEvent` instance. This is a jsdom/
Vitest-only concern; the production code itself is correct as written
(real `DragEvent` in every actual browser initializes `clientY` properly),
so nothing changes in application code — only in how the test simulates
the event.
