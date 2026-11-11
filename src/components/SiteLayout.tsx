import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigationType } from 'react-router-dom'
import { ArrowRight, Menu, MessageCircle, X } from 'lucide-react'
import { business } from '../config'
import { hotels, rentalCars, tourPackages } from '../data/catalog'
import AskAIWidget from './AskAIWidget'
import BookingModal from './BookingModal'
import OfferBanner from './OfferBanner'
import type { BookingKind } from '../types'

export interface SiteContext {
  openBooking: (kind: BookingKind, selectedItem?: string) => void
}

const navItems = [
  ['Tour Packages', '/tour-packages'], ['Car Rentals', '/car-rentals'], ['Hotels', '/hotels'],
  ['Destinations', '/destinations'], ['Reviews', '/reviews'], ['About & Contact', '/about'],
  ['Check Bookings', '/my-enquiries'],
]
const currentYear = new Date().getFullYear()
const scrollStoragePrefix = 'avelof:scroll:'

interface SavedScrollPosition {
  x: number
  y: number
  savedAt: number
}

function readScrollPosition(key: string): SavedScrollPosition | null {
  try {
    const saved = sessionStorage.getItem(`${scrollStoragePrefix}${key}`)
    if (!saved) return null
    const position = JSON.parse(saved) as SavedScrollPosition
    if (Date.now() - position.savedAt > 24 * 60 * 60 * 1000) {
      sessionStorage.removeItem(`${scrollStoragePrefix}${key}`)
      return null
    }
    return position
  } catch {
    return null
  }
}

function saveScrollPosition(key: string, x: number, y: number) {
  try {
    sessionStorage.setItem(`${scrollStoragePrefix}${key}`, JSON.stringify({ x, y, savedAt: Date.now() }))
  } catch {
    return
  }
}

export default function SiteLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [booking, setBooking] = useState<{ kind: BookingKind; item?: string } | null>(null)
  const [workflowVisible, setWorkflowVisible] = useState(false)
  const location = useLocation()
  const navigationType = useNavigationType()
  const previousLocation = useRef({ pathname: location.pathname, hash: location.hash })

  useLayoutEffect(() => {
    window.history.scrollRestoration = 'manual'
  }, [])

  useLayoutEffect(() => {
    const previous = previousLocation.current
    if (location.hash) {
      const targetId = decodeURIComponent(location.hash.slice(1))
      document.getElementById(targetId)?.scrollIntoView({ block: 'start' })
    } else if (navigationType === 'POP') {
      const saved = readScrollPosition(location.key)
      window.scrollTo({ left: saved?.x ?? 0, top: saved?.y ?? 0, behavior: 'instant' })
    } else if (previous.pathname !== location.pathname || previous.hash) {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    }
    previousLocation.current = { pathname: location.pathname, hash: location.hash }
  }, [location.hash, location.key, location.pathname, navigationType])

  useEffect(() => {
    let frame = 0
    let pendingPosition = { x: window.scrollX, y: window.scrollY }
    const save = () => {
      pendingPosition = { x: window.scrollX, y: window.scrollY }
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        saveScrollPosition(location.key, pendingPosition.x, pendingPosition.y)
      })
    }
    const saveOnPageHide = () => saveScrollPosition(location.key, window.scrollX, window.scrollY)
    window.addEventListener('scroll', save, { passive: true })
    window.addEventListener('pagehide', saveOnPageHide)
    return () => {
      if (frame) saveScrollPosition(location.key, pendingPosition.x, pendingPosition.y)
      window.removeEventListener('scroll', save)
      window.removeEventListener('pagehide', saveOnPageHide)
    }
  }, [location.key])

  useEffect(() => {
    const workflows = ['visit-planner', 'custom-trip', 'package-planner', 'share-review']
      .map((id) => document.getElementById(id))
      .filter((workflow): workflow is HTMLElement => workflow !== null)
    if (!workflows.length) return
    const observer = new IntersectionObserver((entries) => setWorkflowVisible(entries.some((entry) => entry.isIntersecting)))
    workflows.forEach((workflow) => observer.observe(workflow))
    return () => observer.disconnect()
  }, [location.pathname])

  useEffect(() => {
    const catalogItem = [...tourPackages, ...rentalCars, ...hotels].find((item) => item.id === location.pathname.split('/').at(-1))
    const pageDetails: Record<string, { title: string; description: string }> = {
      '/': { title: 'AVELOF | Discover Kashmir, Beyond the Ordinary', description: 'Thoughtfully planned Kashmir journeys, stays and transport from local travel specialists at AVELOF.' },
      '/tour-packages': { title: 'Kashmir Tour Packages | AVELOF', description: 'Explore thoughtfully planned Kashmir tour packages with local expertise, flexible itineraries and handpicked stays.' },
      '/car-rentals': { title: 'Kashmir Car Rentals | AVELOF', description: 'Find comfortable vehicles and local drivers for airport transfers, day trips and Kashmir journeys.' },
      '/hotels': { title: 'Kashmir Hotels & Stays | AVELOF', description: 'Discover houseboats, boutique hotels, family stays and mountain retreats across Kashmir.' },
      '/destinations': { title: 'Kashmir Places & Visit Planner | AVELOF', description: 'Compare Srinagar driving distances, discover Kashmir attractions and select destinations for a personalised visit enquiry.' },
      '/reviews': { title: 'Guest Reviews | AVELOF', description: 'Read guest reviews and share your Kashmir experience for publication after consent.' },
      '/about': { title: 'About & Contact AVELOF | Kashmir Travel', description: 'Meet AVELOF, your local Kashmir travel team. Call, email or prepare a trip enquiry with us.' },
      '/contact': { title: 'Contact AVELOF | Plan a Kashmir Trip', description: 'Call, email or WhatsApp AVELOF to start planning your Kashmir journey.' },
      '/my-enquiries': { title: 'Check Your Bookings | AVELOF', description: 'View your private AVELOF booking enquiry summary.' },
      '/admin/panel': { title: 'Owner Enquiry Dashboard | AVELOF', description: 'Private AVELOF owner sign-in.' },
      '/admin/panel/reviews': { title: 'Review Moderation | AVELOF', description: 'Private AVELOF review approval dashboard.' },
    }
    const details = catalogItem
      ? { title: `${catalogItem.name} | AVELOF Kashmir`, description: catalogItem.description }
      : pageDetails[location.pathname] ?? { title: 'AVELOF | Kashmir Travel', description: 'Discover thoughtful travel experiences in Kashmir with AVELOF.' }
    document.title = details.title
    document.querySelector('meta[name="description"]')?.setAttribute('content', details.description)
  }, [location.pathname])

  const openBooking = (kind: BookingKind, selectedItem?: string) => setBooking({ kind, item: selectedItem })
  const closeMenu = () => setMenuOpen(false)

  return (
    <>
      <OfferBanner />
      <header className="site-header">
        <Link className="brand" to="/" aria-label="AVELOF home" onClick={closeMenu}><span className="brand-mark">A</span><span>AVELOF<small>JOURNEYS BEYOND IMAGINATION</small></span></Link>
        <button className="icon-button menu-toggle" aria-label={menuOpen ? 'Close menu' : 'Open menu'} onClick={() => { const next = !menuOpen; setMenuOpen(next); if (next) window.dispatchEvent(new Event('avelof:pause-review-carousel')) }}>{menuOpen ? <X /> : <Menu />}</button>
        <nav className={menuOpen ? 'main-nav is-open' : 'main-nav'} aria-label="Main navigation">
          {navItems.map(([label, href]) => <NavLink key={href} to={href} onClick={closeMenu}>{label}</NavLink>)}
        </nav>
      </header>
      <main><Outlet context={{ openBooking } satisfies SiteContext} /></main>
      <footer className="site-footer">
        <div className="footer-main">
          <div className="footer-brand"><Link className="brand brand-light" to="/"><span className="brand-mark">A</span><span>AVELOF<small>JOURNEYS BEYOND IMAGINATION</small></span></Link><p>Journeys with a sense of place.<br />Made thoughtfully, in Kashmir.</p></div>
          <div><h3>Explore</h3><Link to="/tour-packages">Tour packages</Link><Link to="/car-rentals">Car rentals</Link><Link to="/hotels">Hotels & stays</Link><Link to="/destinations">Destinations</Link></div>
          <div><h3>AVELOF</h3><Link to="/about">About & Contact</Link><Link to="/reviews">Reviews</Link><Link to="/my-enquiries">Check bookings</Link><a href={business.instagram} target="_blank" rel="noreferrer">Instagram</a></div>
          <div><h3>Email our team</h3><a href={`mailto:${business.email}`}>{business.email}</a><span>Kashmir, India</span></div>
        </div>
        <div className="footer-bottom"><span>© {currentYear} AVELOF. All journeys begin with a conversation.</span><a href={business.website}>avelof.in</a></div>
      </footer>
      <button className="button floating-enquiry" hidden={workflowVisible || location.pathname.startsWith('/my-enquiries') || location.pathname.startsWith('/admin/')} onClick={() => { openBooking('package'); closeMenu() }}><MessageCircle size={19} /> Enquire Now <ArrowRight size={16} /></button>
      <AskAIWidget hidden={location.pathname.startsWith('/my-enquiries') || location.pathname.startsWith('/admin/')} />
      {booking && <BookingModal kind={booking.kind} selectedItem={booking.item} onClose={() => setBooking(null)} />}
    </>
  )
}

