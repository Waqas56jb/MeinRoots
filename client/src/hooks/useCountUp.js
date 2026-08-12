import { useEffect, useRef, useState } from 'react'

const easeOut = (t) => 1 - Math.pow(1 - t, 3)

/**
 * Counts a numeric value up once its element scrolls into view.
 * Accepts strings like "12+", "< 60s" or "3" — the prefix and suffix are kept
 * intact and only the number animates.
 */
export function useCountUp(raw, duration = 1600) {
  const ref = useRef(null)
  const [value, setValue] = useState(null)

  const match = String(raw).match(/^(\D*)([\d.,]+)(.*)$/)
  const prefix = match ? match[1] : ''
  const suffix = match ? match[3] : ''
  const target = match ? Number(match[2].replace(/,/g, '')) : null
  const decimals = match && match[2].includes('.') ? match[2].split('.')[1].length : 0

  useEffect(() => {
    const node = ref.current
    if (!node || target === null) return

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    const run = () => {
      if (prefersReduced) {
        setValue(target)
        return
      }
      const started = performance.now()
      const tick = (now) => {
        const p = Math.min((now - started) / duration, 1)
        setValue(target * easeOut(p))
        if (p < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }

    if (typeof IntersectionObserver === 'undefined') {
      run()
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          run()
          observer.disconnect()
        }
      },
      { threshold: 0.4 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [target, duration])

  const text =
    target === null || value === null
      ? raw
      : `${prefix}${value.toLocaleString('en-US', {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })}${suffix}`

  return [ref, text]
}
