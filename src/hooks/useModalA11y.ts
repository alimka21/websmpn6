import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Hook a11y untuk modal:
 * - ESC key untuk close
 * - Focus trap (Tab / Shift+Tab cycling di dalam modal)
 * - Auto-focus elemen fokus pertama saat modal buka
 *
 * Cara pakai:
 *   const modalRef = useModalA11y<HTMLDivElement>(isOpen, () => setOpen(false));
 *   return isOpen && (
 *     <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="x-title">
 *       <h2 id="x-title">...</h2>
 *     </div>
 *   );
 */
export function useModalA11y<T extends HTMLElement = HTMLDivElement>(
  isOpen: boolean,
  onClose?: () => void
) {
  const containerRef = useRef<T | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Simpan onClose di ref supaya effect tidak re-run setiap parent re-render
  // (jika ada di deps array, focus akan terus-menerus pindah ke input pertama
  // tiap user mengetik di form di dalam modal).
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!isOpen) return;

    previouslyFocused.current = document.activeElement as HTMLElement;

    const focusFirst = () => {
      const focusables = containerRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusables && focusables.length > 0) {
        focusables[0].focus();
      } else {
        containerRef.current?.focus();
      }
    };

    const id = window.setTimeout(focusFirst, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onCloseRef.current) {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !containerRef.current) return;

      const focusables = containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        if (active === first || !containerRef.current.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last || !containerRef.current.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.clearTimeout(id);
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused.current?.focus?.();
    };
  }, [isOpen]);

  return containerRef;
}
