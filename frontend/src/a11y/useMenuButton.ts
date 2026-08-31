import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

/**
 * Issue #268: shared keyboard/focus behavior for this app's first
 * `role="menu"` dropdown (the gallery header's create split-button), per
 * the WAI-ARIA Menu Button pattern
 * (https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/). Mirrors this
 * codebase's existing `useAlertDialogFocus`/`useRovingRadioGroup`
 * conventions (return focus to the trigger on close; arrow-key roving
 * navigation among items) rather than inventing a new one.
 *
 * - ArrowDown/Enter/Space on the trigger opens the menu with the first
 *   item focused; ArrowUp opens it with the last item focused.
 * - ArrowDown/ArrowUp move focus between menu items, wrapping at the
 *   ends; Home/End jump to the first/last item.
 * - Escape closes the menu and returns focus to the trigger. Tab closes
 *   the menu without moving focus itself (native Tab order continues).
 * - A pointerdown outside both the trigger and the menu closes it.
 * - Selecting an item (the caller's own `onClick`) is expected to call
 *   `close()` itself; this hook only owns open/closed state and focus.
 */
export function useMenuButton(itemCount: number) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);
  const pendingFocusIndex = useRef(0);

  function close() {
    setIsOpen(false);
  }

  function open(focusIndex = 0) {
    pendingFocusIndex.current = focusIndex;
    setIsOpen(true);
  }

  function toggle() {
    if (isOpen) close();
    else open(0);
  }

  useEffect(() => {
    if (isOpen) itemRefs.current[pendingFocusIndex.current]?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (itemRefs.current.some((node) => node?.contains(target))) return;
      close();
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isOpen]);

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      open(0);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      open(itemCount - 1);
    }
  }

  function onMenuKeyDown(event: KeyboardEvent<HTMLElement>, index: number) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        itemRefs.current[(index + 1) % itemCount]?.focus();
        break;
      case 'ArrowUp':
        event.preventDefault();
        itemRefs.current[(index - 1 + itemCount) % itemCount]?.focus();
        break;
      case 'Home':
        event.preventDefault();
        itemRefs.current[0]?.focus();
        break;
      case 'End':
        event.preventDefault();
        itemRefs.current[itemCount - 1]?.focus();
        break;
      case 'Escape':
        event.preventDefault();
        close();
        triggerRef.current?.focus();
        break;
      case 'Tab':
        close();
        break;
      default:
        break;
    }
  }

  function getItemRef(index: number) {
    return (node: HTMLElement | null) => {
      itemRefs.current[index] = node;
    };
  }

  return { isOpen, open, close, toggle, triggerRef, onTriggerKeyDown, onMenuKeyDown, getItemRef };
}
