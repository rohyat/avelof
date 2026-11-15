import { Children, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'

export default function LocalTripCarousel({ children, label }: { children: ReactNode; label: string }) {
  const slides = Children.toArray(children)
  const railRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    const rail = railRef.current
    if (!rail) return
    const sync = () => {
      const first = rail.firstElementChild
      if (!(first instanceof HTMLElement)) return
      const gap = Number.parseFloat(getComputedStyle(rail).columnGap) || 0
      setActiveIndex(Math.max(0, Math.min(slides.length - 1, Math.round(rail.scrollLeft / (first.offsetWidth + gap)))))
    }
    const observer = new ResizeObserver(sync)
    observer.observe(rail)
    rail.addEventListener('scroll', sync, { passive: true })
    return () => { observer.disconnect(); rail.removeEventListener('scroll', sync) }
  }, [slides.length])

  function showSlide(index: number) {
    const rail = railRef.current
    const target = rail?.children[Math.max(0, Math.min(slides.length - 1, index))]
    if (rail && target instanceof HTMLElement) {
      rail.scrollTo({ left: target.offsetLeft, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
    }
  }

  function handleKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft' || event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      showSlide(event.key === 'Home' ? 0 : event.key === 'End' ? slides.length - 1 : activeIndex + (event.key === 'ArrowRight' ? 1 : -1))
    }
  }

  return <div className="local-trip-carousel" role="region" aria-label={label} aria-roledescription="carousel">
    <div className="local-trip-rail" ref={railRef} tabIndex={0} onKeyDown={handleKey} aria-label={`${label} slides`} style={{ gridTemplateColumns: `repeat(${slides.length}, var(--local-slide-width)) calc(100% - var(--local-slide-width) - 16px)` }}>
      {slides.map((slide, index) => <div className="local-trip-slide" key={index} role="group" aria-roledescription="slide" aria-label={`${index + 1} of ${slides.length}`}>{slide}</div>)}
    </div>
    <div className="local-carousel-controls">
      <button className="local-carousel-arrow" type="button" aria-label={`Previous ${label.toLowerCase()} card`} disabled={activeIndex === 0} onClick={() => showSlide(activeIndex - 1)}><ArrowLeft size={18} aria-hidden="true" /></button>
      <div className="local-carousel-dots" role="group" aria-label={`Choose ${label.toLowerCase()} card`}>
        {slides.map((_, index) => <button className={`offer-dot${activeIndex === index ? ' is-active' : ''}`} type="button" key={index} aria-label={`Show ${label.toLowerCase()} card ${index + 1}`} aria-current={activeIndex === index ? 'true' : undefined} onClick={() => showSlide(index)} />)}
      </div>
      <button className="local-carousel-arrow" type="button" aria-label={`Next ${label.toLowerCase()} card`} disabled={activeIndex === slides.length - 1} onClick={() => showSlide(activeIndex + 1)}><ArrowRight size={18} aria-hidden="true" /></button>
    </div>
  </div>
}
