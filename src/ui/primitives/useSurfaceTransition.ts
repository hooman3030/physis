import { useCallback, useEffect, useRef, useState, type AnimationEvent } from 'react'

type SurfacePhase = 'open' | 'opening' | 'closing' | 'closed'

export function useSurfaceTransition(open: boolean) {
  const [phase, setPhase] = useState<SurfacePhase>(open ? 'open' : 'closed')
  const previousOpen = useRef(open)

  useEffect(() => {
    if (previousOpen.current === open) return
    previousOpen.current = open

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setPhase(open ? 'open' : 'closed')
      return
    }

    setPhase(open ? 'opening' : 'closing')
  }, [open])

  const onAnimationEnd = useCallback((event: AnimationEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return

    if (event.animationName.endsWith('-enter')) {
      setPhase((current) => (current === 'opening' ? 'open' : current))
    } else if (event.animationName.endsWith('-exit')) {
      setPhase((current) => (current === 'closing' ? 'closed' : current))
    }
  }, [])

  return {
    ariaHidden: !open,
    className: `surface-transition surface-transition--${phase}`,
    hidden: phase === 'closed',
    inert: !open,
    onAnimationEnd,
  }
}
