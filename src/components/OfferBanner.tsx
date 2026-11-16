import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { ArrowRight, BedDouble, Snowflake } from 'lucide-react'
import { Link } from 'react-router-dom'
import { rentalCars } from '../data/catalog'
import { diwaliReferencePrice, featuredOfferHotelId } from '../data/offers'
import DiscountLabel from './DiscountLabel'
import { hotelPackagePriceInclusions } from '../services/pricing'
import { usePricing, useTourPackages } from '../services/pricingContext'
import { PricingNotice } from './PricingProvider'
import { useRegisteredHotels } from '../services/hotelService'

const startingCab = rentalCars.reduce((lowest, car) => car.price < lowest.price ? car : lowest)
interface BannerOffer {
  id: string
  title: string
  description: string
  image?: string
  price?: number
  originalPrice?: number
  discountPercent?: number
  priceLabel: string
  referenceLabel: string
  href: string
}
export default function OfferBanner() {
  const tourPackages = useTourPackages()
  const pricing = usePricing()
  const registered = useRegisteredHotels(true, featuredOfferHotelId)
  const hotel = registered.hotels.find((item) => item.id === featuredOfferHotelId)
  const offers: BannerOffer[] = [
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
    id: 'hotels', title: 'Hotels',
    description: hotel ? `${hotel.name} · ${hotel.location}` : 'Kashmir stays',
    image: hotel?.image, price: hotel?.price, originalPrice: hotel?.originalPrice, discountPercent: hotel?.discountPercent,
    priceLabel: hotel ? 'from / room / night · Room only' : '',
    referenceLabel: 'Original price', href: hotel ? `/hotels/${hotel.id}` : '/hotels',
  },
  {
    id: 'cabs', title: 'Cabs', description: 'Transfers & sightseeing · Vehicle only',
    image: startingCab.image, price: startingCab.price, originalPrice: diwaliReferencePrice(startingCab.price),
    priceLabel: 'from / day', referenceLabel: 'Before offer', href: '/car-rentals',
  },
]

  const railRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const activeOfferIndex = Math.min(activeIndex, offers.length - 1)
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
  }, [stopped, offers.length])

  function showOffer(index: number) {
    const rail = railRef.current
    if (!rail) return
    const next = (index + offers.length) % offers.length
    rail.scrollTo({ left: next * rail.clientWidth, behavior: reducedMotion ? 'instant' : 'smooth' })
  }

  if (pricing.loading || pricing.error || !pricing.settings) return <section className="offer-banner" aria-label="Travel offers"><PricingNotice /></section>
  return <section className="offer-banner" aria-label="Travel offers">
    <div className="offer-snow" aria-hidden="true">{Array.from({ length: 36 }, (_, index) => <span key={index} style={{
      left: `${(index * 37) % 100}%`,
      '--snow-size': `${6 + (index * 7 % 8) * .75}px`,
      '--snow-opacity': .85 + (index % 4) * .05,
      '--snow-blur': '0px',
      '--snow-drift': `${(index % 2 ? -1 : 1) * (12 + index * 7 % 32)}px`,
      '--snow-duration': `${4 + (index * 5 % 7) * .5}s`,
      '--snow-rotation': `${index * 47 % 360}deg`,
      '--snow-turn': `${index % 2 ? -90 : 90}deg`,
      '--snow-delay': `${-index * 2.7}s`,
    } as CSSProperties}><Snowflake size={12} strokeWidth={1.5} /></span>)}</div>
    <div className="offer-banner-heading"><div className="offer-heading-line"><Snowflake className="offer-winter-icon" size={28} aria-hidden="true" /><strong>Winter offers are live</strong></div><span className="offer-heading-subtitle">Flat {pricing.settings.discountPercent}% off on packages &amp; hotels · 30% off on cabs</span><span className="offer-heading-subtitle">{hotelPackagePriceInclusions}</span></div>
    <div className="offer-carousel" role="region" aria-roledescription="carousel" aria-label="Packages, hotels and cabs offers"
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      onPointerDownCapture={() => setFocused(false)}
      onFocusCapture={(event) => setFocused(event.target.matches(':focus-visible'))} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false) }}>
      <div className="offer-rail" ref={railRef}
        onScroll={(event) => setActiveIndex(Math.round(event.currentTarget.scrollLeft / event.currentTarget.clientWidth))}
        onKeyDown={(event) => { if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); showOffer(activeOfferIndex + (event.key === 'ArrowRight' ? 1 : -1)) } }}>
        {offers.map((offer, index) => <article key={offer.id} className={`offer-tile${offer.id === 'cabs' ? ' offer-tile-cabs' : ''}`} role="group" aria-roledescription="slide" aria-label={`${index + 1} of ${offers.length}: ${offer.title}`}>
          <div className="offer-image-frame">{offer.image ? <img src={offer.image} alt="" /> : <BedDouble className="offer-hotel-icon" size={40} aria-hidden="true" />}</div>
          <div className="offer-tile-copy"><strong>{offer.title}</strong><span>{offer.description}</span>
            {offer.id === 'hotels' && !hotel && <span role={registered.loading ? 'status' : 'alert'}>{registered.loading ? 'Loading current hotel offer...' : registered.error || 'Crown Prince is not currently listed.'}{registered.error && <> <button className="text-link" type="button" onClick={registered.reload}>Retry hotel offer</button></>}</span>}
            {offer.price !== undefined && offer.originalPrice !== undefined && offer.originalPrice > offer.price && <span className="offer-reference-price">{offer.referenceLabel} <s>₹{offer.originalPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</s>{offer.discountPercent === undefined ? <DiscountLabel price={offer.price} originalPrice={offer.originalPrice} /> : <span className="discount-label">{offer.discountPercent}% off</span>}</span>}
            <span className="offer-payable">{offer.price !== undefined && <b>₹{offer.price.toLocaleString('en-IN', { minimumFractionDigits: Number.isInteger(offer.price) ? 0 : 2, maximumFractionDigits: 2 })}</b>} {offer.priceLabel}</span>
          </div>
          <Link className="offer-explore" to={offer.href} tabIndex={activeOfferIndex === index ? 0 : -1} aria-label={`Explore ${offer.title}`}>Explore Now <ArrowRight size={14} /></Link>
        </article>)}
      </div>
      <div className="offer-controls">
        {offers.map((offer, index) => <button key={offer.id} className={`offer-dot${index === activeOfferIndex ? ' is-active' : ''}`} type="button" title={offer.title} aria-label={`Show ${offer.title} offer`} aria-current={index === activeOfferIndex ? 'true' : undefined} onClick={() => showOffer(index)} />)}
      </div>
    </div>
  </section>
}