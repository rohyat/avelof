import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, Check, Compass, Mail, MapPin, Phone, Plus, Users } from 'lucide-react'
import { Link, useLocation, useNavigate, useOutletContext, useParams, useSearchParams } from 'react-router-dom'
import { business } from '../config'
import { destinations, hotels, rentalCars, tourPackages } from '../data/catalog'
import BookingModal, { EnquiryForm } from '../components/BookingModal'
import TripPlanner from '../components/TripPlanner'
import DiscountLabel from '../components/DiscountLabel'
import OfferPrice from '../components/OfferPrice'
import HotelRates from '../components/HotelRates'
import VehiclePhotoCaption from '../components/VehiclePhotoCaption'
import { clearSavedTripPlan } from '../services/tripPlanStorage'
import type { CatalogItem, CatalogKind, Hotel, PreparedRequest, RentalCar, TourPackage } from '../types'
import type { SiteContext } from '../components/SiteLayout'

const allItems: Record<CatalogKind, CatalogItem[]> = { package: tourPackages, car: rentalCars, hotel: hotels }
const hotelLocations = [...new Set(hotels.map((hotel) => hotel.location))]
const routeFor: Record<CatalogKind, string> = { package: '/tour-packages', car: '/car-rentals', hotel: '/hotels' }
function useBooking() {
  return useOutletContext<SiteContext>().openBooking
}

function kindFromPath(path: string): CatalogKind {
  if (path.startsWith('/car-rentals')) return 'car'
  if (path.startsWith('/hotels')) return 'hotel'
  return 'package'
}

function money(value: number) {
  return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: Number.isInteger(value) ? 0 : 2, maximumFractionDigits: 2 })}`
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="eyebrow">{children}</p>
}

function SectionHeading({ eyebrow, title, copy, link, to }: { eyebrow: string; title: string; copy?: string; link?: string; to?: string }) {
  return <div className="section-heading"><div><Eyebrow>{eyebrow}</Eyebrow><h2>{title}</h2>{copy && <p>{copy}</p>}</div>{link && to && <Link className="text-link" to={to}>{link}<ArrowRight size={16} /></Link>}</div>
}

function CatalogCard({ item: initialItem, kind }: { item: CatalogItem; kind: CatalogKind }) {
  const openBooking = useBooking()
  const [searchParams] = useSearchParams()
  const minimumSeats = Number(searchParams.get('seats')) || 0
  const seatingOptions = initialItem.kind === 'car' && initialItem.category === 'Tempo Traveller' ? rentalCars.filter((car) => car.category === 'Tempo Traveller' && car.seats >= minimumSeats) : []
  const [selectedVehicleId, setSelectedVehicleId] = useState(initialItem.id)
  const item: CatalogItem = seatingOptions.length > 0 ? seatingOptions.find((car) => car.id === selectedVehicleId) ?? seatingOptions[0] : initialItem
  const detailUrl = `${routeFor[kind]}/${item.id}`
  const underDevelopment = item.kind === 'package' && item.underDevelopment
  return (
    <article className={`catalog-card${underDevelopment ? ' is-under-development' : ''}${item.kind === 'car' ? ' vehicle-card' : ''}`}>
      {underDevelopment ? <div className="catalog-image"><img src={item.image} alt={`${item.name}, ${item.location}`} loading="lazy" /><span className="image-tag">Under development</span></div> : <Link to={detailUrl} className="catalog-image"><img src={item.image} alt={item.kind === 'hotel' ? 'Illustrative bedroom photo' : `${item.name}, ${item.location}`} loading="lazy" /><span className="image-tag">{item.category}</span><span className="image-arrow"><ArrowUpRight size={17} /></span></Link>}
      <div className="catalog-content"><div className="catalog-meta"><span><MapPin size={13} /> {item.location.split('·')[0]}</span>{item.kind === 'package' && <span>{item.duration}</span>}</div>
        {item.kind === 'car' && <VehiclePhotoCaption vehicle={item} />}
        {item.kind === 'hotel' && <p className="privacy-note">Illustrative bedroom photo</p>}
        {underDevelopment ? <div className="catalog-title"><h3>{item.name}</h3></div> : <Link to={detailUrl} className="catalog-title"><h3>{seatingOptions.length ? 'Tempo Traveller' : item.name}</h3></Link>}<p className="card-copy">{underDevelopment ? 'We’re working on this package. Please explore Deluxe or Premium for now.' : item.description}</p>
        {seatingOptions.length > 0 && <fieldset className="vehicle-seat-options"><legend>Seating capacity</legend>{seatingOptions.map((vehicle) => <label key={vehicle.id}><input type="radio" name={`vehicle-seats-${initialItem.id}`} value={vehicle.id} checked={item.id === vehicle.id} onChange={() => setSelectedVehicleId(vehicle.id)} />{vehicle.seats}-seater</label>)}</fieldset>}
        <div className={`catalog-bottom${kind === 'package' ? ' package-card-bottom' : ''}`}>
          {item.kind === 'hotel' ? <HotelRates hotel={item} /> : item.kind === 'car' && item.priceOnEnquiry ? <p className="price">Price on enquiry</p> : <p className="price">{item.kind === 'car' && <OfferPrice price={item.price} />}{item.kind === 'package' && item.originalPrice !== undefined && <span className="original-price"><s aria-label={`Original price ${money(item.originalPrice)}`}>{money(item.originalPrice)}</s><DiscountLabel price={item.price} originalPrice={item.originalPrice} /></span>}{money(item.price)}<small>{kind === 'package' ? ' / person' : ' / day from'}</small></p>}
          {kind === 'package' ? <div className="package-card-actions">
            {underDevelopment ? <button className="button button-mini package-explore" disabled>Explore Now <ArrowUpRight size={14} /></button> : <Link className="button button-mini package-explore" to={detailUrl}>Explore Now <ArrowUpRight size={14} /></Link>}
            <button className="button button-mini" disabled={underDevelopment} onClick={() => openBooking(kind, item.name)}>Enquire Now <ArrowRight size={14} /></button>
          </div> : <button className="button button-mini" onClick={() => openBooking(kind, item.name)}>Enquire Now <ArrowRight size={14} /></button>}
        </div>
      </div>
    </article>
  )
}

export function HomePage() {
  const openBooking = useBooking()
  const [tripFields, setTripFields] = useState<Record<string, string> | null>(null)

  return <>
    <section className="home-hero">
      <div className="hero-image" role="img" aria-label="Mountain lake landscape, illustrative travel photography" />
      <div className="hero-shade" />
      <div className="hero-content page-width"><h1>Kashmir,<br /><em>closer to you.</em></h1><p>Discover Kashmir through local insight and journeys shaped around you.</p><div className="hero-actions"><a className="button button-ivory" href="#custom-trip">Customize your trip <ArrowRight size={16} /></a><Link className="button button-ghost" to="/tour-packages">Explore packages <ArrowRight size={16} /></Link><Link className="button button-ghost" to="/car-rentals">Book your car <ArrowRight size={16} /></Link><Link className="button button-ghost" to="/hotels">Book a hotel <ArrowRight size={16} /></Link><Link className="button button-ghost" to="/my-enquiries">Check your bookings <ArrowRight size={16} /></Link></div></div>
      <div className="hero-caption"><span>A sense of adventure</span><span>Illustrative travel photography</span></div>
      <a className="hero-scroll" href="#custom-trip"><span>Scroll to discover</span><ArrowDown size={16} /></a>
    </section>
    <TripPlanner onContinue={setTripFields} />
    <section className="section page-width feature-section"><SectionHeading eyebrow="Journeys made with care" title={'Clear plans. Local care.\nRoom for wonder.'} copy="We’ll listen first, share honest recommendations and shape a Kashmir journey around the people travelling with us." link="See all packages" to="/tour-packages" /><div className="catalog-grid">{tourPackages.slice(0, 3).map((item) => <CatalogCard key={item.id} item={item} kind="package" />)}</div></section>
    <section className="section page-width split-promo"><div className="promo-photo"><img src={rentalCars[1].image} alt="Comfortable vehicle for Kashmir mountain travel" loading="lazy" /><span>THE VALLEY, YOUR WAY</span></div><div className="promo-copy"><Eyebrow>Go at your own pace</Eyebrow><h2>Good roads.<br /><em>Better company.</em></h2><p>From a quick Srinagar pickup to a week on the mountain roads, travel with a local driver who knows the turns and the stories.</p><div className="service-points"><span><Check size={15} /> Comfortable vehicles</span><span><Check size={15} /> Local, experienced drivers</span><span><Check size={15} /> Routes made around you</span></div><Link className="button button-dark" to="/car-rentals">Explore car rentals <ArrowRight size={16} /></Link></div></section>
    <section className="stay-strip"><div className="page-width stay-content"><div><Eyebrow>Stay a little longer</Eyebrow><h2>From lake mornings<br />to mountain evenings.</h2><p>Deluxe stays in Srinagar and Pahalgam, with breakfast and dinner included.</p><Link className="button button-ivory" to="/hotels">Find your stay <ArrowRight size={16} /></Link></div><div className="stay-image"><img src={hotels[0].image} alt="Illustrative hotel photography" loading="lazy" /></div></div></section>
    <section className="section page-width reasons-section"><SectionHeading eyebrow="The AVELOF difference" title={'Local knowledge.\nPersonal by nature.'} copy="A well-made journey feels easy. We take care of the details, then leave room for the moments you came for." /><div className="reason-grid"><article><span>01</span><h3>From here, always</h3><p>Our roots are in Kashmir. The recommendations come from lived experience, not a checklist.</p></article><article><span>02</span><h3>Made around you</h3><p>Flexible plans for your pace, your people and the way you like to discover a place.</p></article><article><span>03</span><h3>People you can reach</h3><p>A real local team is here before, during and after your journey through the valley.</p></article><article><span>04</span><h3>Thoughtful details</h3><p>Comfortable transport, carefully chosen stays and practical advice at every turn.</p></article></div></section>
    <section className="final-cta page-width"><div><Eyebrow>Your Kashmir, your way</Eyebrow><h2>Let’s make room<br /><em>for the unexpected.</em></h2></div><div><p>Tell us what you’re dreaming about. We’ll help shape the rest.</p><button className="button button-dark" onClick={() => openBooking('package')}>Start a conversation <ArrowUpRight size={16} /></button></div></section>
    {tripFields && <BookingModal kind="package" selectedItem="Custom package" initialFields={tripFields} onClose={() => setTripFields(null)} />}
  </>
}

export function CollectionPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const kind = kindFromPath(location.pathname)
  const navigationState = location.state as { tripReturn?: { sectionId?: string; returnPath?: string } } | null
  const tripReturn = kind === 'hotel'
    && (navigationState?.tripReturn?.sectionId === 'custom-trip' || navigationState?.tripReturn?.sectionId === 'package-planner')
    && (navigationState.tripReturn.returnPath === '/' || navigationState.tripReturn.returnPath === '/tour-packages')
    ? navigationState.tripReturn as { sectionId: string; returnPath: string }
    : null
  const previousPath = useRef(location.pathname)
  const tripReturnRef = useRef(tripReturn)
  useEffect(() => {
    if (tripReturn) tripReturnRef.current = tripReturn
  }, [tripReturn])
  useEffect(() => {
    const previous = previousPath.current
    if (previous === '/hotels' && location.pathname !== '/hotels') {
      const returnContext = tripReturnRef.current
      if (returnContext && location.pathname !== returnContext.returnPath) clearSavedTripPlan(returnContext.sectionId)
      tripReturnRef.current = null
    }
    previousPath.current = location.pathname
  }, [location.pathname])
  const [tripFields, setTripFields] = useState<Record<string, string> | null>(null)
  const items = kind === 'car' ? rentalCars.filter((car) => car.category !== 'Tempo Traveller' || car.id === 'tempo-traveller') : allItems[kind]
  const category = searchParams.get('category') ?? 'All'
  const maxPrice = searchParams.get('price') ?? 'all'
  const locationFilter = searchParams.get('location') ?? 'all'
  const seats = searchParams.get('seats') ?? 'all'
  const updateFilter = (key: string, value: string, defaultValue: string) => {
    const next = new URLSearchParams(searchParams)
    if (value === defaultValue) next.delete(key)
    else next.set(key, value)
    setSearchParams(next, { replace: true })
  }
  const headings: Record<CatalogKind, { label: string; title: string; copy: string }> = {
    package: { label: 'Journeys through Kashmir', title: 'Find your kind of journey.', copy: 'Small-group and private routes, shaped by local knowledge and a little breathing room.' },
    car: { label: 'The open road', title: 'The valley, at your pace.', copy: 'Comfortable vehicles and local drivers for airport transfers, day trips and longer journeys.' },
    hotel: { label: 'A place to land', title: 'Stay somewhere that feels right.', copy: 'Deluxe and Premium package hotels in Srinagar, Pahalgam and Gulmarg, with couple rates including breakfast and dinner.' },
  }
  const categories = ['All', ...new Set(items.map((item) => item.category))]
  const filtered = items.filter((item) => {
    const priceLimit = maxPrice === 'all' ? Infinity : Number(maxPrice)
    const matchSeats = kind !== 'car' || seats === 'all' || (item as RentalCar).seats >= Number(seats) || (item.category === 'Tempo Traveller' && rentalCars.some((car) => car.category === 'Tempo Traveller' && car.seats >= Number(seats)))
    const matchLocation = kind !== 'hotel' || locationFilter === 'all' || item.location === locationFilter
    return (category === 'All' || item.category === category) && (kind === 'car' || item.price <= priceLimit) && matchSeats && matchLocation
  })

  return <>
    <section className="page-hero"><div className="page-width"><div className="breadcrumb"><Link to="/">Home</Link><span>/</span><span>{headings[kind].label}</span></div><Eyebrow>{headings[kind].label}</Eyebrow><h1>{headings[kind].title}</h1><p>{headings[kind].copy}</p>{kind === 'hotel' && tripReturn && <button className="button button-outline trip-return-button" type="button" onClick={() => navigate(-1)}><ArrowLeft size={16} /> Back to your trip</button>}</div></section>
    <section className="catalog-page page-width">
      {kind !== 'package' && <div className="filters-bar">
        <div className="filter-guidance"><strong>Need help choosing?</strong><p>Our local team can help you find the right fit.</p></div>
        <label><span>Category</span><select value={category} onChange={(event) => updateFilter('category', event.target.value, 'All')}>{categories.map((value) => <option key={value}>{value}</option>)}</select></label>
        {kind === 'hotel' && <label><span>Location</span><select value={locationFilter} onChange={(event) => updateFilter('location', event.target.value, 'all')}><option value="all">All locations</option>{hotelLocations.map((value) => <option key={value}>{value}</option>)}</select></label>}
        {kind === 'car' && <label><span>Seats</span><select value={seats} onChange={(event) => updateFilter('seats', event.target.value, 'all')}><option value="all">Any capacity</option><option value="4">4+ seats</option><option value="6">6+ seats</option><option value="8">8+ seats</option></select></label>}
        {kind !== 'car' && <label><span>Price</span><select value={maxPrice} onChange={(event) => updateFilter('price', event.target.value, 'all')}><option value="all">Any price</option><option value="25000">Under ₹25,000</option><option value="35000">Under ₹35,000</option><option value="50000">Under ₹50,000</option></select></label>}
        <span className="result-count">{filtered.length} {filtered.length === 1 ? 'option' : 'options'}</span>
      </div>}
      {filtered.length ? <div className="catalog-grid">{filtered.map((item) => <CatalogCard key={item.id} item={item} kind={kind} />)}</div> : <div className="empty-state"><Compass size={28} /><h2>No matches just yet</h2><p>Try another category or clear a filter to see more of Kashmir.</p><button className="button button-outline" onClick={() => setSearchParams({}, { replace: true })}>Clear filters</button></div>}
    </section>
    {kind === 'package' && <TripPlanner onContinue={setTripFields} sectionId="package-planner" />}
    <section className="catalog-note page-width"><div><Eyebrow>Need help?</Eyebrow><h2>Looking for something?</h2><p>Have a question about availability, pricing, or choosing the right option? Contact our team and we’ll help.</p></div><Link className="button button-dark" to="/contact">Contact us <ArrowUpRight size={16} /></Link></section>
    {tripFields && <BookingModal kind="package" selectedItem="Custom package" initialFields={tripFields} onClose={() => setTripFields(null)} />}
  </>
}

export function DetailPage() {
  const { slug = '' } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const kind = kindFromPath(location.pathname)
  const detailState = location.state as { tripReturn?: { sectionId?: string; returnPath?: string } } | null
  const tripReturn = kind === 'hotel'
    && (detailState?.tripReturn?.sectionId === 'custom-trip' || detailState?.tripReturn?.sectionId === 'package-planner')
    && (detailState.tripReturn.returnPath === '/' || detailState.tripReturn.returnPath === '/tour-packages')
  const item = allItems[kind].find((candidate) => candidate.id === slug)
  const openBooking = useBooking()
  if (!item) return <NotFoundPage />
  if (item.kind === 'package' && item.underDevelopment) return <section className="section page-width"><Eyebrow>Under development</Eyebrow><h1>{item.name}</h1><p>We’re working on this package. Please explore Deluxe or Premium for now.</p><Link className="text-link" to="/tour-packages">Explore other packages <ArrowRight size={16} /></Link></section>

  return <>
    <section className="detail-top page-width"><div className="breadcrumb"><Link to="/">Home</Link><span>/</span><Link to={routeFor[kind]}>{kind === 'package' ? 'Tour packages' : kind === 'car' ? 'Car rentals' : 'Hotels'}</Link><span>/</span><span>{item.name}</span></div><div className="detail-heading"><div><Eyebrow>{item.category} · {item.location}</Eyebrow><h1>{item.name}</h1><p>{item.description}</p></div><button className="button button-dark" onClick={() => openBooking(kind, item.name)}>Enquire Now <ArrowRight size={16} /></button></div>{tripReturn && <button className="button button-outline trip-return-button" type="button" onClick={() => navigate(-1)}><ArrowLeft size={16} /> Back to your trip</button>}</section>
    {item.kind === 'car' ? <section className="vehicle-detail-photo page-width"><img src={item.image} alt={`${item.name} model reference`} /><VehiclePhotoCaption vehicle={item} /></section> : item.kind === 'hotel' ? <section className="hotel-detail-photo page-width"><img src={item.image} alt={`${item.name}, illustrative bedroom photo`} /><p className="privacy-note">Illustrative bedroom photo, not a verified image of this property.</p></section> : <section className="detail-gallery page-width"><img className="gallery-main" src={item.gallery[0]} alt={item.name} /><img src={item.gallery[1] ?? item.image} alt={`${item.name} view`} /><img src={item.gallery[2] ?? item.image} alt={`${item.name} detail`} /></section>}
    <div className="detail-layout page-width"><div className="detail-body">
      {kind === 'package' && <PackageDetail item={item as TourPackage} />}
      {kind === 'car' && <CarDetail item={item as RentalCar} />}
      {kind === 'hotel' && <HotelDetail item={item as Hotel} />}
      <section className="detail-related"><Eyebrow>Keep exploring</Eyebrow><h2>More ways to see Kashmir</h2><div className="related-links"><Link to="/tour-packages">Journeys <ArrowRight size={15} /></Link><Link to="/car-rentals">Local transport <ArrowRight size={15} /></Link><Link to="/hotels">Stays <ArrowRight size={15} /></Link></div></section>
    </div><aside className="detail-aside"><Eyebrow>{item.kind === 'car' && item.priceOnEnquiry ? 'Rental fare' : 'From'}</Eyebrow>{item.kind === 'hotel' ? <HotelRates hotel={item} /> : item.kind === 'car' && item.priceOnEnquiry ? <strong className="quote-only-price">Price on enquiry</strong> : <>{item.kind === 'car' && <OfferPrice price={item.price} />}{item.kind === 'package' && item.originalPrice !== undefined && <div className="original-price"><s aria-label={`Original price ${money(item.originalPrice)}`}>{money(item.originalPrice)}</s><DiscountLabel price={item.price} originalPrice={item.originalPrice} /></div>}<strong>{money(item.price)}</strong><span>{kind === 'package' ? 'per person' : 'per day, estimated'}</span></>}<p>Final price depends on dates, availability and the details of your trip. We’ll confirm everything with you directly.</p><button className="button button-dark" onClick={() => openBooking(kind, item.name)}>Enquire Now <ArrowRight size={16} /></button><a href={`mailto:${business.email}`} className="aside-email"><Mail size={16} /> Email AVELOF</a></aside></div>
  </>
}

function PackageDetail({ item }: { item: TourPackage }) {
  return <>
    <section className="detail-section"><Eyebrow>The journey</Eyebrow><h2>{item.duration} · {item.location}</h2><p>{item.description} This route is a starting point: our team can adjust the pace, stays and experiences around your travel dates.</p><div className="fact-list"><span><strong>Stay plan</strong>{item.stay}</span>{item.stays.map((stay) => <span key={stay.location}><strong>{stay.location} · {stay.nights} {stay.nights === 1 ? 'night' : 'nights'}</strong>{stay.hotel}</span>)}<span><strong>Getting around</strong>{item.transport}</span></div></section>
    <section className="detail-section"><Eyebrow>Day by day</Eyebrow><h2>A considered itinerary</h2><div className="itinerary">{item.itinerary.map((stop) => <article key={stop.day}><span>{stop.day}</span><div><h3>{stop.title}</h3><p>{stop.detail}</p></div></article>)}</div></section>
    <section className="detail-section"><Eyebrow>Along the way</Eyebrow><h2>Experiences to look forward to</h2><ul className="detail-list">{item.experiences.map((experience) => <li key={experience}>{experience}</li>)}</ul></section>
    <IncludedLists inclusions={item.inclusions} exclusions={item.exclusions} />
    <section className="detail-section"><Eyebrow>Good to know</Eyebrow><h2>A few practical notes</h2><p>Travel conditions in the mountains can change with the season. Sightseeing order may be adjusted for weather, road access or local conditions. Optional activities and tickets are subject to availability.</p></section>
    <section className="detail-section"><Eyebrow>Frequently asked</Eyebrow><h2>Before you decide.</h2><div className="faq-list"><details><summary>Can this itinerary be changed?</summary><p>Yes. This route is a starting point. Share your dates, interests and preferred pace and our team can suggest adjustments.</p></details><details><summary>Are flights included?</summary><p>No. Flights, travel insurance and optional activities are not included unless explicitly listed in your final written quote.</p></details><details><summary>When is the best time to visit?</summary><p>Kashmir changes with the seasons. Tell us what you hope to experience and we can help you choose dates and plan for seasonal conditions.</p></details></div></section>
  </>
}

function CarDetail({ item }: { item: RentalCar }) {
  return <>
    <section className="detail-section"><Eyebrow>Vehicle details</Eyebrow><h2>Comfort for the miles ahead.</h2><p>{item.description} Share your route and group size with our team so we can confirm the right vehicle and a clear fare.</p><div className="spec-grid"><span><Users />{item.seats} seats</span><span><Check />{item.ac ? 'Air conditioned' : 'Non-AC'}</span><span><Plus />{item.luggage}</span><span><MapPin />Based in {item.location}</span></div></section>
    <section className="detail-section"><Eyebrow>Available trip types</Eyebrow><h2>Where can we take you?</h2><ul className="detail-list">{item.tripTypes.map((type) => <li key={type}>{type}</li>)}</ul></section>
    <section className="detail-section"><Eyebrow>Rental information</Eyebrow><h2>Before you set off</h2><ul className="detail-list">{item.conditions.map((condition) => <li key={condition}>{condition}</li>)}</ul><p>We’ll confirm route, driver details, inclusions and final pricing before your travel date.</p></section>
  </>
}

function HotelDetail({ item }: { item: Hotel }) {
  return <>
    {item.packageId && <Link className="text-link" to={`/tour-packages/${item.packageId}`}>{item.category} <ArrowUpRight size={16} /></Link>}
    <section className="detail-section"><Eyebrow>The stay</Eyebrow><h2>A softer place to land.</h2><p>{item.description}</p><div className="fact-list"><span><strong>Check-in</strong>{item.checkIn}</span><span><strong>Check-out</strong>{item.checkOut}</span><span><strong>Location</strong>{item.location}</span></div></section>
    <section className="detail-section"><Eyebrow>Rooms & facilities</Eyebrow><h2>Make yourself at home.</h2><h3>Room types</h3><ul className="detail-list">{item.roomTypes.map((room) => <li key={room}>{room}</li>)}</ul><h3 className="subheading-gap">Facilities</h3><div className="tag-list">{item.facilities.map((facility) => <span key={facility}>{facility}</span>)}</div></section>
    <section className="detail-section"><Eyebrow>Highlights</Eyebrow><h2>What makes it special</h2><ul className="detail-list">{item.highlights.map((highlight) => <li key={highlight}>{highlight}</li>)}</ul></section>
    <section className="detail-section"><Eyebrow>Nearby</Eyebrow><h2>Explore the neighbourhood</h2><p>Our local team can suggest nearby gardens, markets, walks and dining based on the season and your interests.</p></section>
  </>
}

function IncludedLists({ inclusions, exclusions }: { inclusions: string[]; exclusions: string[] }) {
  return <section className="detail-section"><Eyebrow>Included in your request</Eyebrow><h2>Clear from the start.</h2><div className="include-grid"><div><h3>Included</h3><ul className="detail-list">{inclusions.map((entry) => <li key={entry}>{entry}</li>)}</ul></div><div><h3>Not included</h3><ul className="detail-list">{exclusions.map((entry) => <li key={entry}>{entry}</li>)}</ul></div></div></section>
}

export { default as ReviewsPage } from './ReviewsPage'

export function AboutPage() {
  return <>
    <section className="about-hero"><img src={destinations[0].image} alt="A tranquil view across Dal Lake" /><div className="about-hero-shade" /><div className="page-width"><div className="breadcrumb"><Link to="/">Home</Link><span>/</span><span>About AVELOF</span></div><Eyebrow>A little about us</Eyebrow><h1>From Kashmir,<br /><em>with care.</em></h1></div></section>
    <section className="about-intro page-width"><div><Eyebrow>Our story</Eyebrow><h2>A place is never just a place.</h2></div><div><p className="large-copy">It’s the people who welcome you, the road that takes its time, and the moment you stop checking the clock.</p><p>AVELOF is a Kashmir travel company built around that feeling. We bring together local knowledge, thoughtful planning and the small details that help a journey feel easy and personal.</p></div></section>
    <section className="about-values"><div className="page-width about-values-inner"><div><Eyebrow>What we believe</Eyebrow><h2>Travel should leave<br />room for real life.</h2></div><div className="about-value-list"><article><span>01</span><div><h3>Rooted here</h3><p>Our perspective starts with Kashmir: its landscapes, seasons and the people who make it home.</p></div></article><article><span>02</span><div><h3>Never one-size-fits-all</h3><p>We listen first, then plan around the travellers in front of us.</p></div></article><article><span>03</span><div><h3>Care is in the details</h3><p>Clear communication, considered partners and help when plans need to change.</p></div></article></div></div></section>
    <section className="about-photo page-width"><img src={destinations[2].image} alt="Pine forest and open valley in Kashmir" loading="lazy" /><div><Eyebrow>Our mission</Eyebrow><h2>To help you meet Kashmir on its own terms.</h2><p>We’re here to make it easier to travel thoughtfully, support local expertise and find the moments that stay with you long after the journey ends.</p><a className="text-link" href="#contact">Plan with AVELOF <ArrowRight size={16} /></a></div></section>
    <ContactSection />
  </>
}

function ContactSection() {
  const [request, setRequest] = useState<PreparedRequest | null>(null)

  return <>
    <section className="contact-layout page-width" id="contact"><div className="contact-details"><Eyebrow>Reach us directly</Eyebrow><h2>A real conversation,<br />with a local team.</h2><p>Tell us where you’re starting from. We’ll help with the next step.</p><a className="contact-method" href={`tel:${business.phone.replace(/[^+\d]/g, '')}`}><span><Phone /></span><div><small>Call us</small><strong>{business.phone}</strong></div><ArrowUpRight /></a><a className="contact-method" href={`mailto:${business.email}`}><span><Mail /></span><div><small>Email enquiries</small><strong>{business.email}</strong></div><ArrowUpRight /></a><a className="contact-method" href={business.instagram} target="_blank" rel="noreferrer"><span><Compass /></span><div><small>Instagram</small><strong>{business.instagramHandle}</strong></div><ArrowUpRight /></a><div className="location-note"><MapPin size={16} /><span>Kashmir, India<br /><small>Local travel assistance across the valley</small></span></div></div>
      <div className="contact-form-wrap"><Eyebrow>Enquire Now</Eyebrow><h2>Your Kashmir starts here.</h2><EnquiryForm kind="contact" onPrepared={setRequest} /></div>
    </section>
    {request && <BookingModal kind="contact" initialRequest={request} onClose={() => setRequest(null)} />}
  </>
}

export function NotFoundPage() {
  return <section className="not-found page-width"><Eyebrow>Lost in the valley?</Eyebrow><h1>We can’t find that page.</h1><p>The link may have changed, but there’s still plenty of Kashmir to explore.</p><Link className="button button-dark" to="/">Back to AVELOF <ArrowRight size={16} /></Link></section>
}