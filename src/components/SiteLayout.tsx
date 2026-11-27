import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigationType } from 'react-router-dom'
import { Menu, Moon, Sun, X } from 'lucide-react'
import { business } from '../config'
import { rentalCars, tourPackages } from '../data/catalog'
import BookingModal from './BookingModal'
import OfferBanner from './OfferBanner'
import { createWhatsAppUrl } from '../services/bookingService'
import WhatsAppIcon from './WhatsAppIcon'
import InstallApp from './InstallApp'
import type { BookingKind } from '../types'
import { regionFromPath, regionHomePath } from '../data/regions'
import { ladakhPages } from '../data/ladakh'
import { ladakhJourneys } from '../data/ladakhJourneys'

export interface SiteContext {
  openBooking: (kind: BookingKind, selectedItem?: string) => void
}

const navItems = [
  ['Tour Packages', '/tour-packages'], ['Local Trips', '/local-trips'], ['Car Rentals', '/car-rentals'], ['Hotels', '/hotels'],
  ['Destinations', '/destinations'], ['Check Bookings', '/my-enquiries'],
  ['About & Contact', '/about'],
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
  const [darkMode, setDarkMode] = useState(() => {
    try { return localStorage.getItem('avelof:theme') === 'dark' }
    catch (error) { console.warn('Could not read the saved theme preference.', error); return false }
  })
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLElement>(null)
  const menuToggleRef = useRef<HTMLButtonElement>(null)
  const [booking, setBooking] = useState<{ kind: BookingKind; item?: string } | null>(null)
  const location = useLocation()
  const region = regionFromPath(location.pathname)
  const isLadakh = region === 'Ladakh'
  const homePath = regionHomePath(region)
  const destinationName = region
  const visibleNavItems = isLadakh ? [
    ['Packages', '/ladakh/packages'], ['Bike Trips', '/ladakh/bike-trips'],
    ['Hotels', '/ladakh/hotels'], ['Cabs', '/ladakh/car-rentals'],
    ['Drivers', '/ladakh/drivers'], ['Places', '/ladakh/places'],
    ['Contact', '/ladakh/contact'],
  ] : region === 'Jammu' ? [['Hotels', '/jammu/hotels'], ['Drivers', '/jammu/drivers'], ['Register your hotel', '/register-hotel'], ['Register as a driver', '/register-driver'], ['Explore Kashmir', '/']] : navItems
  const navigationType = useNavigationType()
  const previousLocation = useRef({ pathname: location.pathname, hash: location.hash })

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light'
    try { localStorage.setItem('avelof:theme', darkMode ? 'dark' : 'light') }
    catch (error) { console.warn('Could not save the theme preference.', error) }
  }, [darkMode])

  useEffect(() => {
    const syncTheme = (event: StorageEvent) => {
      if (event.key === 'avelof:theme' || event.key === null) setDarkMode(event.newValue === 'dark')
    }
    window.addEventListener('storage', syncTheme)
    return () => window.removeEventListener('storage', syncTheme)
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    const dismissOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target) && !menuToggleRef.current?.contains(event.target)) setMenuOpen(false)
    }
    const dismissEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setMenuOpen(false); menuToggleRef.current?.focus() }
    }
    document.addEventListener('pointerdown', dismissOutside)
    document.addEventListener('keydown', dismissEscape)
    return () => {
      document.removeEventListener('pointerdown', dismissOutside)
      document.removeEventListener('keydown', dismissEscape)
    }
  }, [menuOpen])

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

  useLayoutEffect(() => {
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
      cancelAnimationFrame(frame)
      if (frame) saveScrollPosition(location.key, pendingPosition.x, pendingPosition.y)
      window.removeEventListener('scroll', save)
      window.removeEventListener('pagehide', saveOnPageHide)
    }
  }, [location.key])

  useEffect(() => {
    const catalogItem = [...tourPackages, ...rentalCars].find((item) => item.id === location.pathname.split('/').at(-1))
    const pageDetails: Record<string, { title: string; description: string }> = {
      '/': { title: 'AVELOF | Experience Kashmir Beyond Expectations', description: "Where Kashmir's natural beauty meets quality stays, comfortable journeys and genuine local care." },
      '/ladakh': { title: 'Ladakh Holidays & Bike Trip Planning | AVELOF', description: 'Explore proposed summer Ladakh routes, motorcycle journeys, stays and travel guidance. Prices, departures and availability require confirmation.' },
      '/tour-packages': { title: 'Kashmir Tour Packages | AVELOF', description: 'Explore thoughtfully planned Kashmir tour packages with local expertise, flexible itineraries and handpicked stays.' },
      '/car-rentals': { title: 'Kashmir Car Rentals | AVELOF', description: 'Find comfortable vehicles and local drivers for airport transfers, day trips and Kashmir journeys.' },
      '/hotels': { title: 'Kashmir Hotels & Houseboats | AVELOF', description: 'Discover houseboats, boutique hotels, family stays and mountain retreats across Kashmir.' },
      '/destinations': { title: 'Kashmir Places & Destination Guide | AVELOF', description: 'Explore Kashmir places, main attractions, seasonal guidance and optional activities, then customise your journey in the trip planner.' },
      '/activities': { title: 'Kashmir Activities | AVELOF', description: 'Browse Kashmir activity inspiration by destination and category, then request your favourites when planning a trip. Suggestions are not a live availability feed.' },
      '/local-trips': { title: 'Local Trips in Kashmir | AVELOF', description: 'Enquire about Kashmir treks, picnic destinations and local transport for families and friends.' },
      '/food-and-shopping': { title: 'Kashmir Restaurants, Shops & Handicrafts | AVELOF', description: 'Discover AVELOF-approved restaurants, shops and handicraft businesses across Kashmir by destination. In-person discovery only; no online ordering or checkout.' },
      '/register-business': { title: 'Register Your Business | AVELOF', description: 'Submit your Kashmir restaurant, shop or handicraft business for review, with item headings, descriptions and photos.' },
      '/business-status': { title: 'Private Business Status | AVELOF', description: 'Check and edit your restaurant, shop or handicraft business registration with your private status access code.' },
      '/admin/panel/businesses': { title: 'Food & Shopping Registrations | AVELOF', description: 'Private AVELOF business registration approval and moderation dashboard.' },
      '/travel-guide': { title: 'Kashmir Travel Guide | AVELOF', description: 'Prepare for your Kashmir holiday with seasonal advice, packing tips and practical travel essentials.' },
      '/reviews': { title: 'Guest Reviews | AVELOF', description: 'Read guest reviews and share your Kashmir experience for publication after consent.' },
      '/about': { title: 'About AVELOF | Your Kashmir Travel Companion', description: 'Discover AVELOF: locally rooted travel expertise, quality stays, comfortable transportation and personalised Kashmir holiday planning.' },
      '/contact': { title: 'Contact AVELOF | Plan a Kashmir Trip', description: 'Call, email or WhatsApp AVELOF to start planning your Kashmir journey.' },
      '/my-enquiries': { title: 'Check Your Bookings | AVELOF', description: 'View your private AVELOF booking enquiry summary.' },
      '/admin/panel': { title: 'Owner Enquiry Dashboard | AVELOF', description: 'Private AVELOF owner sign-in.' },
      '/admin/panel/reviews': { title: 'Review Moderation | AVELOF', description: 'Private AVELOF review approval dashboard.' },
      '/admin/panel/hotels': { title: 'Hotel Registrations | AVELOF', description: 'Private AVELOF hotel approval dashboard.' },
      '/register-hotel': { title: 'Register Your Hotel or Houseboat | AVELOF', description: 'Submit your Kashmir hotel or houseboat for AVELOF review and approval.' },
      '/hotel-status': { title: 'Private Hotel Status | AVELOF', description: 'Check your hotel registration with your private access code.' },
      '/partners': { title: 'Partner with AVELOF | Kashmir', description: 'Registration for hotel owners and driver partners.' },
      '/register-driver': { title: 'Register as a Driver | AVELOF', description: 'Submit your vehicle for AVELOF approval.' },
      '/driver-status': { title: 'Private Driver Status | AVELOF', description: 'Check your driver registration with a private access code.' },
      '/admin/panel/drivers': { title: 'Driver Registrations | AVELOF', description: 'Private AVELOF driver approval dashboard.' },
    }
    const section = location.pathname.split('/')[2]
    const journey = ladakhJourneys.find((trip) => location.pathname === `/ladakh/${trip.section}/${trip.id}`)
    const ladakhDetails = regionFromPath(location.pathname) === 'Ladakh' && section
      ? Object.entries(ladakhPages).find(([key]) => key === section)?.[1]
      : undefined
    const regionalDirectory = regionFromPath(location.pathname) !== 'Kashmir' && (section === 'hotels' || section === 'drivers')
    const hotelComparison = /\/hotels\/compare$/.test(location.pathname)
    const details = hotelComparison
      ? { title: `Compare ${regionFromPath(location.pathname)} Hotels & Houseboats | AVELOF`, description: 'Compare approved hotel and houseboat photos, room rates, meals and facilities side by side.' }
      : journey
      ? { title: `${journey.name} | AVELOF Ladakh`, description: journey.description }
      : ladakhDetails
      ? { title: `${ladakhDetails.title} | AVELOF`, description: ladakhDetails.copy }
      : regionalDirectory
      ? { title: `${regionFromPath(location.pathname)} ${section === 'hotels' ? 'Hotels' : 'Drivers'} | AVELOF`, description: `Explore approved ${section === 'hotels' ? 'stays' : section} in ${regionFromPath(location.pathname)} with AVELOF.` }
      : catalogItem
      ? { title: `${catalogItem.name} | AVELOF Kashmir`, description: catalogItem.description }
      : pageDetails[location.pathname] ?? { title: `AVELOF | ${regionFromPath(location.pathname)} Travel`, description: `Discover thoughtful travel experiences in ${regionFromPath(location.pathname)} with AVELOF.` }
    document.title = details.title
    document.querySelector('meta[name="description"]')?.setAttribute('content', details.description)
    
    // Update or create Open Graph tags
    const updateMetaTag = (property: string, content: string) => {
      let tag = document.querySelector(`meta[property="${property}"]`)
      if (!tag) {
        tag = document.createElement('meta')
        tag.setAttribute('property', property)
        document.head.appendChild(tag)
      }
      tag.setAttribute('content', content)
    }
    
    updateMetaTag('og:title', details.title)
    updateMetaTag('og:description', details.description)
    updateMetaTag('og:url', window.location.href)
    
    // Add structured data for Organization (home page only)
    if (location.pathname === '/') {
      let script = document.querySelector('script[type="application/ld+json"][data-type="organization"]') as HTMLScriptElement
      if (!script) {
        script = document.createElement('script')
        script.type = 'application/ld+json'
        script.setAttribute('data-type', 'organization')
        document.head.appendChild(script)
      }
      script.textContent = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Organization',
        'name': 'AVELOF',
        'url': 'https://avelof.pages.dev',
        'logo': 'https://avelof.pages.dev/app-icon-512.png',
        'description': 'Thoughtfully planned Kashmir and Ladakh journeys with quality stays, comfortable transport and local expertise',
        'address': {
          '@type': 'PostalAddress',
          'addressRegion': 'Jammu & Kashmir',
          'addressCountry': 'IN'
        },
        'contactPoint': {
          '@type': 'ContactPoint',
          'contactType': 'Sales'
        },
        'sameAs': ['https://www.instagram.com/avelof']
      })
    }
    
    // Add LocalBusiness schema
    if (location.pathname === '/about') {
      let script = document.querySelector('script[type="application/ld+json"][data-type="localbusiness"]') as HTMLScriptElement
      if (!script) {
        script = document.createElement('script')
        script.type = 'application/ld+json'
        script.setAttribute('data-type', 'localbusiness')
        document.head.appendChild(script)
      }
      script.textContent = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'LocalBusiness',
        'name': 'AVELOF',
        'image': 'https://avelof.pages.dev/app-icon-512.png',
        'description': 'Kashmir and Ladakh Travel Planner',
        'url': 'https://avelof.pages.dev',
        'address': {
          '@type': 'PostalAddress',
          'addressLocality': 'Srinagar',
          'addressRegion': 'Jammu & Kashmir',
          'addressCountry': 'IN'
        },
        'geo': {
          '@type': 'GeoCoordinates',
          'latitude': '34.1526',
          'longitude': '77.5771'
        },
        'sameAs': ['https://www.instagram.com/avelof']
      })
    }
  }, [location.pathname])

  const openBooking = (kind: BookingKind, selectedItem?: string) => setBooking({ kind, item: selectedItem })
  const closeMenu = () => setMenuOpen(false)
  const returnHome = (event: MouseEvent<HTMLAnchorElement>) => {
    closeMenu()
    if (location.pathname === homePath && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && event.button === 0) {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    }
  }

  return (
    <>
      {region === 'Kashmir' && <OfferBanner />}
      <header className="site-header">
        <div className="header-brand-group">
          <Link className="brand" to={homePath} aria-label="AVELOF home" onClick={returnHome}><img className="brand-logo" src="/app-icon-512.png?v=chinar-1" alt="" width={44} height={44} /><span>AVELOF<small>BEYOND EXPECTATIONS</small></span></Link>
          <button type="button" className="theme-toggle" role="switch" aria-label="Dark mode" aria-checked={darkMode} onClick={() => setDarkMode((current) => !current)}>{darkMode ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}<span className="theme-toggle-track" aria-hidden="true"><span className="theme-toggle-thumb" /></span></button>
        </div>
        <button ref={menuToggleRef} className="icon-button menu-toggle" aria-expanded={menuOpen} aria-controls="main-navigation" aria-label={menuOpen ? 'Close menu' : 'Open menu'} onClick={() => { const next = !menuOpen; setMenuOpen(next); if (next) window.dispatchEvent(new Event('avelof:pause-review-carousel')) }}>{menuOpen ? <X /> : <Menu />}</button>
        <nav ref={menuRef} id="main-navigation" className={menuOpen ? 'main-nav is-open' : 'main-nav'} aria-label="Main navigation">
          {visibleNavItems.map(([label, href]) => <NavLink key={href} to={href} onClick={closeMenu}>{label}</NavLink>)}
        </nav>
      </header>
      <main>
        <Outlet context={{ openBooking } satisfies SiteContext} />
      </main>
      <a className="whatsapp-float" href={createWhatsAppUrl(`Hello AVELOF, I would like help planning my ${destinationName} journey.`)} target="_blank" rel="noreferrer" aria-label="Chat with AVELOF on WhatsApp" title="Chat with AVELOF on WhatsApp"><WhatsAppIcon size={28} /></a>
      <footer className="site-footer">
        <div className="footer-main">
          <div className="footer-brand"><Link className="brand brand-light" to={homePath} aria-label="AVELOF home" onClick={returnHome}><img className="brand-logo" src="/app-icon-512.png?v=chinar-1" alt="" width={44} height={44} /><span>AVELOF<small>YOUR {destinationName.toUpperCase()} EXPERIENCE</small></span></Link><p>Your stay. Your journey.<br />Your {destinationName} experience.</p></div>
          <div><h3>Explore</h3>{region !== 'Kashmir' ? <>{visibleNavItems.map(([label, href]) => <Link key={href} to={href}>{label}</Link>)}{isLadakh && <><Link to="/ladakh/travel-guide">Travel guide</Link><Link to="/ladakh/experiences">Experiences</Link><Link to="/ladakh/partners">Partner with AVELOF</Link></>}<Link to="/">Explore Kashmir</Link></> : <><Link to="/tour-packages">Tour packages</Link><Link to="/local-trips">Local Trips</Link><Link to="/car-rentals">Car rentals</Link><Link to="/drivers">Our drivers</Link><Link to="/hotels">Hotels</Link><Link to="/destinations">Destinations</Link><Link to="/partners">Partner with AVELOF</Link></>}</div>
          <div><h3>AVELOF</h3><Link to="/about">About & Contact</Link><Link to="/reviews">Reviews</Link><Link to="/my-enquiries">Check bookings</Link><a href={business.instagram} target="_blank" rel="noreferrer">Instagram</a><InstallApp /><Link to="/admin/panel">Admin sign-in</Link></div>
          <div><h3>Email our team</h3><a href={`mailto:${business.email}`}>{business.email}</a><span>Kashmir, India</span></div>
        </div>
        <div className="footer-bottom"><span>© {currentYear} AVELOF. All journeys begin with a conversation.</span><a href={business.website}>avelof.in</a></div>
      </footer>
      {booking && <BookingModal kind={booking.kind} selectedItem={booking.item} region={region} onClose={() => setBooking(null)} />}
    </>
  )
}
