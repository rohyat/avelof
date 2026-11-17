import { BedDouble, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import BackButton from '../components/BackButton'
import CallAssistance from '../components/CallAssistance'
import LadakhPhotoGallery from '../components/LadakhPhotoGallery'
import { CatalogCard } from './Pages'
import { useRegisteredHotels } from '../services/hotelService'
import { regionHomePath } from '../data/regions'
import type { Region } from '../data/regions'

export default function RegionalHotelsPage({ region }: { region: Region }) {
  const hotels = useRegisteredHotels(true, undefined, region)
  return <>
    <section className="page-hero"><div className="page-width">
      <div className="breadcrumb"><BackButton /><Link to={regionHomePath(region)}>Home</Link><span>/</span><span>{region} hotels</span></div>
      <p className="eyebrow">A place to land</p><h1>Stays in {region}.</h1>
      <p>Browse approved hotels in {region}. Each property shows its own facilities, room rates and meal options. Availability requires confirmation.</p>
    </div></section>
    <section className="catalog-page page-width">
      <CallAssistance regional={region === 'Jammu'} />
      {hotels.loading && <p role="status">Loading approved {region} hotels...</p>}
      {hotels.error && <p className="enquiry-error" role="alert">{hotels.error} <button type="button" className="text-link" onClick={hotels.reload}>Retry loading hotels</button></p>}
      {!hotels.loading && !hotels.error && !hotels.hotels.length && <div className="empty-state"><BedDouble size={30} aria-hidden="true" /><h2>No approved hotels yet</h2><p>{region} properties will appear here after registration and AVELOF approval.</p><Link className="button button-outline" to="/register-hotel">Register your hotel <ArrowRight size={16} aria-hidden="true" /></Link></div>}
      <div className="catalog-grid">{hotels.hotels.map((hotel) => <CatalogCard key={hotel.id} item={hotel} kind="hotel" />)}</div>
      <div className="driver-directory-register"><Link className="text-link" to="/register-hotel">Register your hotel <ArrowRight size={16} aria-hidden="true" /></Link><Link className="text-link" to="/hotel-status">Edit your details <ArrowRight size={16} aria-hidden="true" /></Link></div>
    </section>
    {region === 'Ladakh' && <LadakhPhotoGallery preview />}
  </>
}
