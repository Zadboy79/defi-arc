import { useState, useEffect, useRef } from 'react'

/**
 * Lerps a displayed number toward a live target, so balance updates feel smooth.
 * Only animates when target changes from a real live value.
 */
export function useLerpedNumber(target: number | null, speed = 0.12) {
  const [display, setDisplay] = useState(target ?? 0)
  const ref = useRef(target ?? 0)
  const raf = useRef(0)

  useEffect(() => {
    if (target === null) return
    const tick = () => {
      ref.current += (target - ref.current) * speed
      if (Math.abs(target - ref.current) < 0.0001) {
        ref.current = target
        setDisplay(target)
        return
      }
      setDisplay(ref.current)
      raf.current = requestAnimationFrame(tick)
    }
    cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [target, speed])

  return display
}
