import { useState } from 'react'
import { ArrowRight, CalendarDays, Camera, ChevronDown, Compass, Footprints, Landmark, MapPin, MountainSnow, Route, ShieldCheck, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ladakhPlaceCategories, ladakhPlaces } from '../data/ladakhPlaces'
import type { LadakhPlaceCategory } from '../data/ladakhPlaces'

export default function LadakhPlaces({ preview = false }: { preview?: boolean }) {
  const [category, setCategory] = useState<LadakhPlaceCategory>('All places')
  const places = preview ? ladakhPlaces.slice(0, 3) : ladakhPlaces.filter((place) => category === 'All places' || place.category === category)
  return <section className={`section page-width ladakh-places${preview ? ' ladakh-places-preview' : ''}`} aria-labelledby="ladakh-places-title">
    <div className="ladakh-places-intro">
      <div><p className="eyebrow">Not just a stop on the map</p><h2 id="ladakh-places-title">{preview ? 'Find your kind of Ladakh.' : 'One region. Many worlds to explore.'}</h2><p>{preview ? 'Lakeside colour, valley roads and cliffside monasteries. Take a closer look before choosing your route.' : 'Go beyond the headline sights. Discover what to see, what lies nearby and what each place asks of your itinerary.'}</p></div>
      <span className="ladakh-places-mark"><Compass size={28} aria-hidden="true" />{preview ? 'A little inspiration' : `${ladakhPlaces.length} destination guides`}</span>
    </div>
    {!preview && <>
      <div className="ladakh-places-planning"><ShieldCheck size={22} aria-hidden="true" /><p>Allow at least 48 hours in Leh before higher areas. These are destination ideas, not a confirmed itinerary; remote extensions need extra time, current access checks and suitable acclimatisation.</p></div>
      <div className="ladakh-route-filters" role="group" aria-label="Filter Ladakh places">{ladakhPlaceCategories.map((value) => <button key={value} type="button" aria-pressed={category === value} onClick={() => setCategory(value)}>{value}</button>)}</div>
      <p className="ladakh-result-count" role="status">{places.length} {places.length === 1 ? 'place' : 'places'} to explore</p>
    </>}
    <div className="ladakh-place-grid">{places.map((place) => {
      const Icon = place.category === 'Towns & culture' ? Landmark : place.category === 'Lakes & night skies' ? Sparkles : MountainSnow
      return <article className={`ladakh-place-card${place.photo ? ' has-photo' : ''}`} key={place.id} aria-labelledby={`${place.id}-title`}>
        {place.photo ? <div className="ladakh-place-photo"><img src={place.photo.src} alt={place.photo.alt} style={{ objectPosition: place.photo.position }} loading="lazy" decoding="async" /><span><Camera size={14} aria-hidden="true" /> Traveller-shared photograph</span></div> : <div className="ladakh-place-identity"><Icon size={34} aria-hidden="true" /><span>{place.tagline}</span></div>}
        <div className="ladakh-place-body"><p className="eyebrow"><Icon size={14} aria-hidden="true" />{place.category}</p><h3 id={`${place.id}-title`}>{place.name}</h3>{place.photo && <p className="ladakh-place-tagline">{place.tagline}</p>}<p className="ladakh-place-description">{place.description}</p>
          <ul className="ladakh-place-highlights">
            <li><Camera size={19} aria-hidden="true" /><div><strong>Don't miss</strong><p>{place.highlights}</p></div></li>
            {!preview && <li><MapPin size={19} aria-hidden="true" /><div><strong>Explore nearby</strong><p>{place.nearby}</p></div></li>}
            <li><Route size={19} aria-hidden="true" /><div><strong>Make it part of your route</strong><p>{place.route}</p></div></li>
          </ul>
          {!preview && <details className="ladakh-place-details"><summary>Visit notes & planning tips <ChevronDown size={18} aria-hidden="true" /></summary>
            <ul className="ladakh-place-highlights">
              <li><CalendarDays size={19} aria-hidden="true" /><div><strong>Season & conditions</strong><p>{place.season}</p></div></li>
              <li><ShieldCheck size={19} aria-hidden="true" /><div><strong>Plan it well</strong><p>{place.planning}</p></div></li>
              {place.visitNotes.map((note) => <li key={note}><Footprints size={18} aria-hidden="true" /><p>{note}</p></li>)}
            </ul>
            {place.gallery && <div className="ladakh-place-gallery">{place.gallery.map((photo) => <figure key={photo.src}><img src={photo.src} alt={photo.alt} loading="lazy" decoding="async" /><figcaption>{photo.caption}</figcaption></figure>)}</div>}
            <a className="text-link" href={place.source} target="_blank" rel="noreferrer">Official district guide <ArrowRight size={15} aria-hidden="true" /></a>
          </details>}
          <Link className="text-link ladakh-place-action" to={preview ? '/ladakh/places' : `/ladakh/contact?place=${place.id}`} aria-label={preview ? `Explore places including ${place.name}` : `Ask about ${place.name}`}>{preview ? 'Explore the destination guides' : `Ask about ${place.name}`}<ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
      </article>
    })}</div>
    {!preview && <p className="ladakh-photo-note">Photographs shared by the site owner show selected scenes, not guaranteed seasons, access, activities or present-day facilities. Not every destination has a matched photograph yet.</p>}
  </section>
}
