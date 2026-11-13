import { Link, useOutletContext } from 'react-router-dom'
import { ArrowRight, MapPin, Users } from 'lucide-react'
import type { SiteContext } from '../components/SiteLayout'
import { driverSelectionValue, useRegisteredDrivers } from '../services/driverService'

export default function DriversPage() {
  const { openBooking } = useOutletContext<SiteContext>()
  const drivers = useRegisteredDrivers(true)
  return <>
    <section className="page-hero"><div className="page-width">
      <div className="breadcrumb"><Link to="/">Home</Link><span>/</span><Link to="/car-rentals">Car rentals</Link><span>/</span><span>Our drivers</span></div>
      <p className="eyebrow">Local driver partners</p><h1>Meet your driver.</h1>
      <p>Browse drivers approved by AVELOF. Full contact details and identity documents are never shown publicly.</p>
    </div></section>
    <section className="page-width driver-directory">
      {drivers.loading && <p role="status">Loading approved drivers...</p>}
      {drivers.error && <p className="enquiry-error" role="alert">{drivers.error} <button type="button" className="text-link" onClick={drivers.reload}>Retry loading drivers</button></p>}
      {!drivers.loading && !drivers.error && !drivers.cars.length && <div className="empty-state"><h2>Driver listings are coming soon.</h2><p>Our team reviews each driver before they appear here.</p><Link className="button button-outline" to="/car-rentals">Explore vehicles</Link></div>}
      <div className="driver-directory-grid">
        {drivers.cars.map((driver) => <article className="driver-directory-card" key={driver.id}>
        <img className="driver-directory-photo" src={driver.driverPhoto} alt={`Portrait of ${driver.driverDisplayName}`} loading="lazy" />
        <div className="driver-directory-details">
          <p className="eyebrow">AVELOF-approved driver</p>
          <h2>{driver.driverDisplayName}</h2>
          <p className="driver-directory-vehicle">{driver.name}</p>
          <p className="driver-directory-facts"><span><MapPin size={15} />{driver.location}</span><span><Users size={15} />{driver.seats} passenger seats</span></p>
          <p className="driver-directory-phone">Phone: {driver.maskedPhone}</p>
          <p className="driver-directory-price">INR {driver.price.toLocaleString('en-IN')} <small>per day</small></p>
          <button type="button" className="button button-dark" onClick={() => openBooking('car', driverSelectionValue(driver))}>Enquire about this driver <ArrowRight size={16} /></button>
        </div>
      </article>)}</div>
    </section>
  </>
}
