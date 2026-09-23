import { useEffect } from 'react'
import { useLocation } from 'react-router'

// React Router changes the page without the browser's own jump to #section, so links
// like /#how-it-works would land at the top. This scrolls to the section instead, both
// when the page opens with a hash and when a link changes it.
export function useScrollToHash() {
  const { hash, key } = useLocation()

  useEffect(() => {
    if (!hash) return
    document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView({ block: 'start' })
  }, [hash, key])
}
