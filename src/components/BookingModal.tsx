import { useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { ArrowRight, Check, MessageCircle, X } from 'lucide-react'
import { business } from '../config'
import { hotels, rentalCars, tourPackages } from '../data/catalog'
import { prepareRequest } from '../services/bookingService'
import type { BookingKind, PreparedRequest } from '../types'

interface BookingModalProps {
  kind: BookingKind
  selectedItem?: string
  initialFields?: Record<string, string>
  initialRequest?: PreparedRequest
  onClose: () => void
}

export function EnquiryForm({ kind = 'package', selectedItem, onPrepared, additionalFields = {}, children, submitDisabled = false }: {
  kind?: BookingKind
  selectedItem?: string
  onPrepared: (request: PreparedRequest) => void
  additionalFields?: Record<string, string>
  children?: ReactNode
  submitDisabled?: boolean
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const fields = Object.fromEntries([...new FormData(event.currentTarget).entries()].map(([key, value]) => [key, String(value)]))
    if (submitDisabled) return
    onPrepared(prepareRequest({ kind, fields: { ...fields, ...additionalFields } }))
  }

  return <form onSubmit={submit} className="enquiry-form">
    {children}
    <div className="form-grid">
      <label>Name<input name="fullName" autoComplete="name" required maxLength={100} placeholder="Your full name" /></label>
      <label>Phone number<input name="phoneNumber" type="tel" autoComplete="tel" required pattern={'[+0-9\\s\\(\\)\\-]{7,25}'} title="Enter a phone number with 7 to 25 characters, including your country code." placeholder="+91 98765 43210" /></label>
    </div>
    <label className="full-field">Package preference<select name="packagePreference" defaultValue={kind === 'package' && selectedItem ? selectedItem : tourPackages[0].name} required>
      {tourPackages.map((item) => <option key={item.id} value={item.name}>{item.name} - {item.duration}</option>)}
      <option value="Custom package">A custom journey</option><option value="Stay or car only">Stay or car only</option>
    </select></label>
    {kind === 'hotel' && <label className="full-field">Preferred stay<select name="preferredStay" defaultValue={selectedItem ?? hotels[0].name}>{hotels.map((hotel) => <option key={hotel.id}>{hotel.name}</option>)}</select></label>}
    <fieldset className="guest-fields"><legend>Who will stay?</legend>
      <div className="form-grid">
        <label>Adults<input name="adults" type="number" min="1" max="100" defaultValue="2" required /></label>
        <label>Children<input name="children" type="number" min="0" max="100" defaultValue="0" required /></label>
      </div>
      <label className="full-field">Travelling as<select name="travelGroup" defaultValue="Couple"><option>Couple</option><option>Family</option><option>Friends</option><option>Solo traveller</option><option>Group</option></select></label>
    </fieldset>
    <label className="full-field">Car rental<select name="carRental" defaultValue={kind === 'car' ? selectedItem ?? rentalCars[0].name : 'Please recommend a car'}>
      <option>Please recommend a car</option><option>No car needed</option>
      {rentalCars.map((car) => <option key={car.id} value={car.name}>{car.name} - {car.seats} seats</option>)}
    </select></label>
    <label className="full-field">Instructions or suggestions <span className="optional">Optional</span><textarea name="instructions" rows={3} maxLength={2000} placeholder="Travel dates, children's ages, room preferences, pickup location, or anything else on your mind" /></label>
    <button className="button button-dark enquiry-submit" type="submit" disabled={submitDisabled}>Submit enquiry <ArrowRight size={17} /></button>
    <p className="privacy-note">WhatsApp will open with a prepared message to {business.phone}. Review it and press Send to contact us. No booking or message is sent by this website.</p>
  </form>
}

export default function BookingModal({ kind, selectedItem, initialFields, initialRequest, onClose }: BookingModalProps) {
  const dialogRef = useRef<HTMLElement>(null)
  const [request, setRequest] = useState<PreparedRequest | null>(initialRequest ?? null)

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialogRef.current?.focus()
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
      if (event.key !== 'Tab') return
      const controls = dialogRef.current?.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea')
      if (!controls?.length) return
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKey)
      previousFocus?.focus()
    }
  }, [onClose])

  function prepared(nextRequest: PreparedRequest) {
    setRequest(nextRequest)
    dialogRef.current?.scrollTo({ top: 0 })
    dialogRef.current?.focus()
  }

  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section ref={dialogRef} tabIndex={-1} className={`booking-modal${request ? ' confirmation-modal' : ''}`} role="dialog" aria-modal="true" aria-labelledby="booking-title" aria-describedby="booking-description">
      <button className="modal-close icon-button" onClick={onClose} aria-label="Close enquiry"><X /></button>
      {request ? <>
        <span className="success-mark"><Check size={24} /></span>
        <p className="eyebrow">Enquiry prepared</p>
        <h2 id="booking-title">Your WhatsApp message is ready.</h2>
        <p id="booking-description">Review your enquiry, then send it to {business.phone} in WhatsApp.</p>
        <div className="modal-actions">
          <a className="button button-dark" href={request.whatsappUrl} target="_blank" rel="noreferrer"><MessageCircle size={17} /> Open WhatsApp</a>
        </div>
        <p className="privacy-note">Enquiry reference: {request.reference}. This is not a booking confirmation. Your message is only sent after you press Send in WhatsApp.</p>
        <button className="text-link confirmation-done" onClick={onClose}>Done <ArrowRight size={16} /></button>
      </> : <>
        <p className="eyebrow">Enquire Now</p>
        <h2 id="booking-title">Send us your trip enquiry.</h2>
        <p id="booking-description" className="modal-intro">Share a few details and we’ll help plan the next steps.</p>
        <EnquiryForm kind={kind} selectedItem={selectedItem} additionalFields={initialFields} onPrepared={prepared} />
      </>}
    </section>
  </div>
}