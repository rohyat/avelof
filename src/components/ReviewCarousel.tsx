import { Children, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'

export default function ReviewCarousel({ children }: { children: ReactNode }) {
  const railRef = useRef<HTMLDivElement>(null)
  const slides = Children.toArray(children)
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 900px)').matches)
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [paused, setPaused] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [visibleCount, setVisibleCount] = useState(1)
  const lastIndex = Math.max(0, slides.length - visibleCount)

  useEffect(() => {
    const size = window.matchMedia('(max-width: 900px)')
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updateSize = () => setCompact(size.matches)
    const updateMotion = () => setReducedMotion(motion.matches)
    size.addEventListener('change', updateSize)
    motion.addEventListener('change', updateMotion)
    return () => { size.removeEventListener('change', updateSize); motion.removeEventListener('change', updateMotion) }
  }, [])

  useLayoutEffect(() => {
    const stop = () => setPaused(true)
    window.addEventListener('avelof:pause-review-carousel', stop)
    return () => window.removeEventListener('avelof:pause-review-carousel', stop)
  }, [])

  useEffect(() => {
    const rail = railRef.current
    if (!rail || !slides.length) return
    const sync = () => {
      const card = rail.firstElementChild
      if (!(card instanceof HTMLElement) || !card.offsetWidth) return
      const gap = Number.parseFloat(getComputedStyle(rail).columnGap) || 0
      const visible = Math.max(1, Math.round((rail.clientWidth + gap) / (card.offsetWidth + gap)))
      setVisibleCount(visible)
      setActiveIndex(Math.min(Math.max(0, slides.length - visible), Math.round(rail.scrollLeft / (card.offsetWidth + gap))))
    }
    const observer = new ResizeObserver(sync)
    observer.observe(rail)
    const frame = requestAnimationFrame(sync)
    rail.addEventListener('scroll', sync, { passive: true })
    return () => { observer.disconnect(); cancelAnimationFrame(frame); rail.removeEventListener('scroll', sync) }
  }, [compact, slides.length])

  useEffect(() => {
    if (!compact || reducedMotion || paused || hovered || lastIndex === 0) return
    const timer = window.setInterval(() => {
      const rail = railRef.current
      if (!rail || document.hidden) return
      const card = rail.firstElementChild
      if (!(card instanceof HTMLElement)) return
      const gap = Number.parseFloat(getComputedStyle(rail).columnGap) || 0
      const current = Math.round(rail.scrollLeft / (card.offsetWidth + gap))
      const next = current >= lastIndex ? 0 : current + 1
      const target = rail.children[next]
      if (target instanceof HTMLElement) rail.scrollTo({ left: target.offsetLeft, behavior: 'smooth' })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [compact, reducedMotion, paused, hovered, lastIndex])

  function showReview(index: number) {
    setPaused(true)
    const rail = railRef.current
    const target = rail?.children[Math.max(0, Math.min(lastIndex, index))]
    if (rail && target instanceof HTMLElement) rail.scrollTo({ left: target.offsetLeft, behavior: reducedMotion ? 'instant' : 'smooth' })
  }

  function handleKey(event: KeyboardEvent<HTMLDivElement>) {
    if (!compact) return
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault()
      showReview(activeIndex + (event.key === 'ArrowRight' ? 1 : -1))
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      showReview(event.key === 'Home' ? 0 : lastIndex)
    }
  }

  function stopForInteraction(target: EventTarget | null) {
    if (target instanceof Element) setPaused(true)
  }

  return <div className="review-carousel" role="region" aria-label="Guest reviews" aria-roledescription={compact ? 'carousel' : undefined}
    onPointerEnter={(event) => { if (event.pointerType === 'mouse') setHovered(true) }} onPointerLeave={() => setHovered(false)}
    onPointerDownCapture={(event) => stopForInteraction(event.target)} onFocusCapture={(event) => stopForInteraction(event.target)}>
    <div className="review-grid review-carousel-rail" ref={railRef} tabIndex={compact && slides.length > 1 ? 0 : undefined} onKeyDown={handleKey} aria-label={compact ? 'Review slides' : undefined}>{slides}</div>
    {slides.length > 1 && <div className="review-carousel-controls">
      <div className="review-carousel-dots" role="group" aria-label="Choose a review">{Array.from({ length: lastIndex + 1 }, (_, index) => <button key={index} type="button" className={`offer-dot${index === activeIndex ? ' is-active' : ''}`} title={`Review ${index + 1}`} aria-label={`Show review ${index + 1}`} aria-current={index === activeIndex ? 'true' : undefined} onClick={() => showReview(index)} />)}</div>
    </div>}
  </div>
}