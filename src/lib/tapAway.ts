import { useEffect, type RefObject } from 'react';

// A chart's date line and label (shown by a tap on a phone) go again when the visitor taps or clicks anywhere outside the chart
// (John, November 9th 2026: there was no way to remove them). Listens only while something is shown.
export function useTapAway(shown: boolean, ref: RefObject<Element | null>, clear: (none: null) => void) {
  useEffect(() => {
    if (!shown) return;
    const away = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) clear(null);
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [shown, ref, clear]);
}
