import BackButton from '../components/BackButton'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { ArrowLeft, ArrowRight, Backpack, CalendarDays, CloudSun, CreditCard, HeartHandshake, IdCard, Leaf, MapPin, Pill, Route, Shirt, ShoppingBag, Smartphone, Snowflake, Sparkles, Sun, TicketCheck, Timer, Utensils, Wine } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { travelGuideSections } from '../data/travelGuide'
import MapLocationLink from '../components/MapLocationLink'
import ActivityIcon from '../components/ActivityIcon'
import WhatsAppIcon from '../components/WhatsAppIcon'
import { createWhatsAppUrl } from '../services/bookingService'
import SearchAutocomplete from '../components/SearchAutocomplete'
import { searchSuggestions } from '../services/searchSuggestions'
import { activities, activityAvailabilityNote, activityCategories, activityDestinations } from '../data/activities'
import { businessKindLabels, businessKinds, businessLocations } from '../data/businessRegistration'
import type { BusinessKind, PublicBusiness } from '../services/businessSchema'
import { businessErrorText, loadPublicBusinesses } from '../services/businessService'

function DiscoveryLayout({ title, eyebrow, copy, children }: { title: string; eyebrow: string; copy: string; children: ReactNode }) {
  return <>
    <section className="page-hero">
      <div className="page-width">
        <div className="breadcrumb"><BackButton /><Link to="/">Home</Link><span>/</span><span>{title}</span></div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{copy}</p>
      </div>
    </section>
    <section className="section page-width discovery-content" aria-label={title}>{children}</section>
  </>
}

export function ActivitiesPage() {
  const location = useLocation()
  const navigationState = location.state as { tripReturn?: { sectionId?: string; returnPath?: string } } | null
  const returnContext = navigationState?.tripReturn
  const tripReturn = (returnContext?.sectionId === 'custom-trip' && returnContext.returnPath === '/')
    || (returnContext?.sectionId === 'package-planner' && returnContext.returnPath === '/tour-packages')
  const plannerUrl = tripReturn ? `${returnContext?.returnPath}#${returnContext?.sectionId}` : '/#custom-trip'
  const requestedActivity = new URLSearchParams(location.search).get('activity')
  const initialActivity = activities.find((activity) => activity.id === requestedActivity)
  const [destination, setDestination] = useState('')
  const [category, setCategory] = useState('')
  const [search, setSearch] = useState(initialActivity?.name ?? '')
  const [limit, setLimit] = useState(12)
  const [selectedId, setSelectedId] = useState<string | null>(initialActivity?.id ?? null)
  const searchItems = activities.map((activity) => ({ id: activity.id, label: activity.name, detail: `${activity.destination} / ${activity.category}` }))
  const matches = searchSuggestions(searchItems, search)
  const filtered = activities.filter((activity) => (!destination || activity.destination === destination) && (!category || activity.category === category) && (selectedId ? activity.id === selectedId : `${activity.name} ${activity.destination} ${activity.description} ${activity.season}`.toLowerCase().includes(search.trim().toLowerCase()) || matches.some((item) => item.id === activity.id)))
  return <DiscoveryLayout title="Activities" eyebrow="More ways to experience Kashmir" copy="Browse experiences by destination, then request your favourites when you plan a trip. This is an inspiration catalogue, not a live availability feed.">
    {tripReturn && <Link className="button button-outline trip-return-button" to={plannerUrl}><ArrowLeft size={16} aria-hidden="true" /> Back to your trip</Link>}
    <div className="discovery-notice"><Sparkles size={28} aria-hidden="true" /><h2>Your places. Your experiences.</h2><p>{activityAvailabilityNote}</p><p>ATV, motorbike and other entries marked for operator verification are enquiries only, not verified operating services. Winter sports require suitable snow; routes may close at any time.</p><Link className="button button-dark" to={plannerUrl}>Choose activities in Plan a trip <ArrowRight size={16} aria-hidden="true" /></Link></div>
    <div className="activity-filters">
      <label>Destination<select value={destination} onChange={(event) => { setDestination(event.target.value); setLimit(12) }}><option value="">All destinations</option>{activityDestinations.map((place) => <option key={place}>{place}</option>)}</select></label>
      <label>Activity category<select value={category} onChange={(event) => { setCategory(event.target.value); setLimit(12) }}><option value="">All categories</option>{activityCategories.map((item) => <option key={item}>{item}</option>)}</select></label>
      <SearchAutocomplete label="Search activities" placeholder="Try shikara, skiing or ATV" value={search} items={searchItems} storageKey="avelof:recent-activity-searches" submitLabel="Find activity" suggestionsLabel="Activity suggestions" recentLabel="Recent activity searches" onChange={(value) => { setSearch(value); setSelectedId(null); setLimit(12) }} onSelect={(item) => {
        setSearch(item.label); setSelectedId(item.id); setDestination(''); setCategory(''); setLimit(12)
        requestAnimationFrame(() => { const heading = document.getElementById(`activity-${item.id}`); heading?.focus({ preventScroll: true }); heading?.closest('article')?.scrollIntoView({ block: 'start', behavior: 'smooth' }) })
      }} />
    </div>
    <p role="status">{filtered.length} activities match · showing {Math.min(limit, filtered.length)}</p>
    <div className="discovery-grid">{filtered.slice(0, limit).map((activity) => <article className="discovery-card activity-card" key={activity.id}>
      <p className="eyebrow">{activity.destination} / {activity.category}</p><h2 className="discovery-card-heading" id={`activity-${activity.id}`} tabIndex={-1}><ActivityIcon activity={activity} /><span>{activity.name}</span></h2><p>{activity.description}</p><p><strong>When:</strong> {activity.season}</p><p>{activity.note}</p>{activity.operatorCheck && <strong className="activity-check-note">Operator verification required</strong>}<small>Price and availability on enquiry. Not included in package estimates.</small>
    </article>)}</div>
    {!filtered.length && <div className="empty-state"><h2>No matching activities</h2><p>Try a different destination, category or search.</p><button className="button button-outline" onClick={() => { setDestination(''); setCategory(''); setSearch(''); setSelectedId(null); setLimit(12) }}>Clear filters</button></div>}
    {filtered.length > limit && <button className="button button-outline" onClick={() => setLimit((current) => current + 12)}>Load more activities</button>}
  </DiscoveryLayout>
}

export function FoodAndShoppingPage() {
  const [kind, setKind] = useState<BusinessKind | ''>('')
  const [location, setLocation] = useState('')
  const [businesses, setBusinesses] = useState<PublicBusiness[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    loadPublicBusinesses({ kind: kind || undefined, location: location || undefined }, controller.signal)
      .then(setBusinesses)
      .catch((failure: unknown) => { if (!controller.signal.aborted) { setBusinesses([]); setError(businessErrorText(failure)) } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [kind, location])
  return <DiscoveryLayout title="Food & Shopping" eyebrow="Discover a taste of Kashmir" copy="Find approved restaurants and local shops by destination. Listings are for discovery and in-person visits only.">
    <div className="discovery-notice"><h2><MapPin size={26} aria-hidden="true" /><span>Discover here. Visit in person.</span></h2><p>AVELOF publishes participating businesses only after review. This directory does not provide food orders, online purchases, checkout or payments. Business hours and availability may change; confirm directly with the business. No discounts are promised.</p><Link className="button button-outline" to="/register-business">Register a restaurant or shop <ArrowRight size={16} aria-hidden="true" /></Link></div>
    <div className="activity-filters" aria-label="Food and shopping filters">
      <label>Business type<select value={kind} onChange={(event) => { setBusinesses([]); setLoading(true); setError(''); setKind(event.target.value as BusinessKind | '') }}><option value="">All businesses</option>{businessKinds.map((value) => <option key={value} value={value}>{businessKindLabels[value]}</option>)}</select></label>
      <label>Destination<select value={location} onChange={(event) => { setBusinesses([]); setLoading(true); setError(''); setLocation(event.target.value) }}><option value="">All destinations</option>{businessLocations.map((place) => <option key={place}>{place}</option>)}</select></label>
    </div>
    {loading && <p role="status">Loading approved businesses…</p>}
    {error && <p role="alert" className="enquiry-error">{error}</p>}
    {!loading && !error && <p role="status">{businesses.length} approved {businesses.length === 1 ? 'business' : 'businesses'} match these filters.</p>}
    <div className="discovery-grid">{businesses.map((business) => <article className="discovery-card" key={business.id}>
      <div className="hotel-photo-grid">{(business.photos ?? [business.photo]).map((photo, index) => <img key={photo} src={photo} alt={`${business.name}, photo ${index + 1} of shop, restaurant or products in ${business.location}`} loading="lazy" />)}</div>
      <p className="eyebrow">{business.location} / {businessKindLabels[business.kind] === 'Restaurant' ? <><Utensils size={14} aria-hidden="true" /> Restaurant</> : <><ShoppingBag size={14} aria-hidden="true" /> Shop</>}</p>
      <h2>{business.name}</h2><p><strong>Address:</strong> {business.address}</p><p>{business.description}</p>
      {business.items.length > 0 && <div className="business-available-items"><h3>{business.kind === 'restaurant' ? 'Dishes to discover' : 'Find in store'}</h3><ul>{business.items.map((item, index) => <li key={`${index}-${item}`}>{business.kind === 'restaurant' ? <Utensils size={16} aria-hidden="true" /> : <ShoppingBag size={16} aria-hidden="true" />}<span>{item}</span></li>)}</ul></div>}
      <MapLocationLink location={business} />
      {business.website && <a className="text-link" href={business.website} target="_blank" rel="noreferrer">Visit business website <ArrowRight size={16} aria-hidden="true" /></a>}
      <small>Contact the business directly to confirm current opening and availability.</small>
    </article>)}</div>
    {!loading && !error && !businesses.length && <div className="empty-state"><h2>No approved listings match</h2><p>Try a different business type or destination, or check back as new businesses are approved.</p><button className="button button-outline" onClick={() => { if (kind || location) { setBusinesses([]); setLoading(true); setError(''); setKind(''); setLocation('') } }}>Clear filters</button></div>}
  </DiscoveryLayout>
}

const guideIcons = { season: CalendarDays, packing: Backpack, essentials: IdCard, journey: Route }
const guidePointIcons = { sun: Sun, snow: Snowflake, forecast: CloudSun, layers: Shirt, winter: Snowflake, medicine: Pill, identity: IdCard, phone: Smartphone, payment: CreditCard, time: Timer, tickets: TicketCheck, respect: HeartHandshake, alcohol: Wine, environment: Leaf }

export function TravelGuidePage() {
  return <DiscoveryLayout title="Travel Guide" eyebrow="A little preparation. A better journey." copy="Practical pointers for your Kashmir holiday, from choosing a season to packing for the mountains.">
    <div className="discovery-grid">{travelGuideSections.map((section) => {
      const Icon = guideIcons[section.icon]
      return <article className="discovery-card travel-guide-card" key={section.title}><h2 className="discovery-card-heading"><Icon size={24} aria-hidden="true" /><span>{section.title}</span></h2><ul>{section.points.map((point) => {
        const PointIcon = guidePointIcons[point.icon]
        return <li key={point.text}><div className="guide-point"><span>{point.text}</span><PointIcon size={18} aria-hidden="true" /></div></li>
      })}</ul></article>
    })}</div>
    <section className="travel-guide-help" aria-labelledby="travel-guide-help-title"><div><h2 id="travel-guide-help-title">Need help planning your trip?</h2><p>Have a question about your Kashmir visit? Speak with our team on WhatsApp.</p></div><a className="button button-dark" href={createWhatsAppUrl('Hello AVELOF, I have a question about your Kashmir travel guide.')} target="_blank" rel="noreferrer"><WhatsAppIcon size={22} />Contact us on WhatsApp</a></section>
    <div className="travel-guide-explore"><Link className="button button-outline" to="/destinations"><MapPin size={18} aria-hidden="true" />Find places for your trip <ArrowRight size={16} aria-hidden="true" /></Link></div>
  </DiscoveryLayout>
}
