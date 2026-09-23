import { useLayoutEffect } from 'react'

const STAGGER_S = 0.06 // between blocks that come into view together
const MAX_STAGGER_S = 0.24

// The public pages' scroll reveal: every element marked `data-reveal` fades and rises
// into place as it scrolls into view (styles in global.css). It's kept quick so nobody
// waits on it:
//   - anything already on screen (or scrolled past) when the page opens is left alone
//   - so are cards in a row that scrolls sideways (How it works on phones), which would
//     otherwise fade in mid-swipe
//   - the animation is 0.45s, and blocks arriving together are staggered by at most 0.24s
//   - each block animates once, then goes back to its own styles
//   - with "reduce motion" set, or without IntersectionObserver, nothing moves
// Without JavaScript nothing is ever hidden, since only this hook hides anything.
export function useScrollReveal() {
  useLayoutEffect(() => {
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined

    const scrollsSideways = (element) => ['auto', 'scroll'].includes(getComputedStyle(element.parentElement).overflowX)
    const below = [...document.querySelectorAll('[data-reveal]')].filter(
      (element) => element.getBoundingClientRect().top > window.innerHeight && !scrollsSideways(element),
    )

    const done = (event) => {
      if (event.target !== event.currentTarget) return
      const element = event.currentTarget
      element.removeEventListener('transitionend', done)
      element.classList.remove('revealed')
      element.style.removeProperty('--reveal-delay')
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const arriving = entries.filter((entry) => entry.isIntersecting).map((entry) => entry.target)
        arriving.forEach((element, index) => {
          observer.unobserve(element)
          element.style.setProperty('--reveal-delay', `${Math.min(index * STAGGER_S, MAX_STAGGER_S)}s`)
          element.addEventListener('transitionend', done)
          element.classList.replace('reveal-pending', 'revealed')
        })
      },
      // Start just before a block is fully in view, so it's settled by the time it's read.
      { rootMargin: '0px 0px -6% 0px' },
    )

    for (const element of below) {
      element.classList.add('reveal-pending')
      observer.observe(element)
    }

    return () => {
      observer.disconnect()
      for (const element of below) {
        element.removeEventListener('transitionend', done)
        element.classList.remove('reveal-pending', 'revealed')
      }
    }
  }, [])
}
