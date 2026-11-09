// The button that shares a chart as a picture (John, November 9th 2026): "Share chart" on a touch screen, which opens the phone's
// share sheet; "Copy chart" on a computer, with "Copied" just under it once done (John). If neither works the picture is saved.
import { useEffect, useRef, useState } from 'react';
import { shareVerb, type Delivered } from '../lib/shareImage.ts';

export function ShareButton({ what, make, disabled }: { what: string; make: () => Promise<Delivered>; disabled?: boolean }) {
  const [status, setStatus] = useState('');
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const verb = shareVerb();
  const go = async () => {
    window.clearTimeout(timer.current);
    setStatus('');
    const r = await make();
    const words = r === 'copied' ? 'Copied' : r === 'saved' ? 'Saved as a picture' : '';
    setStatus(words);
    if (words) timer.current = window.setTimeout(() => setStatus(''), 4000);
  };
  return (
    <span className="share-wrap">
      <button type="button" className="cmp-share" onClick={go} disabled={disabled}>
        {verb === 'Copy' ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="9" y="9" width="12" height="12" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 15V3" />
            <path d="m7 8 5-5 5 5" />
            <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
          </svg>
        )}
        {verb} {what}
      </button>
      <span className="share-status" role="status">
        {status}
      </span>
    </span>
  );
}
