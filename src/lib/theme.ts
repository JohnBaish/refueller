import { useSyncExternalStore } from 'react'

// Light or dark mode. Since 29 October (John, replacing "light unless the visitor switches"),
// the page follows the device's own setting until the visitor uses the switch; a switch set
// the same way as the device goes back to following the device, so only a choice that
// differs from it is kept ('light' or 'dark', in this browser only). The small script in
// index.html works out the same before the page draws, so there's no flash of the wrong
// colours. Blocked storage just means following the device, and the switch still works for
// the visit.
const KEY = 'refueller.theme'
const listeners = new Set<() => void>()
const media = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null

function deviceDark(): boolean {
  return media?.matches ?? false
}

function storedChoice(): boolean | null {
  try {
    const value = localStorage.getItem(KEY)
    return value === 'dark' ? true : value === 'light' ? false : null
  } catch {
    return null
  }
}

let chosen = storedChoice()
let dark = document.documentElement.dataset.theme === 'dark'

function apply(value: boolean) {
  dark = value
  if (value) document.documentElement.dataset.theme = 'dark'
  else delete document.documentElement.dataset.theme
  listeners.forEach((l) => l())
}

export function setDark(value: boolean) {
  chosen = value === deviceDark() ? null : value
  try {
    if (chosen === null) localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, chosen ? 'dark' : 'light')
  } catch {
    // Not kept; it still changes for this visit.
  }
  apply(value)
}

// The device switching between light and dark (by hand, or automatically at dusk) carries
// the page with it, unless the visitor has chosen otherwise.
media?.addEventListener('change', () => {
  if (chosen === null) apply(deviceDark())
})

export function useDark(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => dark,
  )
}
