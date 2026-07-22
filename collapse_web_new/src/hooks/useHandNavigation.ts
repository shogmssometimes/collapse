import { useCallback, useEffect, useRef, useState } from 'react'

// Tracks scroll-arrow visibility for a horizontally-scrolling hand carousel
// and exposes a helper to scroll it programmatically.
export function useHandNavigation(itemCount: number) {
  const handListRef = useRef<HTMLDivElement | null>(null)
  const [handNavState, setHandNavState] = useState({ left: false, right: false })

  const updateHandNav = useCallback(() => {
    const el = handListRef.current
    if (!el) return
    const { scrollLeft, scrollWidth, clientWidth } = el
    setHandNavState({
      left: scrollLeft > 4,
      right: scrollLeft + clientWidth < scrollWidth - 4,
    })
  }, [])

  const scrollHand = useCallback((direction: -1 | 1) => {
    const el = handListRef.current
    if (!el) return
    const amount = Math.max(el.clientWidth * 0.9, 220)
    el.scrollBy({ left: direction * amount, behavior: 'smooth' })
    window.setTimeout(updateHandNav, 220)
  }, [updateHandNav])

  useEffect(() => {
    updateHandNav()
  }, [itemCount, updateHandNav])

  useEffect(() => {
    const onResize = () => updateHandNav()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [updateHandNav])

  return { handListRef, handNavState, updateHandNav, scrollHand }
}
