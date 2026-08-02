import { useEffect, useRef } from 'react';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Makes a modal usable by keyboard: Escape closes it, Tab cycles inside it, and
 * focus returns where it came from.
 *
 * Without this a modal is a one-way door. Tab walks out of the dialog and into
 * the page behind it — which is still rendered and still focusable — so a
 * keyboard user ends up interacting with controls they cannot see, under an
 * overlay they cannot dismiss. Sighted mouse users never encounter any of it,
 * which is why it ships (TD-008).
 *
 * Usage:
 *   const ref = useModalA11y<HTMLDivElement>(onClose);
 *   return <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="…">
 *
 * Deliberately does NOT close on backdrop click. This app's modal holds API
 * keys mid-entry, and a stray click outside would discard them with no undo.
 * Escape and the close button are both explicit.
 */
export function useModalA11y<T extends HTMLElement>(onClose: () => void) {
  const containerRef = useRef<T | null>(null);
  // Kept in a ref so a re-rendered parent passing a new closure does not tear
  // down and re-add the listener — which would steal focus on every keystroke.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusable = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );

    // Focus the first control rather than the container: a screen reader then
    // announces the dialog and lands the user somewhere they can act.
    const first = focusable()[0];
    (first ?? container).focus({ preventScroll: true });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;

      const items = focusable();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }

      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;

      // Wrap at both ends, and pull focus back if it has already escaped the
      // dialog (a stray programmatic focus, or a control removed mid-tab).
      if (e.shiftKey && (active === firstItem || !container.contains(active))) {
        e.preventDefault();
        lastItem.focus();
      } else if (!e.shiftKey && (active === lastItem || !container.contains(active))) {
        e.preventDefault();
        firstItem.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      // Return focus to whatever opened the dialog. Without this the user is
      // dropped at the top of the document and has to tab back to where they were.
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, []);

  return containerRef;
}
