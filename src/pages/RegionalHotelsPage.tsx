import { BedDouble, ArrowRight } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import BackButton from '../components/BackButton'
import CallAssistance from '../components/CallAssistance'
import LadakhPhotoGallery from '../components/LadakhPhotoGallery'
import { CatalogCard } from './Pages'
import { useRegisteredHotels } from '../services/hotelService'
import { regionHomePath } from '../data/regions'
import type { Region } from '../data/regions'

export default function RegionalHotelsPage({ region }: { region: Region }) {
  const hotels = useRegisteredHotels(true, undefined, region)
  const [searchParams, setSearchParams] = useSearchParams()
  const search = searchParams.get('q') ?? ''
  const searchWords = search.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const searchOptions = [...new Set(hotels.hotels.flatMap((hotel) => [hotel.name, hotel.location]))].sort((a, b) => a.localeCompare(b))
  const filteredHotels = hotels.hotels.filter((hotel) => searchWords.every((word) => `${hotel.name} ${hotel.location}`.toLowerCase().includes(word)))
  const updateSearch = (value: string) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set('q', value)
    else next.delete('q')
    setSearchParams(next, { replace: true })
  }
  return <>
    <section className="page-hero"><div className="page-width">
      <div className="breadcrumb"><BackButton /><Link to={regionHomePath(region)}>Home</Link><span>/</span><span>{region} hotels</span></div>
      <p className="eyebrow">A place to land</p><h1>Hotels in {region}.</h1>
      <p>Browse approved hotels and houseboats in {region}. Each property shows its own facilities, room rates and meal options. Availability requires confirmation.</p>
    </div></section>
    <section className="catalog-page page-width">
      <div className="filters-bar hotel-search-bar"><label htmlFor="hotel-search"><span>Search hotels and houseboats</span><input id="hotel-search" type="search" list="hotel-search-options" placeholder="Hotel name or location" maxLength={100} value={search} onChange={(event) => updateSearch(event.target.value)} /></label><datalist id="hotel-search-options">{searchOptions.map((value) => <option key={value} value={value} />)}</datalist>{search && <button type="button" className="text-link" onClick={() => updateSearch('')}>Clear search</button>}</div>
      <CallAssistance regional={region === 'Jammu'} />
      {hotels.loading && <p role="status">Loading approved {region} stays...</p>}
      {hotels.error && <p className="enquiry-error" role="alert">{hotels.error} <button type="button" className="text-link" onClick={hotels.reload}>Retry loading stays</button></p>}
      {!hotels.loading && !hotels.error && !hotels.hotels.length && <div className="empty-state"><BedDouble size={30} aria-hidden="true" /><h2>No approved stays yet</h2><p>{region} properties will appear here after registration and AVELOF approval.</p><Link className="button button-outline" to="/register-hotel">Register your hotel or houseboat <ArrowRight size={16} aria-hidden="true" /></Link></div>}
      {!hotels.loading && !hotels.error && hotels.hotels.length > 0 && <p role="status">{filteredHotels.length} {filteredHotels.length === 1 ? 'stay' : 'stays'} found</p>}
      {!hotels.loading && !hotels.error && hotels.hotels.length > 0 && !filteredHotels.length && <div className="empty-state"><BedDouble size={30} aria-hidden="true" /><h2>No matching stays</h2><p>Try another hotel name or location.</p><button type="button" className="button button-outline" onClick={() => updateSearch('')}>Clear search</button></div>}
      <div className="catalog-grid">{filteredHotels.map((hotel) => <CatalogCard key={hotel.id} item={hotel} kind="hotel" />)}</div>
      <div className="driver-directory-register"><Link className="text-link" to="/register-hotel">Register your hotel or houseboat <ArrowRight size={16} aria-hidden="true" /></Link><Link className="text-link" to="/hotel-status">Edit your details <ArrowRight size={16} aria-hidden="true" /></Link></div>
    </section>
    {region === 'Ladakh' && <LadakhPhotoGallery preview />}
  </>
}
