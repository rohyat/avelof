import { useState } from 'react'
import { ArrowRight, ArrowUpRight, MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ladakhJourneys, ladakhPlanningNote } from '../data/ladakhJourneys'
import type { LadakhJourneySection } from '../data/ladakhJourneys'

export default function LadakhJourneyCatalog({ section = 'packages', preview = false }: { section?: LadakhJourneySection; preview?: boolean }) {
  const [start, setStart] = useState('All routes')
  const trips = ladakhJourneys.filter((trip) => trip.section === section && (preview || start === 'All routes' || trip.start === start))
  return <section className={preview ? 'section page-width' : 'catalog-page page-width'}>
    <p className="eyebrow">{section === 'car-rentals' ? 'The open road' : 'Choose your journey'}</p>
    <h2>{section === 'car-rentals' ? 'Transport, at your pace.' : section === 'bike-trips' ? 'Open roads, thoughtfully planned.' : 'Find your kind of journey.'}</h2>
    <p className="privacy-note">{ladakhPlanningNote}</p>
    {!preview && <div className="ladakh-route-filters" role="group" aria-label="Filter routes by starting point">{['All routes', 'Leh', 'Srinagar'].map((value) => <button key={value} type="button" aria-pressed={start === value} onClick={() => setStart(value)}>{value === 'All routes' ? value : `From ${value}`}</button>)}</div>}
    <p className="result-count" role="status">{trips.length} proposed {trips.length === 1 ? 'option' : 'options'}</p>
    <div className="catalog-grid">{trips.map((trip) => {
      const path = `/ladakh/${trip.section}/${trip.id}`
      return <article className="catalog-card ladakh-route-card" key={trip.id}>
        <Link to={path} className="catalog-image"><img src={trip.photo.src} alt={trip.photo.alt} loading="lazy" /><span className="image-tag">{trip.label}</span><span className="image-arrow"><ArrowUpRight size={17} aria-hidden="true" /></span></Link>
        <div className="catalog-content"><div className="catalog-meta"><span><MapPin size={13} aria-hidden="true" /> From {trip.start}</span><span>{trip.duration}</span></div>
          <Link to={path} className="catalog-title"><h3>{trip.name}</h3></Link><p className="card-copy">{trip.description}</p>
          <div className="catalog-bottom package-card-bottom"><p className="price">Price on enquiry<small>Subject to supplier confirmation</small></p><div className="package-card-actions">
            <Link className="button button-mini package-explore" to={path}>Explore Now <ArrowUpRight size={14} aria-hidden="true" /></Link>
            <Link className="button button-mini" to={`${path}#enquire`}>Enquire Now <ArrowRight size={14} aria-hidden="true" /></Link>
          </div></div>
        </div>
      </article>
    })}</div>
    {section === 'car-rentals' && <Link className="text-link" to="/ladakh/drivers">Meet Ladakh drivers <ArrowRight size={16} aria-hidden="true" /></Link>}
  </section>
}
