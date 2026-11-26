import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import PaymentReceiptBuilder from '../components/PaymentReceiptBuilder'
import { HotelError, hotelErrorText, requestHotel } from '../services/hotelService'
import './itineraryBuilder.css'

export default function PaymentsPage() {
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    requestHotel('/api/itineraries', 'GET', undefined, controller.signal).then(response => {
      if (controller.signal.aborted) return
      z.object({ authorized: z.literal(true), storage: z.literal(false) }).parse(response)
      setAuthorized(true); setError('')
    }).catch((failure: unknown) => {
      if (controller.signal.aborted) return
      if (failure instanceof HotelError && failure.status === 401) setAuthorized(false)
      else { console.error('Payments access failed', failure); setError(hotelErrorText(failure)) }
    })
    return () => controller.abort()
  }, [revision])
  return <section className="page-width itinerary-builder">
    <p className="eyebrow">AVELOF owner access</p><h1>Payments</h1>
    <nav className="admin-section-nav" aria-label="Owner sections"><Link to="/admin/panel">Enquiries</Link><Link to="/admin/panel/reviews">Reviews</Link><Link to="/admin/panel/hotels">Hotels</Link><Link to="/admin/panel/drivers">Drivers</Link><Link to="/admin/panel/businesses">Businesses</Link><Link to="/admin/panel/itineraries">Itineraries</Link><span aria-current="page">Payments</span></nav>
    {authorized === null && !error && <p role="status">Checking owner access...</p>}
    {authorized === false && <p>Sign in through <Link to="/admin/panel">Owner sign-in</Link> to create payment receipts.</p>}
    {error && <p className="enquiry-error" role="alert">{error} <button type="button" onClick={() => { setError(''); setRevision(value => value + 1) }}>Retry</button></p>}
    {authorized && <div className="itinerary-builder-editor"><PaymentReceiptBuilder /></div>}
  </section>
}
