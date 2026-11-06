import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { ArrowRight, Menu, MessageCircle, X } from 'lucide-react'
import { business } from '../config'
import { hotels, rentalCars, tourPackages } from '../data/catalog'
import BookingModal from './BookingModal'
import type { BookingKind } from '../types'

export interface SiteContext {
  openBooking: (kind: BookingKind, selectedItem?: string) => void
}

const navItems = [
  ['Tour Packages', '/tour-packages'], ['Car Rentals', '/car-rentals'], ['Hotels', '/hotels'],
  ['Destinations', '/destinations'], ['Reviews', '/reviews'], ['About Us', '/about'], ['Contact', '/contact'],
]
const currentYear = new Date().getFullYear()

export default function SiteLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [booking, setBooking] = useState<{ kind: BookingKind; item?: string } | null>(null)
  const [plannerVisible, setPlannerVisible] = useState(false)
  const location = useLocation()

  useEffect(() => {
    const planners = ['visit-planner', 'custom-trip', 'package-planner']
      .map((id) => document.getElementById(id))
      .filter((planner): planner is HTMLElement => planner !== null)
    if (!planners.length) return
    const observer = new IntersectionObserver((entries) => setPlannerVisible(entries.some((entry) => entry.isIntersecting)))
    planners.forEach((planner) => observer.observe(planner))
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
      '/reviews': { title: 'Traveller Stories | AVELOF', description: 'Learn about AVELOF review previews and share your Kashmir travel experience.' },
      '/about': { title: 'About AVELOF | Kashmir Travel, Thoughtfully', description: 'Meet AVELOF, a Kashmir travel company focused on thoughtful journeys and local expertise.' },
      '/contact': { title: 'Contact AVELOF | Plan a Kashmir Trip', description: 'Email AVELOF or prepare an enquiry to start planning your Kashmir journey.' },
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
      <div className="topline"><span>A more personal Kashmir journey starts here.</span><a href="/#custom-trip">Build your trip <ArrowRight size={14} /></a></div>
      <header className="site-header">
        <Link className="brand" to="/" aria-label="AVELOF home" onClick={closeMenu}><span className="brand-mark">A</span><span>AVELOF<small>JOURNEYS BEYOND IMAGINATION</small></span></Link>
        <button className="icon-button menu-toggle" aria-label={menuOpen ? 'Close menu' : 'Open menu'} onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? <X /> : <Menu />}</button>
        <nav className={menuOpen ? 'main-nav is-open' : 'main-nav'} aria-label="Main navigation">
          {navItems.map(([label, href]) => <NavLink key={href} to={href} onClick={closeMenu}>{label}</NavLink>)}
          <button className="button button-dark nav-book" onClick={() => { openBooking('package'); closeMenu() }}>Enquire Now <ArrowRight size={15} /></button>
        </nav>
      </header>
      <main key={location.pathname}><Outlet context={{ openBooking } satisfies SiteContext} /></main>
      <footer className="site-footer">
        <div className="footer-main">
          <div className="footer-brand"><Link className="brand brand-light" to="/"><span className="brand-mark">A</span><span>AVELOF<small>JOURNEYS BEYOND IMAGINATION</small></span></Link><p>Journeys with a sense of place.<br />Made thoughtfully, in Kashmir.</p></div>
          <div><h3>Explore</h3><Link to="/tour-packages">Tour packages</Link><Link to="/car-rentals">Car rentals</Link><Link to="/hotels">Hotels & stays</Link><Link to="/destinations">Destinations</Link></div>
          <div><h3>AVELOF</h3><Link to="/about">Our story</Link><Link to="/reviews">Reviews</Link><Link to="/contact">Contact</Link><a href={business.instagram} target="_blank" rel="noreferrer">Instagram</a></div>
          <div><h3>Email our team</h3><a href={`mailto:${business.email}`}>{business.email}</a><span>Kashmir, India</span></div>
        </div>
        <div className="footer-bottom"><span>© {currentYear} AVELOF. All journeys begin with a conversation.</span><a href={business.website}>avelof.in</a></div>
      </footer>
      <button className="button floating-enquiry" hidden={location.pathname === '/destinations' && plannerVisible} onClick={() => { openBooking('package'); closeMenu() }}><MessageCircle size={19} /> Enquire Now <ArrowRight size={16} /></button>
      {booking && <BookingModal kind={booking.kind} selectedItem={booking.item} onClose={() => setBooking(null)} />}
    </>
  )
}

