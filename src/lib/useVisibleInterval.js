import { useEffect, useRef } from 'react'

// Calls `callback` every `ms` while the tab is visible, and straight away when someone
// comes back to the tab. CIRF polls the API instead of listening to Firestore (see
// server/README.md), so a hidden tab must not keep spending the free daily reads.
export function useVisibleInterval(callback, ms, enabled = true) {
  const latest = useRef(callback)
  useEffect(() => {
    latest.current = callback
  })

  useEffect(() => {
    if (!enabled) return undefined
    const tick = () => {
      if (document.visibilityState === 'visible') latest.current()
    }
    const timer = setInterval(tick, ms)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [ms, enabled])
}
