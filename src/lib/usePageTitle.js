import { useEffect } from 'react'

// Sets the browser tab title for a screen.
export function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · CIRF` : 'CIRF · Community Infrastructure Repair Fund Tracker'
  }, [title])
}
