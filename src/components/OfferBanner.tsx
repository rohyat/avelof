import { useEffect, useRef, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { rentalCars, tourPackages } from '../data/catalog'
import { diwaliReferencePrice } from '../data/offers'
import DiscountLabel from './DiscountLabel'

const startingCab = rentalCars.reduce((lowest, car) => car.price < lowest.price ? car : lowest)
const offers = [
  ...tourPackages.filter((item) => !item.underDevelopment).map((item) => ({
    id: item.id,
    title: `${item.name} package`,
    description: `Kashmir escape · ${item.duration}`,
    image: item.image,
    price: item.price,
    originalPrice: item.originalPrice,
    priceLabel: 'per person',
    referenceLabel: 'Original price',
    href: `/tour-packages/${item.id}`,
  })),
  {
    id: 'cabs', title: 'Cabs', description: 'Transfers & sightseeing · Vehicle only',
    image: startingCab.image, price: startingCab.price, originalPrice: diwaliReferencePrice(startingCab.price),
    priceLabel: 'from / day', referenceLabel: 'Before offer', href: '/car-rentals',
  },
]

export default function OfferBanner() {
  const railRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const stopped = hovered || focused || reducedMotion

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(preference.matches)
    preference.addEventListener('change', update)
    return () => preference.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (stopped) return
    const timer = window.setInterval(() => {
      const rail = railRef.current
      if (!rail || document.hidden) return
      const index = (Math.round(rail.scrollLeft / rail.clientWidth) + 1) % offers.length
      rail.scrollTo({ left: index * rail.clientWidth, behavior: 'smooth' })
    }, 2500)
    return () => window.clearInterval(timer)
  }, [stopped])

  function showOffer(index: number) {
    const rail = railRef.current
    if (!rail) return
    const next = (index + offers.length) % offers.length
    rail.scrollTo({ left: next * rail.clientWidth, behavior: reducedMotion ? 'instant' : 'smooth' })
  }

  return <section className="offer-banner" aria-label="Diwali offers">
    <div className="offer-banner-heading"><div className="offer-heading-line"><span className="offer-diya" role="img" aria-label="Diwali diya lamp">🪔</span><strong>Diwali offer · 30% off</strong></div><span className="offer-heading-subtitle">Packages &amp; cabs</span></div>
    <div className="offer-carousel" role="region" aria-roledescription="carousel" aria-label="Packages and cabs offers"
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      onPointerDownCapture={() => setFocused(false)}
      onFocusCapture={(event) => setFocused(event.target.matches(':focus-visible'))} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false) }}>
      <div className="offer-rail" ref={railRef}
        onScroll={(event) => setActiveIndex(Math.round(event.currentTarget.scrollLeft / event.currentTarget.clientWidth))}
        onKeyDown={(event) => { if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); showOffer(activeIndex + (event.key === 'ArrowRight' ? 1 : -1)) } }}>
        {offers.map((offer, index) => <article key={offer.id} className={`offer-tile${offer.id === 'cabs' ? ' offer-tile-cabs' : ''}`} role="group" aria-roledescription="slide" aria-label={`${index + 1} of ${offers.length}: ${offer.title}`}>
          <div className="offer-image-frame"><img src={offer.image} alt="" /></div>
          <div className="offer-tile-copy"><strong>{offer.title}</strong><span>{offer.description}</span>
            {offer.originalPrice !== undefined && <span className="offer-reference-price">{offer.referenceLabel} <s>₹{offer.originalPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</s><DiscountLabel price={offer.price} originalPrice={offer.originalPrice} /></span>}
            <span className="offer-payable"><b>₹{offer.price.toLocaleString('en-IN', { minimumFractionDigits: Number.isInteger(offer.price) ? 0 : 2, maximumFractionDigits: 2 })}</b> {offer.priceLabel}</span>
          </div>
          <Link className="offer-explore" to={offer.href} tabIndex={activeIndex === index ? 0 : -1} aria-label={`Explore ${offer.title}`}>Explore Now <ArrowRight size={14} /></Link>
        </article>)}
      </div>
      <div className="offer-controls">
        {offers.map((offer, index) => <button key={offer.id} className={`offer-dot${index === activeIndex ? ' is-active' : ''}`} type="button" title={offer.title} aria-label={`Show ${offer.title} offer`} aria-current={index === activeIndex ? 'true' : undefined} onClick={() => showOffer(index)} />)}
      </div>
    </div>
  </section>
}