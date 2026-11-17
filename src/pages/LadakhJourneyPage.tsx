import { ArrowRight, BedDouble, CalendarDays, CarFront, Check, CircleMinus, MapPin, Motorbike, MountainSnow, Plus, Route, ShieldCheck } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import BackButton from '../components/BackButton'
import CallAssistance from '../components/CallAssistance'
import RegionalEnquiryForm from '../components/RegionalEnquiryForm'
import DownloadItineraryPdfButton from '../components/DownloadItineraryPdfButton'
import { ladakhJourneyPdfData } from '../services/itineraryPdf'
import { ladakhAltitudeNote, ladakhJourneys, ladakhPlanningNote } from '../data/ladakhJourneys'
import type { LadakhJourneySection } from '../data/ladakhJourneys'
import { ladakhFaqs, ladakhPages } from '../data/ladakh'
import { ladakhPhotoPreview } from '../data/ladakhPhotos'
import { NotFoundPage } from './Pages'
import './ladakh.css'

export default function LadakhJourneyPage({ section }: { section: LadakhJourneySection }) {
  const { slug } = useParams()
  const trip = ladakhJourneys.find((item) => item.section === section && item.id === slug)
  if (!trip) return <NotFoundPage />
  const Transport = section === 'bike-trips' ? Motorbike : CarFront
  return <>
    <section className="detail-top page-width package-detail-top">
      <div className="breadcrumb"><BackButton /><Link to="/ladakh">Home</Link><span>/</span><Link to={`/ladakh/${section}`}>{ladakhPages[section].title}</Link><span>/</span><span>{trip.name}</span></div>
      <div className="detail-heading"><div><p className="eyebrow">{trip.label} · Ladakh</p><div className="detail-title-row"><h1>{trip.name}</h1></div><p>{trip.description}</p>
        <div className="package-hero-facts" role="list" aria-label="Journey highlights"><span role="listitem"><CalendarDays size={18} aria-hidden="true" />{trip.duration}</span><span role="listitem"><MapPin size={18} aria-hidden="true" />From {trip.start}</span><span role="listitem"><Transport size={18} aria-hidden="true" />Transport on enquiry</span><span role="listitem"><ShieldCheck size={18} aria-hidden="true" />Summer 2027 planning preview</span></div>
      </div></div>
    </section>
    <section className="detail-gallery page-width">{[trip.photo, ...ladakhPhotoPreview.filter((photo) => photo.src !== trip.photo.src)].map((photo, index) => <img key={photo.src} className={index === 0 ? 'gallery-main' : undefined} src={photo.src} alt={photo.alt} />)}</section>
    <p className="privacy-note page-width package-image-note">Ladakh sightseeing photographs, not confirmed stops, accommodation or offered vehicles. {ladakhPlanningNote}</p>
    <div className="page-width"><CallAssistance /></div>
    <div className="detail-layout page-width package-detail-layout"><div className="detail-body">
      <section className="detail-section package-journey" aria-labelledby="journey-title"><p className="eyebrow">The journey</p><h2 id="journey-title">Your Ladakh journey</h2><p>{trip.description} Our team can discuss a suitable pace and alternative stops around your dates.</p>
        <ul className="package-route" aria-label="Journey destinations">{trip.stops.map((stop, index) => <li key={`${stop}-${index}`}><MapPin size={16} aria-hidden="true" />{stop}</li>)}</ul>
        <div className="package-stay-summary"><CalendarDays size={22} aria-hidden="true" /><div><h3>{trip.duration}</h3><p>Proposed timing; extra rest or buffer days may be needed.</p></div></div>
        {section !== 'car-rentals' && <div className="package-transport"><BedDouble size={22} aria-hidden="true" /><div><h3>Your stay & guide</h3><p>Hotel or guesthouse category, overnight locations, meals and guide arrangements are chosen with you and confirmed separately. No property or guide is included by default.</p></div></div>}
        <div className="package-transport"><Transport size={22} aria-hidden="true" /><div><h3>Getting around</h3><p>{section === 'bike-trips' ? 'Motorcycle model, hire, equipment and riding support require operator confirmation. Bike departures are not open for booking yet.' : 'Vehicle, local driver, permissions and any vehicle changes must be confirmed in your written quote.'}</p></div></div>
      </section>
      <section className="detail-section" aria-labelledby="itinerary-title"><p className="eyebrow">{section === 'car-rentals' ? 'Your proposed route' : 'Day by day'}</p><h2 id="itinerary-title">{section === 'car-rentals' ? 'A considered transfer plan' : 'A considered itinerary'}</h2>
        <div className="package-itinerary">{trip.itinerary.map((day) => <article key={day.day}><div className="package-day-marker"><span>{day.day}</span><Route size={22} aria-hidden="true" /></div><div className="package-day-copy"><h3>{day.title}</h3><p>{day.detail}</p></div></article>)}</div>
      </section>
      <section className="detail-section package-inclusions"><p className="eyebrow">Before confirming</p><h2>Your quote, clearly explained</h2><div className="include-grid"><div><h3><ShieldCheck size={23} aria-hidden="true" />Confirm in your quote</h3><ul className="detail-list">{trip.checks.map((check) => <li key={check}><Check size={18} aria-hidden="true" /><span>{check}</span></li>)}</ul></div><div><h3><CircleMinus size={23} aria-hidden="true" />Not included by default</h3><ul className="detail-list">{['Flights and travel insurance', 'Optional activities, tickets and personal expenses', 'Any stay, meal, vehicle or support service not agreed in writing'].map((note) => <li key={note}><CircleMinus size={18} aria-hidden="true" /><span>{note}</span></li>)}</ul></div></div></section>
      <section className="detail-section package-notes"><p className="eyebrow">Good to know</p><h2>A few practical notes</h2><div className="package-notes-grid"><article><MountainSnow size={23} aria-hidden="true" /><div><h3>Altitude & rest</h3><p>{ladakhAltitudeNote}</p></div></article><article><Route size={23} aria-hidden="true" /><div><h3>A flexible route</h3><p>Weather, road access, permits and local rules can change the plan. Lake overnights are optional and require suitability checks.</p></div></article></div><a className="text-link" href="https://leh.nic.in/48-hours-acclimatization-for-tourists-arriving-in-leh/" target="_blank" rel="noreferrer">Official Leh acclimatisation advice <ArrowRight size={16} aria-hidden="true" /></a></section>
      <div className="package-pdf-download"><DownloadItineraryPdfButton data={ladakhJourneyPdfData(trip)} label={`Download ${trip.name} itinerary PDF`} /></div>
      <section className="detail-section package-faq"><p className="eyebrow">Frequently asked</p><h2>Before you decide.</h2><div className="faq-list">{ladakhFaqs.map((faq) => <details key={faq.question}><summary><span>{faq.question}</span><Plus size={18} aria-hidden="true" /></summary><p>{faq.answer}</p></details>)}</div></section>
      <section id="enquire" className="ladakh-journey-enquiry"><RegionalEnquiryForm key={`${section}:${trip.id}`} region="Ladakh" kind={section === 'car-rentals' ? 'car' : 'package'} preference={trip.preference} initialDetails={`I am interested in ${trip.name} (${trip.duration}). Proposed route: ${trip.stops.join(' - ')}. Please help me check dates, suitability, availability and a written quote.`} /></section>
      <section className="detail-related"><p className="eyebrow">Keep exploring</p><h2>More ways to see Ladakh</h2><div className="related-links"><Link to="/ladakh/packages">Packages <ArrowRight size={15} /></Link><Link to="/ladakh/bike-trips">Bike Trips <ArrowRight size={15} /></Link><Link to="/ladakh/car-rentals">Cabs <ArrowRight size={15} /></Link><Link to="/ladakh/hotels">Stays <ArrowRight size={15} /></Link></div></section>
    </div><aside className="detail-aside"><p className="eyebrow">Your journey</p><strong className="quote-only-price">Price on enquiry</strong><span>{trip.duration}</span><p>{ladakhPlanningNote}</p><a className="button button-dark" href="#enquire">Enquire Now <ArrowRight size={16} aria-hidden="true" /></a></aside></div>
  </>
}
