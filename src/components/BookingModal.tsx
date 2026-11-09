import { useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { ArrowRight, MessageCircle, X } from 'lucide-react'
import { business } from '../config'
import { hotels, rentalCars, tourPackages } from '../data/catalog'
import { prepareRequest } from '../services/bookingService'
import HotelRates from './HotelRates'
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
  const [checkInDate, setCheckInDate] = useState(kind === 'package' ? additionalFields.arrivalDate ?? '' : '')
  const [checkOutDate, setCheckOutDate] = useState(kind === 'package' ? additionalFields.departureDate ?? '' : '')
  const plannerDates = kind === 'package' && Boolean(additionalFields.arrivalDate && additionalFields.departureDate && additionalFields.placesToVisit)
  const [preferredStay, setPreferredStay] = useState(selectedItem ?? hotels[0].name)
  const [hotelMeals, setHotelMeals] = useState({ breakfast: false, dinner: false })
  const selectedHotel = hotels.find((hotel) => hotel.name === preferredStay) ?? hotels[0]
  const roomOnlyPrice = selectedHotel.roomOnlyPrice ?? selectedHotel.price
  const selectedNightlyRate = roomOnlyPrice + (selectedHotel.price - roomOnlyPrice) / 2 * (Number(hotelMeals.breakfast) + Number(hotelMeals.dinner))
  const millisecondsPerDay = 24 * 60 * 60 * 1000
  const nights = checkInDate && checkOutDate ? (Date.parse(checkOutDate) - Date.parse(checkInDate)) / millisecondsPerDay : 0
  const stayDuration = nights > 0 ? `${nights + 1} days, ${nights} ${nights === 1 ? 'night' : 'nights'}` : ''
  const rentalDays = checkInDate && checkOutDate && nights >= 0 ? nights + 1 : 0
  const earliestCheckout = checkInDate ? new Date(Date.parse(checkInDate) + millisecondsPerDay).toISOString().slice(0, 10) : undefined

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const fields = Object.fromEntries([...new FormData(event.currentTarget).entries()].map(([key, value]) => [key, String(value)]))
    if (submitDisabled || ((kind === 'hotel' || kind === 'package') && !stayDuration) || (kind === 'car' && !rentalDays)) return
    const request = prepareRequest({ kind, fields: { ...fields, ...additionalFields, ...(kind === 'package' ? { arrivalDate: checkInDate, departureDate: checkOutDate, tripDays: String(nights + 1), tripNights: String(nights) } : {}), ...(kind === 'car' ? { rentalDays: String(rentalDays) } : {}), ...(kind === 'hotel' ? { stayDuration, breakfast: hotelMeals.breakfast ? 'Included' : 'Not included', dinner: hotelMeals.dinner ? 'Included' : 'Not included', nightlyRate: `₹${selectedNightlyRate.toLocaleString('en-IN')} per couple per night` } : {}) } })
    window.open(request.whatsappUrl, '_blank', 'noopener,noreferrer')
    onPrepared(request)
  }

  return <form onSubmit={submit} className="enquiry-form">
    {children}
    <div className="form-grid">
      <label>Name<input name="fullName" autoComplete="name" required maxLength={100} placeholder="Your full name" /></label>
      <label>Phone number<input name="phoneNumber" type="tel" autoComplete="tel" required pattern={'[+0-9\\s\\(\\)\\-]{7,25}'} title="Enter a phone number with 7 to 25 characters, including your country code." placeholder="+91 98765 43210" /></label>
    </div>
    {(kind === 'car' || kind === 'package') && <>
      <div className="form-grid rental-enquiry-dates">
        <label>Start date<input name={kind === 'package' ? 'arrivalDate' : 'startDate'} type="date" value={checkInDate} readOnly={plannerDates} onChange={(event) => setCheckInDate(event.target.value)} required /></label>
        <label>End date<input name={kind === 'package' ? 'departureDate' : 'endDate'} type="date" value={checkOutDate} readOnly={plannerDates} min={kind === 'package' ? earliestCheckout : checkInDate || undefined} onChange={(event) => setCheckOutDate(event.target.value)} required /></label>
      </div>
      <p className="privacy-note" role="status">{kind === 'package' ? stayDuration ? <strong>{stayDuration}</strong> : checkInDate && checkOutDate ? 'End date must be after the start date.' : null : rentalDays ? <strong>{rentalDays} {rentalDays === 1 ? 'day' : 'days'}</strong> : checkInDate && checkOutDate ? 'End date must be on or after the start date.' : null}</p>
      {plannerDates && <p className="privacy-note">Dates match your custom itinerary. To change them, close this form and update your planner dates.</p>}
    </>}
    {(kind === 'package' || kind === 'contact') && <label className="full-field">Package preference<select name="packagePreference" defaultValue={kind === 'package' && selectedItem ? selectedItem : tourPackages[0].name} required>
      {tourPackages.filter((item) => !item.underDevelopment).map((item) => <option key={item.id} value={item.name}>{item.name} - {item.duration}</option>)}
      <option value="Custom package">A custom journey</option><option value="Stay or car only">Stay or car only</option>
    </select></label>}
    {kind === 'hotel' && <label className="full-field">Preferred stay<select name="preferredStay" value={preferredStay} onChange={(event) => { setPreferredStay(event.target.value); setHotelMeals({ breakfast: false, dinner: false }) }}>{hotels.map((hotel) => <option key={hotel.id} value={hotel.name}>{hotel.name} - {hotel.location} - {hotel.category.replace(/ package$/i, '')}</option>)}</select></label>}
    <fieldset className="guest-fields"><legend>{kind === 'car' ? 'Who will travel?' : 'Who will stay?'}</legend>
      <div className="form-grid">
        <label>Adults<input name="adults" type="number" min="1" max="100" defaultValue="2" required /></label>
        <label>Children<input name="children" type="number" min="0" max="100" defaultValue="0" required /></label>
      </div>
      {(kind === 'package' || kind === 'contact') && <label className="full-field">Travelling as<select name="travelGroup" defaultValue="Couple"><option>Couple</option><option>Family</option><option>Friends</option><option>Solo traveller</option><option>Group</option></select></label>}
    </fieldset>
    {kind === 'hotel' ? <>
      <div className="form-grid">
        <label>Check-in date<input name="checkInDate" type="date" value={checkInDate} onChange={(event) => setCheckInDate(event.target.value)} required /></label>
        <label>Check-out date<input name="checkOutDate" type="date" value={checkOutDate} min={earliestCheckout} onChange={(event) => setCheckOutDate(event.target.value)} required /></label>
      </div>
      <p className="privacy-note" role="status">{stayDuration ? <strong>{stayDuration}</strong> : checkInDate && checkOutDate ? 'Check-out must be after check-in.' : null}</p>
      <HotelRates key={selectedHotel.id} hotel={selectedHotel} onChange={(breakfast, dinner) => setHotelMeals({ breakfast, dinner })} />
    </> : <label className="full-field">{kind === 'car' ? 'Preferred vehicle' : 'Car rental'}<select name="carRental" defaultValue={additionalFields.carRental ?? (kind === 'car' ? selectedItem ?? rentalCars[0].name : 'Please recommend a car')}>
      <option>Please recommend a car</option><option>No car needed</option>
      {rentalCars.map((car) => <option key={car.id} value={car.name}>{car.name} - {car.seats} seats</option>)}
    </select></label>}
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
        <span className="success-mark"><MessageCircle size={24} /></span>
        <p className="eyebrow">Continue in WhatsApp</p>
        <h2 id="booking-title">Tap Send in WhatsApp.</h2>
        <p id="booking-description">WhatsApp should open automatically with your enquiry. If it didn’t open, use the link below.</p>
        <div className="modal-actions">
          <a className="button button-dark" href={request.whatsappUrl} target="_blank" rel="noreferrer"><MessageCircle size={17} /> Open WhatsApp</a>
        </div>
        <p className="privacy-note">Enquiry reference: {request.reference}. This is not a booking confirmation. Your message is only sent after you press Send in WhatsApp.</p>
        <button className="text-link confirmation-done" onClick={onClose}>Done <ArrowRight size={16} /></button>
      </> : <>
        <p className="eyebrow">Enquire Now</p>
        <h2 id="booking-title">{kind === 'hotel' ? 'Send us your hotel enquiry.' : kind === 'car' ? 'Send us your car rental enquiry.' : 'Send us your trip enquiry.'}</h2>
        <p id="booking-description" className="modal-intro">Share a few details and we’ll help plan the next steps.</p>
        <EnquiryForm kind={kind} selectedItem={selectedItem} additionalFields={initialFields} onPrepared={prepared} />
      </>}
    </section>
  </div>
}