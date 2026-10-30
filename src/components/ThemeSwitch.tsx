import { setDark, useDark } from '../lib/theme.ts'

// The dark mode switch at the top right (John, 23 October, after DPD's tracking page): a sun
// in light mode, a moon in dark. On a phone the "Dark" label is dropped; the switch keeps its name for screen readers.
export function ThemeSwitch() {
  const dark = useDark()
  return (
    <button type="button" className="theme-switch" role="switch" aria-checked={dark} aria-label="Dark mode" onClick={() => setDark(!dark)}>
      <span className="theme-switch-label" aria-hidden="true">Dark</span>
      <span className="theme-switch-track" aria-hidden="true">
        <span className="theme-switch-knob">
          {dark ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
          )}
        </span>
      </span>
    </button>
  )
}
