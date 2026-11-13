import { Link } from 'react-router-dom'
import { ArrowRight, Car, Hotel } from 'lucide-react'
export default function PartnersPage() {
  return <section className="enquiry-access-page page-width">
    <div className="enquiry-access-heading"><div><p className="eyebrow">Work with our local team</p><h1>Partner with AVELOF</h1><p>A dedicated space for hotel owners and drivers. Customer bookings remain in Check Bookings.</p></div></div>
    <div className="partner-options">
      <article className="admin-review-record"><Hotel size={28} /><h2>Hotel owners</h2><p>Share your rooms, amenities, photos and room-only rates with optional meal charges.</p><Link className="button button-dark" to="/register-hotel">Register your hotel <ArrowRight size={16} /></Link><p><Link className="text-link" to="/hotel-status">Check hotel registration status</Link></p></article>
      <article className="admin-review-record"><Car size={28} /><h2>Drivers & vehicle owners</h2><p>Register your vehicle and proposed daily rate. AVELOF reviews your private driver details before publishing.</p><Link className="button button-dark" to="/register-driver">Register as a driver <ArrowRight size={16} /></Link><p><Link className="text-link" to="/driver-status">Check driver registration status</Link></p></article>
    </div><p className="privacy-note">Submitting is not approval or a confirmed booking. Contact and licence details stay private.</p>
  </section>
}
