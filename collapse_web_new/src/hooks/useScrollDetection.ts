import { useEffect, useRef, useState } from 'react'

// Detects when a ref'd section is scrolled near the top of the viewport
// (within `threshold` px), used to show/hide a sticky overlay while the
// section is "in view". Pass active=false to disable and force inView=false.
export function useScrollDetection(active: boolean, threshold = 80) {
  const sectionRef = useRef<HTMLDivElement | null>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    if (!active) {
      setInView(false)
      return
    }
    const handleScroll = () => {
      const section = sectionRef.current
      if (!section) return
      const rect = section.getBoundingClientRect()
      const isActive = rect.top <= threshold && rect.bottom > threshold
      setInView(isActive)
    }
    const scrollOptions: AddEventListenerOptions = { passive: true }
    handleScroll()
    window.addEventListener('scroll', handleScroll, scrollOptions)
    window.addEventListener('resize', handleScroll)
    return () => {
      window.removeEventListener('scroll', handleScroll, scrollOptions)
      window.removeEventListener('resize', handleScroll)
    }
  }, [active, threshold])

  return { sectionRef, inView }
}
