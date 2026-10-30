import { useEffect, useState } from 'react';

/** True below the given width. Used to pick between genuinely different
 *  markup (e.g. a table vs. a stacked card list), not just different CSS —
 *  a real JS check, so only one layout's inputs/refs ever exist in the DOM
 *  at once. (A CSS-only show/hide would leave both layouts' <input> refs
 *  fighting over the same ref keys, silently breaking keyboard navigation
 *  in whichever one lost.) */
export function useIsNarrow(breakpoint: number): boolean {
  const [narrow, setNarrow] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= breakpoint : false,
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const handler = () => setNarrow(mq.matches);
    handler();
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [breakpoint]);
  return narrow;
}
