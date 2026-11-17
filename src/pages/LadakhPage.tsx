import { useState } from 'react'
import { ArrowRight, BedDouble, BookOpen, CalendarDays, CarFront, ChevronDown, ClipboardList, Clock, Landmark, MapPin, Motorbike, Package, Phone, Route, ShieldCheck, TentTree } from 'lucide-react'
import BackButton from '../components/BackButton'
import HolidayDestinations from '../components/HolidayDestinations'
import { business } from '../config'
import { ladakhFaqs, ladakhPackages, ladakhPlaces } from '../data/ladakh'
import './ladakh.css'

const shortcuts = [
  { label: 'Plan a trip', id: 'plan', icon: Route },
  { label: 'Packages', id: 'packages', icon: Package },
  { label: 'Stays & Camps', id: 'stays', icon: TentTree },
  { label: 'Cabs & Transfers', id: 'transport', icon: CarFront },
  { label: 'Bike Trips', id: 'bike-trips', icon: Motorbike },
  { label: 'Places', id: 'places', icon: MapPin },
  { label: 'Experiences', id: 'experiences', icon: Landmark },
  { label: 'Travel Guide', id: 'travel-guide', icon: BookOpen },
  { label: 'Talk to AVELOF', id: 'contact', icon: Phone },
]

export default function LadakhPage() {
  const [start, setStart] = useState('All routes')
  const packages = ladakhPackages.filter((trip) => start === 'All routes' || trip.start === start)

  return <div className="ladakh-page">
    <HolidayDestinations destination="ladakh" />
    <section className="ladakh-hero">
      <div className="page-width ladakh-hero-grid">
        <div className="ladakh-hero-copy">
        <p className="eyebrow"><BackButton /> Beyond the familiar / Ladakh</p>
        <span className="ladakh-season"><CalendarDays size={15} aria-hidden="true" /> Summer 2027 planning preview</span>
        <h1>Experience Ladakh.<br /><em>A different kind of journey.</em></h1>
        <p>High passes. Quiet monasteries. Open roads. Explore a holiday shaped around Ladakh, your pace and the journey ahead.</p>
        <div className="ladakh-hero-actions"><a className="button button-dark" href="#packages">Explore proposed routes <ArrowRight size={17} aria-hidden="true" /></a><a className="text-link" href="#bike-trips"><Motorbike size={19} aria-hidden="true" /> Here for the ride?</a></div>
        <p className="ladakh-launch-note">Launch preview: routes, stays and services are being planned. Prices and departures are not yet confirmed.</p>
        </div>
        <figure className="ladakh-hero-art"><img src="/images/destinations/ladakh-landscape.svg" width={800} height={900} alt="Illustration of layered mountains, a turquoise lake and a winding road" fetchPriority="high" /><div className="ladakh-art-caption"><span>THE JOURNEY IS THE DESTINATION</span><strong>Passes. Plateaus.<br />A little perspective.</strong></div><figcaption>Original landscape illustration, not a location photograph.</figcaption></figure>
      </div>
    </section>
    <div className="page-width ladakh-facts" aria-label="Ladakh planning essentials">
      <div><CalendarDays size={21} aria-hidden="true" /><span><strong>Summer journeys</strong><small>Road access is weather dependent</small></span></div>
      <div><MapPin size={21} aria-hidden="true" /><span><strong>Leh or Srinagar</strong><small>Choose your starting point</small></span></div>
      <div><Clock size={21} aria-hidden="true" /><span><strong>At least 48 hours</strong><small>Acclimatise in Leh before higher areas</small></span></div>
    </div>
    <section className="home-shortcuts">
      <nav className="home-shortcut-grid page-width" aria-label="Explore Ladakh">
        {shortcuts.map(({ label, id, icon: Icon }) => <a className="home-shortcut-link" href={`#${id}`} key={id}><span className="home-shortcut-icon"><Icon size={22} aria-hidden="true" /></span><span>{label}</span></a>)}
      </nav>
    </section>
    <section className="section page-width" id="plan">
      <p className="eyebrow">Plan for the place</p><h2>Your route comes first.</h2>
      <p>Start in Leh or travel from Srinagar via Kargil. Share your dates, group size, preferred pace and stay style with our team before choosing a final itinerary.</p>
      <div className="ladakh-notice"><ShieldCheck size={24} aria-hidden="true" /><p>Allow at least 48 hours in Leh before higher areas such as Khardung La and Pangong. Road arrival does not remove altitude risk. Suitability and current local guidance must be checked before travel.</p></div>
      <a className="text-link" href="#contact">Discuss your Ladakh plans <ArrowRight size={16} aria-hidden="true" /></a>
    </section>
    <section className="section page-width" id="packages">
      <p className="eyebrow">Choose the journey, then the stay</p><h2>Three routes to begin with.</h2>
      <p>Suggested itineraries only. Final routing, rest days and availability require local partner confirmation.</p>
      <div className="ladakh-route-filters" role="group" aria-label="Filter routes by starting point">{['All routes', 'Leh', 'Srinagar'].map((value) => <button key={value} type="button" aria-pressed={start === value} onClick={() => setStart(value)}>{value === 'All routes' ? value : `From ${value}`}</button>)}</div>
      <p className="ladakh-result-count" role="status">{packages.length} proposed {packages.length === 1 ? 'route' : 'routes'}{start !== 'All routes' ? ` from ${start}` : ' to explore'}</p>
      <div className="ladakh-card-grid ladakh-package-grid">{packages.map((trip) => <article className="ladakh-card ladakh-route-card" key={trip.name}>
        <div className="ladakh-route-top"><span className="ladakh-route-label">{trip.label}</span><Route size={22} aria-hidden="true" /></div>
        <p className="eyebrow">{trip.duration}</p><h3>{trip.name}</h3>
        <ol className="ladakh-route-stops" aria-label={`${trip.name} route`}>{trip.stops.map((stop, index) => <li key={`${stop}-${index}`}>{stop}</li>)}</ol>
        <p>{trip.description}</p>
        <details className="ladakh-outline"><summary>See journey outline <ChevronDown size={16} aria-hidden="true" /></summary><ol>{trip.outline.map((stage) => <li key={stage.days}><strong>{stage.days}</strong><p>{stage.detail}</p></li>)}</ol><p className="ladakh-launch-note">Proposed outline, not a confirmed itinerary. Timing and stops may change.</p></details>
        <a className="text-link" href="#contact" aria-label={`Discuss ${trip.name}`}>Discuss this route <ArrowRight size={16} aria-hidden="true" /></a>
      </article>)}</div>
    </section>
    <section className="section page-width" id="bike-trips">
      <p className="eyebrow">For the riders</p><h2><Motorbike size={32} aria-hidden="true" /> Ladakh Bike Trips</h2>
      <p>Motorcycle journeys deserve their own planning, not a cab itinerary with a different vehicle.</p>
      <div className="ladakh-card-grid">
        <article className="ladakh-card"><Motorbike size={28} aria-hidden="true" /><h3>Leh-based riding circuit</h3><p>A proposed Leh - Nubra - Pangong - Leh ride, after acclimatisation and rider suitability checks.</p></article>
        <article className="ladakh-card"><Route size={28} aria-hidden="true" /><h3>Srinagar-entry expedition</h3><p>A longer road journey via Kargil. Riding stages, bike collection and drop-off need operator confirmation.</p></article>
        <article className="ladakh-card"><ClipboardList size={28} aria-hidden="true" /><h3>Confirm before you ride</h3><p>Licence, experience, bike condition, helmet and protective gear, fuel, deposits, insurance, breakdown support and emergency arrangements must all be agreed.</p></article>
      </div>
      <p className="ladakh-notice">Bike departures are not open for booking yet. Bikes, support vehicles, ride leaders and equipment are not confirmed or included by default.</p>
      <a className="text-link" href="#contact">Talk about a bike trip <ArrowRight size={16} aria-hidden="true" /></a>
    </section>
    <div className="page-width ladakh-card-grid ladakh-services">
      <section className="ladakh-card" id="stays"><BedDouble size={28} aria-hidden="true" /><h2>Stays &amp; Camps</h2><p>Planned options: Leh hotels, Nubra cottages and seasonal Pangong stays. Verified properties and rates will be added after partner checks.</p><p>Heating, hot water, bathrooms and electricity will be stated clearly for each stay.</p></section>
      <section className="ladakh-card" id="transport"><CarFront size={28} aria-hidden="true" /><h2>Cabs &amp; Transfers</h2><p>Discuss private circuits, Leh airport pickups and Srinagar - Kargil - Leh transfers.</p><p>Local transport arrangements, vehicle changes, luggage capacity, fees and route access require confirmation.</p></section>
      <section className="ladakh-card" id="experiences"><Landmark size={28} aria-hidden="true" /><h2>Culture &amp; Experiences</h2><p>Monastery visits, village walks, local food and landscape photography.</p><p>Guided rafting or other paid activities can only be offered after seasonal and operator checks. Nothing is included automatically.</p></section>
    </div>
    <section className="section page-width" id="places"><p className="eyebrow">Beyond one destination</p><h2>Places along the journey.</h2><div className="ladakh-card-grid">{ladakhPlaces.map((place) => <article className="ladakh-card" key={place.name}><MapPin size={22} aria-hidden="true" /><h3>{place.name}</h3><p>{place.description}</p></article>)}</div></section>
    <section className="section page-width" id="travel-guide"><p className="eyebrow">Before the open road</p><h2>Travel prepared.</h2><ul className="ladakh-guide"><li>Summer road access depends on weather and official openings; no fixed opening date is guaranteed.</li><li>Allow rest time and flexibility. Travellers with health concerns should seek medical advice before high-altitude travel.</li><li>Documents, permits, fees and restricted-area access depend on nationality and current rules.</li><li>Remote stays may have limited power, heating and connectivity. Confirm facilities before committing.</li><li>Final quotes must state meals, fuel, activities, taxes, exclusions and disruption or cancellation terms.</li></ul><a className="text-link" href="https://leh.nic.in/48-hours-acclimatization-for-tourists-arriving-in-leh/" target="_blank" rel="noreferrer">Read the official Leh acclimatisation advisory <ArrowRight size={16} aria-hidden="true" /></a></section>
    <section className="section page-width ladakh-faq" aria-labelledby="ladakh-faq-heading"><div><p className="eyebrow">A few things worth knowing</p><h2 id="ladakh-faq-heading">Before you make plans.</h2><p>Honest answers for a journey that needs a little more thought.</p></div><div className="ladakh-faq-list">{ladakhFaqs.map((faq) => <details key={faq.question}><summary>{faq.question}<ChevronDown size={18} aria-hidden="true" /></summary><p>{faq.answer}</p></details>)}</div></section>
    <section className="section page-width" id="contact"><div className="ladakh-card ladakh-contact"><div><p className="eyebrow">Let us help you plan</p><h2>Your Ladakh journey starts with a conversation.</h2><p>Share your dates, starting point and travel style. We will help you understand the next steps.</p></div><div className="ladakh-contact-action"><a className="button button-dark" href={`tel:${business.phone.replace(/[^\d+]/g, '')}`}><Phone size={18} aria-hidden="true" /> Call AVELOF <ArrowRight size={17} aria-hidden="true" /></a><strong>{business.phone}</strong><p>A conversation is not a booking confirmation. Prices and availability still need checking.</p></div></div></section>
  </div>
}
