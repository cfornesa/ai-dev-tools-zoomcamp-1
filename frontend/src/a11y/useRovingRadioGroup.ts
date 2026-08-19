import { useRef, type KeyboardEvent, type RefCallback } from 'react';

/**
 * Issue #81: shared keyboard behavior for every `role="radiogroup"` of
 * same-DOM-level `role="radio"` buttons in this app (`BehaviorCardsPanel`'s
 * "Hand mode"/"Card type", `DemoControlsPanel`'s "Demo input
 * mode"/"Gesture state", `AIProposalPanel`'s "AI action",
 * `ReducedMotionControl`'s "Reduce motion", `SnapPreferenceControl`'s
 * grid/guide toggles).
 *
 * Before this hook, every one of those groups rendered each `role="radio"`
 * as its own independently-Tab-focusable `<button>` — reachable one at a
 * time via Tab, with no arrow-key behavior at all, which deviates from the
 * WAI-ARIA Radio Group pattern
 * (https://www.w3.org/WAI/ARIA/apg/patterns/radio/) assistive-technology
 * users expect from that role, and from what a native
 * `<input type="radio">` group already does. This hook implements that
 * pattern's keyboard model:
 * - Roving tabindex: exactly one radio in the group is in the Tab
 *   sequence at a time (`tabIndex={0}`) — the checked one, or the first
 *   enabled one if none is checked — every other radio has
 *   `tabIndex={-1}`. Tab/Shift+Tab move into and out of the *group* as a
 *   single stop, not between its individual radios.
 * - ArrowRight/ArrowDown move to the next enabled radio (wrapping from
 *   the last back to the first); ArrowLeft/ArrowUp move to the previous
 *   one (wrapping from the first back to the last). Home/End jump to the
 *   first/last enabled radio.
 * - Moving focus via an arrow key (or Home/End) also selects that radio
 *   immediately, by calling the same selection callback a click on it
 *   would — this is standard radio-group behavior (distinct from e.g. a
 *   tablist, where arrow-moving focus doesn't necessarily activate).
 *
 * This hook only manages *keyboard* navigation and focus; it never touches
 * `aria-checked`, click handlers, or any other prop — every caller keeps
 * rendering `aria-checked`/`onClick` exactly as before, so the DOM
 * structure, accessible names, and click behavior this hook's callers
 * already have tests for are unaffected.
 *
 * Disabled items (e.g. `DemoControlsPanel`'s gesture-state radios while no
 * hand is present) are skipped by arrow/Home/End navigation and never
 * become the roving tabindex target, matching how a native disabled radio
 * is skipped.
 */
export interface RovingRadioItem<T> {
  value: T;
  disabled?: boolean;
}

export interface RovingRadioProps {
  ref: RefCallback<HTMLButtonElement>;
  tabIndex: 0 | -1;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
}

export function useRovingRadioGroup<T>(
  items: RovingRadioItem<T>[],
  checkedValue: T,
  onSelect: (value: T) => void,
) {
  // Keyed by value rather than index so a ref survives items being
  // reordered/filtered across renders (none of today's callers do this,
  // but it costs nothing and avoids a subtle future bug).
  const nodesRef = useRef(new Map<T, HTMLButtonElement>());

  function enabledIndices(): number[] {
    const indices: number[] = [];
    items.forEach((item, index) => {
      if (!item.disabled) indices.push(index);
    });
    return indices;
  }

  /** The index that currently carries `tabIndex={0}`: the checked item if
   * it's enabled, else the first enabled item, else -1 (nothing focusable
   * in this group right now — e.g. every item disabled). */
  function rovingIndex(): number {
    const checkedIndex = items.findIndex((item) => item.value === checkedValue && !item.disabled);
    if (checkedIndex !== -1) return checkedIndex;
    const enabled = enabledIndices();
    return enabled.length > 0 ? enabled[0] : -1;
  }

  function selectAndFocus(index: number) {
    const item = items[index];
    if (!item) return;
    onSelect(item.value);
    nodesRef.current.get(item.value)?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const enabled = enabledIndices();
    if (enabled.length === 0) return;
    const pos = enabled.indexOf(index);

    let targetIndex: number | undefined;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        targetIndex = enabled[pos === -1 ? 0 : (pos + 1) % enabled.length];
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        targetIndex =
          enabled[pos === -1 ? enabled.length - 1 : (pos - 1 + enabled.length) % enabled.length];
        break;
      case 'Home':
        targetIndex = enabled[0];
        break;
      case 'End':
        targetIndex = enabled[enabled.length - 1];
        break;
      default:
        return;
    }

    event.preventDefault();
    selectAndFocus(targetIndex);
  }

  /** Props to spread onto each `role="radio"` button, alongside the
   * caller's own `role`, `aria-checked`, `onClick`, `disabled`, etc. */
  function getRadioProps(value: T): RovingRadioProps {
    const index = items.findIndex((item) => item.value === value);
    return {
      ref: (node) => {
        if (node) nodesRef.current.set(value, node);
        else nodesRef.current.delete(value);
      },
      tabIndex: index === rovingIndex() ? 0 : -1,
      onKeyDown: (event) => handleKeyDown(event, index),
    };
  }

  return { getRadioProps };
}
