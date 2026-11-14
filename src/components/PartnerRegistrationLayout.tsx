import type { ReactNode } from 'react'
import { ArrowLeft, ArrowRight, Building2, CarFront, ClipboardCheck, FileImage, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function PartnerRegistrationLayout({ kind, children, editing = false }: { kind: 'hotel' | 'driver'; children: ReactNode; editing?: boolean }) {
  const hotel = kind === 'hotel'
  const Icon = hotel ? Building2 : CarFront
  return <section className="enquiry-access-page page-width partner-registration-page">
    <Link className="text-link partner-back-link" to="/partners"><ArrowLeft size={16} /> Partner with AVELOF</Link>
    <header className="partner-registration-hero">
      <div>
        <p className="eyebrow">AVELOF partner registration</p>
        <h1>{editing ? hotel ? 'Edit your hotel' : 'Edit your driver registration' : hotel ? 'Register your hotel' : 'Register as a driver'}</h1>
        <p>{editing ? 'Update your details and submit them for review. Saving hides your listing until AVELOF approves the changes.' : hotel ? 'A welcoming stay starts with you. Introduce your property and let us help travellers discover it.' : 'Bring your local knowledge to the journey. Introduce yourself and your vehicle to AVELOF.'}</p>
        {!editing && !hotel && <div className="partner-edit-action"><Link className="button button-outline" to="/driver-status">Edit your details <ArrowRight size={16} /></Link></div>}
        <span className="partner-review-badge"><ShieldCheck size={16} /> Reviewed before going live</span>
      </div>
      <span className="partner-hero-icon"><Icon size={64} strokeWidth={1.25} aria-hidden="true" /></span>
    </header>
    <div className="partner-registration-layout">
      <aside className="partner-registration-guide" aria-label="Registration guide">
        <p className="eyebrow">A simple start</p><h2>Your next chapter, with AVELOF.</h2>
        <ol>
          <li><span><Icon size={19} aria-hidden="true" /></span><div><h3>Introduce {hotel ? 'your property' : 'yourself'}</h3><p>{hotel ? 'Share your hotel details, rooms and rates.' : 'Add your contact, licence and vehicle details. No driver price is needed.'}</p></div></li>
          <li><span><FileImage size={19} aria-hidden="true" /></span><div><h3>Add {hotel ? 'your photos' : 'a portrait'}</h3><p>{hotel ? 'Choose up to five photos that show your property at its best.' : 'Upload one clear photo of yourself.'}</p></div></li>
          <li><span><ClipboardCheck size={19} aria-hidden="true" /></span><div><h3>Leave the review to us</h3><p>Save your registration ID and status code. Your listing goes live only after approval.</p></div></li>
        </ol>
        <div className="partner-privacy-note"><ShieldCheck size={20} aria-hidden="true" /><p>{hotel ? 'Your contact name and phone number stay private.' : 'Your age and full contact details stay private. Phone and licence numbers are masked in approved listings.'}</p></div>
      </aside>
      <div className="partner-registration-content">{children}</div>
    </div>
  </section>
}
