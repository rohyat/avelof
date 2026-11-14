import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CalendarDays, Clock, Compass, MapPin, Search, ShieldCheck, Sparkles, X } from 'lucide-react'
import { destinationOptions as destinations } from '../data/destinationOptions'
import DestinationPhotos from '../components/DestinationPhotos'
import ActivityIcon from '../components/ActivityIcon'
import { activitiesForPlaces } from '../data/activities'
import { placeSuggestions, recentPlaceSearchesKey, searchPlaceSuggestions } from '../services/destinationSearch'
import type { PlaceSuggestion } from '../services/destinationSearch'
import SearchAutocomplete from '../components/SearchAutocomplete'

export default function DestinationsPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const navigationState = location.state as { tripReturn?: { sectionId?: string; returnPath?: string } } | null
  const tripReturn = (navigationState?.tripReturn?.sectionId === 'custom-trip' && navigationState.tripReturn.returnPath === '/')
    || (navigationState?.tripReturn?.sectionId === 'package-planner' && navigationState.tripReturn.returnPath === '/tour-packages')
  const [search, setSearch] = useState(new URLSearchParams(location.search).get('place') ?? '')
  const [selectedDestination, setSelectedDestination] = useState<string | null>(null)
  const matches = searchPlaceSuggestions(search)
  const customiseUrl = tripReturn ? `${navigationState?.tripReturn?.returnPath}#${navigationState?.tripReturn?.sectionId}` : '/#custom-trip'
  const filtered = destinations.filter((place) => {
    if (selectedDestination) return place.id === selectedDestination
    const text = [place.name, ...place.aliases, place.count, place.detail, ...place.attractions.map((attraction) => `${attraction.name} ${attraction.detail}`), ...activitiesForPlaces([place.id]).map((activity) => activity.name)].join(' ').toLowerCase()
    return text.includes(search.trim().toLowerCase()) || matches.some((match) => match.destinationId === place.id)
  })

  function chooseSuggestion(suggestion: PlaceSuggestion) {
    setSearch(suggestion.label)
    setSelectedDestination(suggestion.destinationId)
    requestAnimationFrame(() => {
      const heading = document.getElementById(`place-${suggestion.destinationId}`)
      heading?.focus({ preventScroll: true })
      heading?.closest('article')?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    })
  }

  return <>
    <section className="page-hero places-hero">
      <div className="page-width">
        <div className="breadcrumb"><Link to="/">Home</Link><span>/</span><span>Places</span></div>
        <p className="eyebrow">Near the lake. Beyond the mountains.</p>
        <h1>Places to visit<br /><em>in Kashmir.</em></h1>
        <p>Find the places that fit your pace, from a Srinagar morning to a few nights in the high valleys.</p>
        <div className="destination-hero-actions">
          <Link className="button button-dark" to={customiseUrl}>Customise your trip <ArrowRight size={17} aria-hidden="true" /></Link>
          {tripReturn && <button className="button button-outline" type="button" onClick={() => navigate(-1)}><ArrowLeft size={16} /> Back to your trip</button>}
        </div>
      </div>
    </section>
    <div className="page-width destination-guide-layout">
      <section className="place-guide" aria-label="Destination guide">
        <SearchAutocomplete label="Search places or attractions" placeholder="Try Gulmarg, Chandanwari or Drung" value={search} items={placeSuggestions} storageKey={recentPlaceSearchesKey} submitLabel="Search places" suggestionsLabel="Place suggestions" recentLabel="Recent place searches" onChange={(value) => { setSearch(value); setSelectedDestination(null) }} onSelect={chooseSuggestion} />
        <p className="place-result-count" role="status">{filtered.length} {filtered.length === 1 ? 'place' : 'places'} to explore</p>
        {filtered.length ? <div className="place-list">{filtered.map((place) => {
          const placeActivities = activitiesForPlaces([place.id])
          return <article className="place-entry" key={place.id} aria-labelledby={`place-${place.id}`}>
          <div className="place-travel-facts"><span><MapPin size={16} /><strong>{place.distance}</strong> from Srinagar (approx.)</span><span><Clock size={16} /><strong>{place.travelTime}</strong> one way (approx.)</span></div>
          <div className="place-entry-main">
            <figure><DestinationPhotos places={place.includedPlaces} />{place.includedPlaces.some((included) => !included.photoCredit && !included.photoIsUserProvided && !included.additionalPhotos?.length) && <figcaption>Uncredited images are illustrative travel photography</figcaption>}</figure>
            <div className="place-entry-copy"><p className="eyebrow">{place.count}</p><h2 id={`place-${place.id}`} tabIndex={-1}>{place.name}</h2><p>{place.detail}</p><dl><div><dt><Clock size={15} aria-hidden="true" /> Time to spend</dt><dd>{place.suggestedVisit}</dd></div><div><dt><CalendarDays size={15} aria-hidden="true" /> Best season</dt><dd>{place.season}</dd></div></dl>
            </div>
          </div>
          <section className="place-attractions" aria-label={`Main attractions in ${place.name}`}><h3><Compass size={20} aria-hidden="true" /> Main attractions</h3><ul>{place.attractions.map((attraction, index) => <li key={attraction.name}><span className="place-highlight-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><div><strong>{attraction.name}</strong><p>{attraction.detail}</p></div></li>)}</ul></section>
          <section className="place-experiences" aria-label={`Activities in ${place.name}`}><h3><Sparkles size={20} aria-hidden="true" /> Activities & experiences</h3>
            {placeActivities.length ? <><p className="place-section-note">Optional paid experiences from our activity catalogue. Request them in the Activities step; prices and availability are confirmed separately.</p><ul>{placeActivities.map((activity) => <li key={activity.id}><ActivityIcon activity={activity} /><div><h4>{activity.name}</h4><p>{activity.description}</p><small>{activity.season}</small><p className="place-activity-note">{activity.note}</p>{activity.operatorCheck && <strong className="activity-check-note">Operator verification required</strong>}</div></li>)}</ul></> : <><p className="place-section-note">Enjoy the scenery, photography and permitted sightseeing described above. No paid activities for this place are currently listed in our catalogue; ask AVELOF about suitable options rather than assuming an operator is available.</p><Link className="text-link" to="/activities">Browse the activity catalogue <ArrowRight size={15} aria-hidden="true" /></Link></>}
          </section>
          <section className="place-before-you-go" aria-label={`Before visiting ${place.name}`}><h3><ShieldCheck size={20} aria-hidden="true" /> Before you go</h3><p className="place-access-note">{place.accessNote}</p></section>
          <div className="place-customise"><p>Make room for {place.name} in a trip shaped around your dates and pace. Choose your places in the main planner.</p><Link className="button button-dark" to={customiseUrl}>Customise your trip <ArrowRight size={16} aria-hidden="true" /></Link></div>
        </article>})}</div> : <div className="empty-state"><Search size={26} /><h2>No places match</h2><p>Try another place or attraction.</p><button className="button button-outline" onClick={() => { setSearch(''); setSelectedDestination(null) }}>Clear search <X size={16} /></button></div>}
      </section>
    </div>
  </>
}