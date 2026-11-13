import { Link } from 'react-router-dom'
import { ArrowRight, MapPin, Users } from 'lucide-react'
import ReviewStars from '../components/ReviewStars'
import { useRegisteredDrivers } from '../services/driverService'

export default function DriversPage() {
  const drivers = useRegisteredDrivers(true)
  return <>
    <section className="page-hero"><div className="page-width">
      <div className="breadcrumb"><Link to="/">Home</Link><span>/</span><Link to="/car-rentals">Car rentals</Link><span>/</span><span>Our drivers</span></div>
      <p className="eyebrow">Local driver partners</p><h1>Meet your driver.</h1>
      <p>Browse drivers approved by AVELOF. Phone and driving-licence numbers are masked for privacy.</p>
    </div></section>
    <section className="page-width driver-directory">
      {drivers.loading && <p role="status">Loading approved drivers...</p>}
      {drivers.error && <p className="enquiry-error" role="alert">{drivers.error} <button type="button" className="text-link" onClick={drivers.reload}>Retry loading drivers</button></p>}
      {!drivers.loading && !drivers.error && !drivers.cars.length && <div className="empty-state"><h2>Driver listings are coming soon.</h2><p>Our team reviews each driver before they appear here.</p><Link className="button button-outline" to="/car-rentals">Explore vehicles</Link></div>}
      <div className="driver-directory-grid">
        {drivers.cars.map((driver) => <article className="driver-directory-card" key={driver.id}>
        <div className="driver-directory-portrait">
          <img className="driver-directory-photo" src={driver.driverPhoto} alt={`Portrait of ${driver.driverDisplayName}`} loading="lazy" />
          <div className="driver-directory-credentials">
            <p>Phone: {driver.maskedPhone}</p>
            {driver.vehicleNumber && <p>Vehicle registration: {driver.vehicleNumber}</p>}
            {driver.maskedLicenceNumber && <p>Driving licence: {driver.maskedLicenceNumber}</p>}
          </div>
        </div>
        <div className="driver-directory-details">
          <p className="eyebrow">AVELOF-approved driver</p>
          <h2>{driver.driverDisplayName}</h2>
          <p className="driver-directory-id">{driver.registeredDriverId}</p>
          <div className="driver-directory-rating"><ReviewStars rating={driver.driverAverageRating ?? 0} label={driver.driverAverageRating ? `${driver.driverAverageRating.toFixed(1)} out of 5 stars from ${driver.driverReviewCount} reviews` : 'No driver ratings yet'} /><span>{driver.driverAverageRating ? `${driver.driverAverageRating.toFixed(1)} · ${driver.driverReviewCount} ${driver.driverReviewCount === 1 ? 'review' : 'reviews'}` : 'No ratings yet'}</span></div>
          <p className="driver-directory-vehicle">{driver.name}</p>
          <p className="driver-directory-facts"><span><MapPin size={15} />{driver.location}</span><span><Users size={15} />{driver.seats} passenger seats</span></p>
          <Link className="button button-dark" to={`/drivers/${encodeURIComponent(driver.registeredDriverId!)}/reviews`}>View reviews <ArrowRight size={16} /></Link>
        </div>
      </article>)}</div>
    </section>
  </>
}
