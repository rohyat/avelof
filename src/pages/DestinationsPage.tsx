import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowDown, ArrowLeft, Clock, MapPin, Route, Search, X } from 'lucide-react'
import BookingModal, { EnquiryForm } from '../components/BookingModal'
import { destinations } from '../data/catalog'
import type { PreparedRequest } from '../types'

export default function DestinationsPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const navigationState = location.state as { tripReturn?: { sectionId?: string; returnPath?: string } } | null
  const tripReturn = (navigationState?.tripReturn?.sectionId === 'custom-trip' && navigationState.tripReturn.returnPath === '/')
    || (navigationState?.tripReturn?.sectionId === 'package-planner' && navigationState.tripReturn.returnPath === '/tour-packages')
  const [search, setSearch] = useState(new URLSearchParams(location.search).get('place') ?? '')
  const [driveLimit, setDriveLimit] = useState('all')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [request, setRequest] = useState<PreparedRequest | null>(null)
  const [today] = useState(() => {
    const date = new Date()
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  })
  const selected = selectedIds.map((id) => destinations.find((place) => place.id === id)!).filter(Boolean)
  const filtered = destinations.filter((place) => {
    const text = [place.name, ...place.aliases, place.count, place.detail, ...place.attractions.map((attraction) => `${attraction.name} ${attraction.detail}`)].join(' ').toLowerCase()
    return text.includes(search.trim().toLowerCase()) && (driveLimit === 'all' || place.maxDriveHours <= Number(driveLimit))
  })

  function togglePlace(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((selectedId) => selectedId !== id) : [...current, id])
  }

  return <>
    <section className="page-hero places-hero">
      <div className="page-width">
        <div className="breadcrumb"><Link to="/">Home</Link><span>/</span><span>Destinations & visit planner</span></div>
        <p className="eyebrow">Near the lake. Beyond the mountains.</p>
        <h1>Places to visit<br /><em>in Kashmir.</em></h1>
        <p>Find the places that fit your pace, from a Srinagar morning to a few nights in the high valleys.</p>
        <div className="destination-hero-actions">
          <a className="button button-dark" href="#visit-planner">Plan your visit <ArrowDown size={17} /></a>
          {tripReturn && <button className="button button-outline" type="button" onClick={() => navigate(-1)}><ArrowLeft size={16} /> Back to your trip</button>}
        </div>
      </div>
    </section>
    <div className="page-width destination-guide-layout">
      <section className="place-guide" aria-label="Destination guide">
        <div className="journey-estimate-note"><Route size={21} /><p><strong>Starting from central Srinagar</strong>Distances and driving times are approximate and one-way, excluding stops and nearby excursions. Allow return travel time too. Traffic, snow, road closures and your pickup point can change the journey; confirm conditions before travelling.</p></div>
        <div className="place-filters">
          <label className="place-search"><span>Search places or attractions</span><div><Search size={18} /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Try Gulmarg, Aru or a waterfall" /></div></label>
          <label><span>One-way drive</span><select value={driveLimit} onChange={(event) => setDriveLimit(event.target.value)}><option value="all">Any distance</option><option value="2">Up to 2 hours</option><option value="3">Up to 3 hours</option><option value="5">Up to 5 hours</option></select></label>
        </div>
        <p className="place-result-count" role="status">{filtered.length} {filtered.length === 1 ? 'place' : 'places'} / {selected.length} in your plan</p>
        {filtered.length ? <div className="place-list">{filtered.map((place) => <article className="place-entry" key={place.id}>
          <div className="place-travel-facts"><span><MapPin size={16} /><strong>{place.distance}</strong> from Srinagar</span><span><Clock size={16} /><strong>{place.travelTime}</strong> one way</span></div>
          <div className="place-entry-main">
            <figure><div className="destination-photo-frame"><img src={place.image} alt={place.photoCredit ? place.name : `Illustrative ${place.count.toLowerCase()} travel landscape`} loading="lazy" />{place.photoCredit && <small className="destination-photo-credit"><a href={place.photoCredit.source} target="_blank" rel="noreferrer">{place.photoCredit.author}</a> · <a href={place.photoCredit.licenseUrl} target="_blank" rel="noreferrer">CC BY-SA 4.0</a></small>}</div>{!place.photoCredit && <figcaption>Illustrative travel photography</figcaption>}</figure>
            <div className="place-entry-copy"><p className="eyebrow">{place.count}</p><h2>{place.name}</h2><p>{place.detail}</p><dl><div><dt>Time to spend</dt><dd>{place.suggestedVisit}</dd></div><div><dt>Best season</dt><dd>{place.season}</dd></div></dl>
              <label className="place-select"><input type="checkbox" checked={selectedIds.includes(place.id)} onChange={() => togglePlace(place.id)} /><span>Add {place.name} to my visit</span></label>
            </div>
          </div>
          <details className="place-attractions"><summary>Attractions & access in {place.name}</summary><ul>{place.attractions.map((attraction) => <li key={attraction.name}><strong>{attraction.name}</strong><p>{attraction.detail}</p></li>)}</ul><p className="place-access-note"><strong>Before you go: </strong>{place.accessNote}</p></details>
        </article>)}</div> : <div className="empty-state"><Search size={26} /><h2>No places match</h2><p>Try another place, attraction or driving time.</p><button className="button button-outline" onClick={() => { setSearch(''); setDriveLimit('all') }}>Clear filters <X size={16} /></button></div>}
      </section>
      <aside className="visit-planner" id="visit-planner" aria-labelledby="planner-title">
        <p className="eyebrow">A journey shaped around you</p><h2 id="planner-title">Plan your visit.</h2>
        <div className="visit-selection" aria-live="polite"><h3>{selected.length} {selected.length === 1 ? 'place' : 'places'} selected</h3>
          {selected.length ? <ul>{selected.map((place) => <li key={place.id}><div><strong>{place.name}</strong><span>{place.travelTime} from Srinagar</span></div><button className="icon-button" title={`Remove ${place.name}`} aria-label={`Remove ${place.name}`} onClick={() => togglePlace(place.id)}><X size={17} /></button></li>)}</ul> : <p>No places selected yet.</p>}
        </div>
        <p className="planner-caution">Each estimate starts from Srinagar, not the previous place. This is a wishlist, not a confirmed route; our team will check the order, dates and road access.</p>
        {selected.some((place) => place.maxDriveHours >= 4) && <p className="planner-long-drive">Your plan includes a long mountain drive. Allow a dedicated travel day and discuss overnight stays with our team.</p>}
        <EnquiryForm selectedItem="Custom package" submitDisabled={!selected.length} additionalFields={{ placesToVisit: selected.map((place) => `${place.name} (${place.distance}; ${place.travelTime} one-way from Srinagar)`).join('\n'), planningNote: 'Destination wishlist only. Please recommend a feasible route and check seasonal access.' }} onPrepared={setRequest}>
          <div className="form-grid planner-dates"><label>Arrival date <span className="optional">Optional</span><input name="arrivalDate" type="date" min={today} /></label><label>Trip length (days)<input name="tripDays" type="number" min="1" max="60" defaultValue="5" required /></label></div>
        </EnquiryForm>
      </aside>
    </div>
    {request && <BookingModal kind="package" initialRequest={request} onClose={() => setRequest(null)} />}
  </>
}