import { useState } from 'react'
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom'
import { ArrowRight, BedDouble, BookOpen, CalendarDays, CarFront, ChevronDown, ClipboardList, Landmark, MapPin, Motorbike, Package, Phone, Route, ShieldCheck } from 'lucide-react'
import BackButton from '../components/BackButton'
import HolidayDestinations from '../components/HolidayDestinations'
import CallAssistance from '../components/CallAssistance'
import HeroTrustPoints from '../components/HeroTrustPoints'
import RegionalEnquiryForm from '../components/RegionalEnquiryForm'
import LadakhPlaces from '../components/LadakhPlaces'
import { business } from '../config'
import { ladakhEnquiryPreferences, ladakhFaqs, ladakhPackages, ladakhPages } from '../data/ladakh'
import { ladakhPlaces } from '../data/ladakhPlaces'
import type { LadakhSection } from '../data/ladakh'
import './ladakh.css'

const shortcuts = [
  { label: 'Plan a trip', path: 'contact', icon: Route },
  { label: 'Packages', path: 'packages', icon: Package },
  { label: 'Hotels & Stays', path: 'hotels', icon: BedDouble },
  { label: 'Cabs & Transfers', path: 'car-rentals', icon: CarFront },
  { label: 'Bike Trips', path: 'bike-trips', icon: Motorbike },
  { label: 'Places', path: 'places', icon: MapPin },
  { label: 'Travel Guide', path: 'travel-guide', icon: BookOpen },
  { label: 'Talk to AVELOF', path: 'contact', icon: Phone },
  { label: 'Drivers', path: 'drivers', icon: CarFront },
]

function PackageRoutes({ preview = false }: { preview?: boolean }) {
  const [start, setStart] = useState('All routes')
  const packages = ladakhPackages.filter((trip) => start === 'All routes' || trip.start === start)
  return <section className="section page-width">
    <p className="eyebrow">Choose the journey, then the stay</p><h2>Three routes to begin with.</h2>
    <p>Suggested itineraries only. Final routing, rest days and availability require local partner confirmation.</p>
    {!preview && <div className="ladakh-route-filters" role="group" aria-label="Filter routes by starting point">{['All routes', 'Leh', 'Srinagar'].map((value) => <button key={value} type="button" aria-pressed={start === value} onClick={() => setStart(value)}>{value === 'All routes' ? value : `From ${value}`}</button>)}</div>}
    <p className="ladakh-result-count" role="status">{packages.length} proposed {packages.length === 1 ? 'route' : 'routes'}</p>
    <div className="ladakh-card-grid">{packages.map((trip) => <article className="ladakh-card ladakh-route-card" key={trip.name}>
      <div className="ladakh-route-top"><span className="ladakh-route-label">{trip.label}</span><Route size={22} aria-hidden="true" /></div>
      <p className="eyebrow">{trip.duration}</p><h3>{trip.name}</h3>
      <ol className="ladakh-route-stops" aria-label={`${trip.name} route`}>{trip.stops.map((stop, index) => <li key={`${stop}-${index}`}>{stop}</li>)}</ol>
      <p>{trip.description}</p>
      {!preview && <details className="ladakh-outline"><summary>See journey outline <ChevronDown size={16} aria-hidden="true" /></summary><ol>{trip.outline.map((stage) => <li key={stage.days}><strong>{stage.days}</strong><p>{stage.detail}</p></li>)}</ol><p>Proposed outline, not a confirmed itinerary. Timing and stops may change.</p></details>}
      <Link className="text-link" to={preview ? '/ladakh/packages' : `/ladakh/contact?service=${encodeURIComponent(trip.name)}`} aria-label={`Discuss ${trip.name}`}>{preview ? 'Explore package options' : 'Discuss this route'} <ArrowRight size={16} aria-hidden="true" /></Link>
    </article>)}</div>
    {!preview && <RegionalEnquiryForm region="Ladakh" kind="package" preference={ladakhEnquiryPreferences.package} />}
  </section>
}

function AltitudeNotice() {
  return <div className="ladakh-notice"><ShieldCheck size={24} aria-hidden="true" /><p>Allow at least 48 hours in Leh before higher areas such as Khardung La and Pangong. Road arrival does not remove altitude risk. Suitability and current local guidance must be checked before travel.</p></div>
}

export default function LadakhPage({ section = 'home' }: { section?: LadakhSection }) {
  const [search] = useSearchParams()
  const { hash } = useLocation()
  const selectedRoute = ladakhPackages.find((trip) => trip.name === search.get('service'))?.name
  const selectedPlace = ladakhPlaces.find((place) => place.id === search.get('place'))
  const home = section === 'home'
  const legacySection = { '#packages': 'packages', '#bike-trips': 'bike-trips', '#transport': 'car-rentals', '#stays': 'hotels', '#places': 'places', '#experiences': 'experiences', '#travel-guide': 'travel-guide', '#contact': 'contact', '#plan': 'contact' }
  const legacyPath = Object.entries(legacySection).find(([key]) => key === hash)?.[1]
  if (home && legacyPath) return <Navigate to={`/ladakh/${legacyPath}`} replace />
  return <div className="ladakh-page">
    {home ? <>
      <HolidayDestinations destination="ladakh" />
      <section className="home-hero ladakh-hero"><div className="hero-content page-width">
          <span className="ladakh-season"><CalendarDays size={15} aria-hidden="true" /> Summer 2027 planning preview</span>
          <h1>Experience Ladakh.<br /><em>A different kind of journey.</em></h1>
          <p>High passes. Quiet monasteries. Open roads. Explore a holiday shaped around Ladakh, your pace and the journey ahead.</p>
          <HeroTrustPoints />
      </div></section>
      <section className="home-shortcuts"><nav className="home-shortcut-grid page-width" aria-label="Explore Ladakh">{shortcuts.map(({ label, path, icon: Icon }) => <Link className="home-shortcut-link" to={`/ladakh/${path}`} key={label}><span className="home-shortcut-icon"><Icon size={22} aria-hidden="true" /></span><span>{label}</span></Link>)}</nav><div className="page-width"><CallAssistance regional /></div></section>
      <section className="section page-width"><p className="eyebrow">Plan for the place</p><h2>Your route comes first.</h2><p>Start in Leh or travel from Srinagar via Kargil. Share your dates, group size, preferred pace and stay style before choosing a final itinerary.</p><AltitudeNotice /></section>
      <PackageRoutes preview />
      <LadakhPlaces preview />
      <section className="section page-width"><div className="ladakh-card-grid">
        <article className="ladakh-card"><Motorbike size={28} aria-hidden="true" /><h2>For the riders.</h2><p>Explore proposed motorcycle circuits and the checks before a ride.</p><Link className="text-link" to="/ladakh/bike-trips">Explore Bike Trips <ArrowRight size={16} /></Link></article>
        <article className="ladakh-card"><BedDouble size={28} aria-hidden="true" /><h2>Your Ladakh stay.</h2><p>Find approved hotels with their own facilities, rates and meal options.</p><Link className="text-link" to="/ladakh/hotels">Browse hotels <ArrowRight size={16} /></Link></article>
        <article className="ladakh-card"><CarFront size={28} aria-hidden="true" /><h2>The road ahead.</h2><p>Plan your transfers and meet approved driver partners based in Ladakh.</p><Link className="text-link" to="/ladakh/car-rentals">Explore cabs <ArrowRight size={16} /></Link></article>
      </div></section>
    </> : <section className="page-hero"><div className="page-width"><div className="breadcrumb"><BackButton /><Link to="/ladakh">Home</Link><span>/</span><span>Ladakh</span></div><h1>{ladakhPages[section].title}</h1><p>{ladakhPages[section].copy}</p><CallAssistance regional /></div></section>}

    {section === 'packages' && <PackageRoutes />}
    {section === 'bike-trips' && <section className="section page-width">
      <p className="eyebrow">For the riders</p><h2>Open roads, thoughtfully planned.</h2>
      <div className="ladakh-card-grid">
        <article className="ladakh-card"><Motorbike size={28} aria-hidden="true" /><h3>Leh-based riding circuit</h3><p>A proposed Leh - Nubra - Pangong - Leh ride, after acclimatisation and rider suitability checks.</p></article>
        <article className="ladakh-card"><Route size={28} aria-hidden="true" /><h3>Srinagar-entry expedition</h3><p>A longer journey via Kargil. Riding stages, bike collection and drop-off need operator confirmation.</p></article>
        <article className="ladakh-card"><ClipboardList size={28} aria-hidden="true" /><h3>Confirm before you ride</h3><p>Licence, experience, bike condition, protective gear, fuel, deposits, insurance, breakdown support and emergency arrangements must all be agreed.</p></article>
      </div>
      <AltitudeNotice /><p className="ladakh-notice">Bike departures are not open for booking yet. Bikes, support vehicles, ride leaders and equipment are not confirmed or included by default.</p>
      <RegionalEnquiryForm region="Ladakh" kind="package" preference={ladakhEnquiryPreferences.bike} />
    </section>}
    {section === 'car-rentals' && <section className="section page-width">
      <div className="ladakh-card"><CarFront size={28} aria-hidden="true" /><h2>Cabs &amp; Transfers</h2><p>Discuss private circuits, Leh airport pickups and Srinagar - Kargil - Leh transfers.</p><p>Local transport arrangements, vehicle changes, luggage capacity, fees and route access require confirmation.</p><Link className="button button-outline" to="/ladakh/drivers">Meet Ladakh drivers <ArrowRight size={16} /></Link></div>
      <RegionalEnquiryForm region="Ladakh" kind="car" preference={ladakhEnquiryPreferences.car} />
    </section>}
    {section === 'places' && <LadakhPlaces />}
    {section === 'experiences' && <section className="section page-width"><div className="ladakh-card"><Landmark size={28} aria-hidden="true" /><h2>Culture &amp; Experiences</h2><p>Monastery visits, village walks, local food and landscape photography.</p><p>Guided rafting or other paid activities can only be offered after seasonal and operator checks. Nothing is included automatically.</p><Link className="text-link" to="/ladakh/contact">Discuss experiences <ArrowRight size={16} /></Link></div></section>}
    {section === 'travel-guide' && <section className="section page-width"><h2>Travel prepared.</h2><AltitudeNotice /><ul className="ladakh-guide"><li>Summer road access depends on weather and official openings; no fixed opening date is guaranteed.</li><li>Travellers with health concerns should seek medical advice before high-altitude travel.</li><li>Documents, permits, fees and restricted-area access depend on nationality and current rules.</li><li>Remote stays may have limited power, heating and connectivity. Confirm facilities before committing.</li><li>Final quotes must state meals, fuel, activities, taxes, exclusions and disruption or cancellation terms.</li></ul><a className="text-link" href="https://leh.nic.in/48-hours-acclimatization-for-tourists-arriving-in-leh/" target="_blank" rel="noreferrer">Read the official Leh acclimatisation advisory <ArrowRight size={16} aria-hidden="true" /></a></section>}
    {(home || section === 'travel-guide') && <section className="section page-width ladakh-faq" aria-labelledby="ladakh-faq-heading"><div><p className="eyebrow">A few things worth knowing</p><h2 id="ladakh-faq-heading">Before you make plans.</h2></div><div className="ladakh-faq-list">{ladakhFaqs.map((faq) => <details key={faq.question}><summary>{faq.question}<ChevronDown size={18} aria-hidden="true" /></summary><p>{faq.answer}</p></details>)}</div></section>}
    {section === 'contact' && <section className="section page-width"><RegionalEnquiryForm key={selectedRoute ?? selectedPlace?.id ?? 'general'} region="Ladakh" preference={selectedRoute ?? ladakhEnquiryPreferences.contact} initialDetails={selectedPlace ? `I would like to explore ${selectedPlace.name}. Please help me plan a suitable route, time and stay options.` : undefined} /></section>}
    <section className="section page-width"><div className="ladakh-card ladakh-contact"><div><h2>Your Ladakh journey starts with a conversation.</h2><p>Share your dates, starting point and travel style. We will help you understand the next steps.</p>{section !== 'contact' && <Link className="text-link" to="/ladakh/contact">Send an enquiry <ArrowRight size={16} /></Link>}</div><div className="ladakh-contact-action"><a className="button button-dark" href={`tel:${business.phone.replace(/[^\d+]/g, '')}`}><Phone size={18} aria-hidden="true" /> Call AVELOF <ArrowRight size={17} aria-hidden="true" /></a><strong>{business.phone}</strong><p>A conversation is not a booking confirmation. Prices and availability still need checking.</p></div></div></section>
  </div>
}
