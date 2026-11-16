import { useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { ArrowRight, Check, CircleCheck, Copy, MessageCircle, X } from 'lucide-react'
import DateInput from './DateInput'
import HotelDateInput from './HotelDateInput'
import DateCalendarInput from './DateCalendarInput'
import SubmissionProgress from './SubmissionFeedback'
import { rentalCars, tourPackages } from '../data/catalog'
import { createWhatsAppUrl, enquiryPath, formatEnquiryDetails, prepareRequest, saveEnquiry } from '../services/bookingService'
import { indianPhoneNumber } from '../services/phoneNumbers'
import { hotelNightlyPrice, hotelSelectionValue, includedHotelMeals, selectedHotelRoom, useRegisteredHotels } from '../services/hotelService'
import HotelRates from './HotelRates'
import HotelFeature from './HotelFeature'
import RegularPrice from './RegularPrice'
import { hotelPackagePriceInclusions, packagePriceForNights, packageSeasonNotice, packageSeasonStart } from '../services/pricing'
import { hotelRateRange, hotelStayPrice } from '../services/hotelPricing'
import { usePricing, useTourPackages } from '../services/pricingContext'
import { PricingNotice } from './PricingProvider'
import { hotelCategoryLabel, hotelLocationLabel, hotelRoomOccupancy, hotelRoomRateBasis, minimumHotelRooms } from '../data/hotelRegistration'
import type { BookingKind, BookingPayload, PreparedRequest } from '../types'

interface BookingModalProps {
  kind: BookingKind
  selectedItem?: string
  initialRequest?: PreparedRequest
  onClose: () => void
}

function catalogCarSelection(value?: string) {
  if (value === 'No car needed') return value
  return rentalCars.find((car) => value === car.name || value?.startsWith(`${car.name} (AVELOF-DRV-`))?.name ?? rentalCars[0].name
}

export function EnquiryForm({ kind = 'package', selectedItem, onPrepared, additionalFields = {}, children, submitDisabled = false, onSubmittingChange }: {
  kind?: BookingKind
  selectedItem?: string
  onPrepared: (request: PreparedRequest) => void
  additionalFields?: Record<string, string>
  children?: ReactNode
  submitDisabled?: boolean
  onSubmittingChange?: (submitting: boolean) => void
}) {
  const registered = useRegisteredHotels(kind === 'hotel')
  const pricing = usePricing()
  const pricedPackages = useTourPackages()
  const availableHotels = registered.hotels
  const [preferredCar, setPreferredCar] = useState(catalogCarSelection(additionalFields.carRental ?? (kind === 'car' ? selectedItem : undefined)))
  const [checkInDate, setCheckInDate] = useState(kind === 'package' ? additionalFields.arrivalDate ?? '' : '')
  const [chosenCheckOutDate, setCheckOutDate] = useState(kind === 'package' ? additionalFields.departureDate ?? '' : '')
  const plannerDates = kind === 'package' && Boolean(additionalFields.arrivalDate && additionalFields.departureDate && additionalFields.placesToVisit)
  const [staySelection, setPreferredStay] = useState(selectedItem ?? '')
  const preferredStay = staySelection || (availableHotels[0] ? hotelSelectionValue(availableHotels[0]) : '')
  const [hotelMeals, setHotelMeals] = useState({ breakfast: false, dinner: false })
  const [roomSelection, setRoomSelection] = useState({ hotelId: '', roomType: '' })
  const [adults, setAdults] = useState('2')
  const [childCount, setChildCount] = useState('0')
  const [rooms, setRooms] = useState<string | undefined>()
  const [packagePreference, setPackagePreference] = useState(selectedItem === 'Custom package' ? 'Custom package' : tourPackages.find((item) => item.name === selectedItem && !item.underDevelopment)?.name ?? tourPackages[0].name)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const pendingRequest = useRef<{ fingerprint: string; request: PreparedRequest } | null>(null)
  const inFlight = useRef(false)
  const selectedHotel = availableHotels.find((hotel) => hotelSelectionValue(hotel) === preferredStay)
  const lockedHotel = kind === 'hotel' && selectedItem ? selectedHotel : undefined
  const customPackage = kind === 'package' && (packagePreference === 'Custom package' || selectedItem === 'Custom package' || Boolean(additionalFields.placesToVisit))
  const selectedPackage = pricedPackages.find((item) => item.name === packagePreference && !item.underDevelopment)
  const fixedPackage = kind === 'package' && !customPackage
  const packageNights = selectedPackage?.stays.reduce((total, stay) => total + stay.nights, 0) ?? 0
  const departureTime = checkInDate ? Date.parse(checkInDate) + packageNights * 86400000 : NaN
  const automaticDeparture = Number.isFinite(departureTime) ? new Date(departureTime).toISOString().slice(0, 10) : ''
  const checkOutDate = fixedPackage ? automaticDeparture : chosenCheckOutDate
  const room = selectedHotel ? selectedHotelRoom(selectedHotel, roomSelection.hotelId === selectedHotel.id ? roomSelection.roomType : undefined) : undefined
  const people = Number(adults) + Number(childCount)
  const roomQuantity = Number(rooms ?? minimumHotelRooms(people, room?.roomType))
  const validRoomQuantity = Number.isInteger(roomQuantity) && roomQuantity >= minimumHotelRooms(people, room?.roomType) && roomQuantity <= 100
  const selectedRoomRate = selectedHotel ? room?.price ?? selectedHotel.roomOnlyPrice ?? selectedHotel.price : undefined
  const baseNightlyRate = selectedHotel ? hotelNightlyPrice(selectedHotel, hotelMeals.breakfast, hotelMeals.dinner, room?.roomType) : 0
  const selectedNightlyRate = selectedHotel ? hotelNightlyPrice(selectedHotel, hotelMeals.breakfast, hotelMeals.dinner, room?.roomType, checkInDate || undefined) : 0
  const includedMeals = selectedHotel?.registeredHotelId && selectedHotel.breakfastPrice === undefined ? includedHotelMeals(selectedHotel) : hotelMeals
  const millisecondsPerDay = 24 * 60 * 60 * 1000
  const nights = checkInDate && checkOutDate ? (Date.parse(checkOutDate) - Date.parse(checkInDate)) / millisecondsPerDay : 0
  const stayDuration = nights > 0 ? `${nights + 1} days, ${nights} ${nights === 1 ? 'night' : 'nights'}` : ''
  const rentalDays = checkInDate && checkOutDate && nights >= 0 ? nights + 1 : 0
  const earliestCheckout = checkInDate ? new Date(Date.parse(checkInDate) + millisecondsPerDay).toISOString().slice(0, 10) : undefined
  const seasonalPackage = Boolean(checkInDate && checkInDate >= packageSeasonStart)
  const selectedPackagePrice = selectedPackage && nights > 0 && !customPackage ? packagePriceForNights(selectedPackage.price, packageNights, nights, checkInDate) : undefined
  const stayPrice = selectedRoomRate !== undefined && nights > 0 && validRoomQuantity ? hotelStayPrice(selectedRoomRate, Math.round((baseNightlyRate - selectedRoomRate) * 100) / 100, checkInDate, checkOutDate, roomQuantity) : undefined
  const nightlyRange = hotelRateRange(stayPrice?.minNightly ?? selectedNightlyRate, stayPrice?.maxNightly ?? selectedNightlyRate)
  const stayBreakdown = stayPrice?.groups.map((group) => `${group.nights} ${group.nights === 1 ? 'night' : 'nights'} × ₹${group.roomRate.toLocaleString('en-IN')} room-only per room`).join('; ')
  const mealRate = selectedRoomRate === undefined ? 0 : Math.round((baseNightlyRate - selectedRoomRate) * 100) / 100
  const priceBreakdown = stayPrice ? `${stayBreakdown}; meals ₹${mealRate.toLocaleString('en-IN')} per room/night; ${roomQuantity} rooms. Check-out not charged.` : ''

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current || submitDisabled || ((kind === 'hotel' || kind === 'package') && !stayDuration) || (kind === 'car' && !rentalDays)) return
    if (kind === 'hotel' && !selectedHotel) { setSubmitError('Wait for the selected hotel to load, or choose an available hotel.'); return }
    if (kind === 'hotel' && (!validRoomQuantity || !Number.isInteger(people) || people < 1 || people > 100)) { setSubmitError('Choose enough rooms for everyone, including children, and valid guest counts up to 100 people.'); return }
    if (kind !== 'hotel' && preferredCar !== 'No car needed' && !rentalCars.some((car) => car.name === preferredCar)) { setSubmitError('Choose an available vehicle.'); return }
    const data = new FormData(event.currentTarget)
    const website = String(data.get('website') ?? '')
    data.delete('website')
    const fields = Object.fromEntries([...data.entries()].map(([key, value]) => [key, String(value)]))
    if (kind === 'package' || kind === 'car') fields.arrivalBetween6PmAnd7Am = data.has('arrivalBetween6PmAnd7Am') ? 'Yes' : 'No'
    const phone = indianPhoneNumber(fields.phoneNumber ?? '')
    if (!phone) {
      setSubmitError('Enter a 10-digit Indian phone number. The 91 or +91 prefix is optional.')
      return
    }
    fields.phoneNumber = phone
    if (kind === 'package' && !customPackage) {
      if (pricing.loading || pricing.error) { setSubmitError('Wait for current package prices to load, or retry loading prices.'); return }
      if (!selectedPackage || selectedPackagePrice === undefined) { setSubmitError('Choose an available package and valid travel dates.'); return }
      fields.packageRate = `₹${selectedPackagePrice.toLocaleString('en-IN')} per person for ${nights} ${nights === 1 ? 'night' : 'nights'}; based on ₹${selectedPackage.price.toLocaleString('en-IN')} for ${packageNights} nights${seasonalPackage ? '; includes 10% seasonal increase for arrival from 6 December 2026' : ''}`
    }
    if (kind === 'hotel' || kind === 'package' && !customPackage) fields.priceInclusions = hotelPackagePriceInclusions
    if (kind === 'hotel') {
      fields.roomCount = String(roomQuantity)
      if (!stayPrice) { setSubmitError('Choose valid hotel dates and room quantities to calculate your stay.'); return }
      fields.hotelNightlyTotal = `${hotelRateRange(Math.round(stayPrice.minNightly * roomQuantity * 100) / 100, Math.round(stayPrice.maxNightly * roomQuantity * 100) / 100)} for ${roomQuantity} rooms per night`
      fields.hotelStayEstimate = `₹${stayPrice.total.toLocaleString('en-IN')} for ${roomQuantity} rooms over ${nights} nights; subject to availability and final confirmation`
      fields.hotelPriceBreakdown = priceBreakdown
      fields.mealCoverage = includedMeals.breakfast || includedMeals.dinner ? `Selected meals cover ${hotelRoomOccupancy(room?.roomType)} people per room per day; ${roomQuantity} rooms cover ${hotelRoomOccupancy(room?.roomType) * roomQuantity} people.` : 'No meals selected.'
    }
    if (kind === 'hotel' && room) fields.roomType = room.roomType
    const payload: BookingPayload = { kind, fields: { ...additionalFields, ...fields, ...(plannerDates ? { customDetails: formatEnquiryDetails(additionalFields) } : {}), ...(kind === 'package' ? { arrivalDate: checkInDate, departureDate: checkOutDate, tripDays: String(nights + 1), tripNights: String(nights) } : {}), ...(kind === 'car' ? { rentalDays: String(rentalDays) } : {}), ...(kind === 'hotel' ? { stayDuration, breakfast: includedMeals.breakfast ? 'Included' : 'Not included', dinner: includedMeals.dinner ? 'Included' : 'Not included', nightlyRate: `${nightlyRange} ${hotelRoomRateBasis(room?.roomType)}; breakfast ${includedMeals.breakfast ? 'included' : 'excluded'}, dinner ${includedMeals.dinner ? 'included' : 'excluded'}` } : {}) } }
    const fingerprint = JSON.stringify(payload)
    if (pendingRequest.current?.fingerprint !== fingerprint) pendingRequest.current = { fingerprint, request: prepareRequest(payload) }
    const request = pendingRequest.current.request
    inFlight.current = true
    setSubmitting(true)
    onSubmittingChange?.(true)
    setSubmitError('')
    try {
      const savedRequest = await saveEnquiry(payload, request, website)
      onPrepared(savedRequest)
    } catch (error) {
      setSubmitError(error instanceof Error && error.name !== 'TimeoutError' && error.name !== 'TypeError' ? error.message : 'We could not confirm your enquiry was saved. Please try again or contact us on WhatsApp.')
    } finally {
      inFlight.current = false
      setSubmitting(false)
      onSubmittingChange?.(false)
    }
  }

  return <form onSubmit={submit} className="enquiry-form" aria-busy={submitting}>
    {submitting && <SubmissionProgress title="Saving your enquiry">Please keep this page open while we save your enquiry. This does not confirm a booking.</SubmissionProgress>}
    {children}
    <label className="enquiry-honeypot" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
    <div className="form-grid">
      <label>Name<input name="fullName" type="text" autoComplete="name" autoCapitalize="words" required maxLength={100} placeholder="Your full name" /></label>
      <label>Phone number<input name="phoneNumber" type="tel" autoComplete="tel" inputMode="tel" required pattern={'[+0-9\\s\\(\\)\\-]{7,25}'} onBlur={(event) => { const phone = indianPhoneNumber(event.currentTarget.value); if (phone) event.currentTarget.value = phone }} title="Enter your 10-digit Indian phone number. The 91 or +91 prefix is optional." placeholder="10-digit phone number" /></label>
    </div>
    {!plannerDates && (kind === 'car' || kind === 'package') && <>
      <div className="form-grid trip-dates enquiry-date-fields">
        {fixedPackage ? <DateCalendarInput label="Start date" name="arrivalDate" value={checkInDate} onChange={setCheckInDate} defaultOpen helpText="Select your package start date. The end date is calculated from the included nights." /> : <label>Start date<DateInput name={kind === 'package' ? 'arrivalDate' : 'startDate'} value={checkInDate} onChange={(event) => setCheckInDate(event.target.value)} required /></label>}
        {!fixedPackage && <label>End date<DateInput name={kind === 'package' ? 'departureDate' : 'endDate'} value={checkOutDate} min={kind === 'package' ? earliestCheckout : checkInDate || undefined} onChange={(event) => setCheckOutDate(event.target.value)} required /></label>}
      </div>
      <p className="privacy-note" role="status">{kind === 'package' ? stayDuration ? <strong>{stayDuration}</strong> : checkInDate && checkOutDate ? 'End date must be after the start date.' : null : rentalDays ? <strong>{rentalDays} {rentalDays === 1 ? 'day' : 'days'}</strong> : checkInDate && checkOutDate ? 'End date must be on or after the start date.' : null}</p>
      {fixedPackage && checkOutDate && <p className="privacy-note package-end-date">End date: {new Date(`${checkOutDate}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })} (calculated from {packageNights} included nights).</p>}
    </>}
    {(kind === 'package' || kind === 'car') && <label className="arrival-window-checkbox full-field"><input type="checkbox" name="arrivalBetween6PmAnd7Am" value="Yes" />Will you be arriving between 6:00 PM and 7:00 AM?</label>}
    {(kind === 'package' || kind === 'contact') && (customPackage
      ? <input type="hidden" name="packagePreference" value="Custom package" />
      : <label className="full-field">Package preference<select name="packagePreference" value={packagePreference} onChange={(event) => setPackagePreference(event.target.value)} required>
        {tourPackages.filter((item) => !item.underDevelopment).map((item) => <option key={item.id} value={item.name}>{item.name} - {item.duration}</option>)}
      </select></label>)}
    {kind === 'package' && !customPackage && <PricingNotice />}
    {kind === 'package' && !customPackage && selectedPackage && <div className="privacy-note full-field package-price-summary">
      <RegularPrice price={selectedPackage.price} originalPrice={selectedPackage.originalPrice} />
      <p>Package rate: ₹{selectedPackage.price.toLocaleString('en-IN')} per person for {packageNights} nights.</p>
      <p>{packageSeasonNotice}</p>
      {selectedPackagePrice !== undefined && <p className="package-stay-estimate" role="status"><strong>Selected dates: ₹{selectedPackagePrice.toLocaleString('en-IN')} per person for {nights} {nights === 1 ? 'night' : 'nights'}.</strong> Includes the package's {packageNights} nights.{seasonalPackage && ' Includes 10% seasonal increase based on your arrival date.'} Itinerary changes are subject to availability and final confirmation.</p>}
      <p>{hotelPackagePriceInclusions}.</p>
    </div>}
    {kind === 'hotel' && (lockedHotel
      ? <div className="full-field selected-hotel-field"><span>Selected hotel</span><strong>{lockedHotel.name}</strong>{lockedHotel.exactLocation && <span>{hotelLocationLabel(lockedHotel)}</span>}<input type="hidden" name="preferredStay" value={hotelSelectionValue(lockedHotel)} /></div>
      : <label className="full-field">Preferred stay<select name="preferredStay" value={preferredStay} disabled={!availableHotels.length} required onChange={(event) => { setPreferredStay(event.target.value); setHotelMeals({ breakfast: false, dinner: false }); setRooms(undefined) }}>{!preferredStay && <option value="">No approved hotels available</option>}{selectedItem && !selectedHotel && <option value={selectedItem}>{selectedItem}</option>}{availableHotels.map((hotel) => <option key={hotel.id} value={hotelSelectionValue(hotel)}>{hotel.name} - {hotelLocationLabel(hotel)} - {hotelCategoryLabel(hotel.category.replace(/ package$/i, ''))}</option>)}</select></label>)}
    {plannerDates ? <p className="privacy-note">Your dates, guests, places, vehicle and hotel choices are included in this enquiry. Use Back to change your plan.</p> : <fieldset className="guest-fields"><legend>{kind === 'car' ? 'Who will travel?' : 'Who will stay?'}</legend>
      <div className="form-grid">
        <label>Adults<input name="adults" type="number" min="1" max="100" value={adults} onChange={(event) => { setAdults(event.target.value); setRooms(undefined) }} required /></label>
        <label>Children (5 years+)<input name="children" type="number" min="0" max="100" value={childCount} onChange={(event) => { setChildCount(event.target.value); setRooms(undefined) }} required /></label>
      </div>
      <p className="privacy-note">Children below 5 years are complimentary.</p>
      {(kind === 'package' || kind === 'contact') && <label className="full-field">Travelling as<select name="travelGroup" defaultValue="Couple"><option>Couple</option><option>Family</option><option>Friends</option><option>Solo traveller</option><option>Group</option></select></label>}
    </fieldset>}
    {kind === 'hotel' ? <>
      <div className="form-grid trip-dates enquiry-date-fields">
        <HotelDateInput label="Check-in date" name="checkInDate" value={checkInDate} onChange={setCheckInDate} roomRate={selectedRoomRate} />
        <HotelDateInput label="Check-out date" name="checkOutDate" value={checkOutDate} min={earliestCheckout} onChange={setCheckOutDate} checkout />
      </div>
      <p className="privacy-note" role="status">{stayDuration ? <strong>{stayDuration}</strong> : checkInDate && checkOutDate ? 'Check-out must be after check-in.' : null}</p>
      {registered.loading && <p role="status">Loading registered hotels...</p>}
      {registered.error && <p className="enquiry-error" role="alert">{registered.error} <button type="button" className="text-link" onClick={registered.reload}>Retry loading hotels</button></p>}
      {!selectedHotel && !registered.loading && !registered.error && <p className="enquiry-error" role="alert">This selected hotel is no longer available. Choose another hotel.</p>}
      {selectedHotel && <><div className="selected-hotel-features"><h3>Amenities</h3><div className="hotel-feature-chips">{selectedHotel.facilities.map((facility) => <HotelFeature key={facility} label={facility} />)}</div><h3>Highlights</h3><div className="hotel-feature-chips">{selectedHotel.highlights.map((highlight) => <HotelFeature key={highlight} label={highlight} />)}</div></div><HotelRates key={selectedHotel.id} hotel={selectedHotel} date={checkInDate || undefined} showRooms people={people} rooms={rooms} onRoomsChange={setRooms} roomType={room?.roomType} onChange={(breakfast, dinner, _price, roomType) => { setHotelMeals({ breakfast, dinner }); if (room?.roomType !== roomType) setRooms(undefined); setRoomSelection({ hotelId: selectedHotel.id, roomType: roomType ?? '' }) }} />{stayPrice && <div className="hotel-price-breakdown" role="status"><p className="privacy-note hotel-stay-estimate">Stay estimate: ₹{stayPrice.total.toLocaleString('en-IN')} for {roomQuantity} rooms over {nights} nights. Subject to availability and final confirmation.</p><p>{priceBreakdown}</p><p>{nightlyRange} per room/night including selected meals. {hotelPackagePriceInclusions}.</p></div>}</>}
    </> : !plannerDates && <label className="full-field">{kind === 'car' ? 'Preferred vehicle' : 'Car rental'}<select name="carRental" value={preferredCar} onChange={(event) => setPreferredCar(event.target.value)}>
      {rentalCars.map((car) => <option key={car.id} value={car.name}>{car.name} - {car.seats} seats</option>)}
      <option>No car needed</option>
    </select></label>}
    {customPackage && !plannerDates && <label className="full-field">Custom trip details<textarea name="customDetails" rows={4} maxLength={20000} defaultValue={formatEnquiryDetails(additionalFields)} /></label>}
    {kind === 'hotel' && selectedHotel && <p className="privacy-note price-inclusions">{hotelPackagePriceInclusions}.</p>}
    {submitError && <p className="enquiry-error" role="alert">{submitError}</p>}
    <button className="button button-dark enquiry-submit" type="submit" disabled={submitDisabled || submitting || (kind === 'hotel' && !selectedHotel)}>{submitting ? 'Saving enquiry...' : 'Submit enquiry'} <ArrowRight size={17} /></button>
    <p className="privacy-note" aria-live="polite">{submitting ? 'Saving your enquiry. Please wait.' : 'By submitting, you agree that AVELOF may store these details, show your selected service and dates with masked contact details in booking lookup, and contact you about your enquiry. This is not a confirmed booking.'}</p>
    <div className="enquiry-help-links">
      <a className="text-link enquiry-help" href={createWhatsAppUrl('Hello AVELOF, I need help with an enquiry.')} target="_blank" rel="noreferrer"><MessageCircle size={17} /> Need help?</a>
      <a className="text-link enquiry-help" href="/#custom-trip">Customize your trip <ArrowRight size={16} /></a>
      {lockedHotel && <a className="text-link enquiry-help" href="/hotels">View other options <ArrowRight size={16} /></a>}
    </div>
  </form>
}

export default function BookingModal({ kind, selectedItem, initialRequest, onClose }: BookingModalProps) {
  const dialogRef = useRef<HTMLElement>(null)
  const [request, setRequest] = useState<PreparedRequest | null>(initialRequest ?? null)
  const [copyStatus, setCopyStatus] = useState<'copied' | 'failed' | ''>('')

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const alreadyLocked = document.body.classList.contains('enquiry-open')
    document.body.classList.add('enquiry-open')
    if (!dialogRef.current?.contains(document.activeElement)) dialogRef.current?.focus()
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
      if (!alreadyLocked) document.body.classList.remove('enquiry-open')
      document.removeEventListener('keydown', handleKey)
      previousFocus?.focus()
    }
  }, [onClose])

  function prepared(nextRequest: PreparedRequest) {
    setRequest(nextRequest)
    dialogRef.current?.scrollTo({ top: 0 })
    dialogRef.current?.focus()
  }

  async function copyReference() {
    if (!request) return
    try {
      await navigator.clipboard.writeText(request.reference)
      setCopyStatus('copied')
    } catch {
      setCopyStatus('failed')
    }
  }

  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section ref={dialogRef} tabIndex={-1} className={`booking-modal${request ? ' confirmation-modal' : ''}`} role="dialog" aria-modal="true" aria-labelledby="booking-title" aria-describedby="booking-description">
      <button className="modal-close icon-button" onClick={onClose} aria-label="Close enquiry"><X /></button>
      {request ? <>
        <span className="success-mark"><CircleCheck size={24} /></span>
        <p className="eyebrow">Details submitted successfully</p>
        <h2 id="booking-title">Thank you for submitting your details.</h2>
        <p id="booking-description">Your enquiry has been saved. We'll get in touch with you soon to discuss availability and the next steps.</p>
        <div className="confirmation-reference">
          <span>Booking enquiry ID</span>
          <div className="confirmation-reference-value">
            <strong>{request.reference}</strong>
            <button className="icon-button confirmation-copy" onClick={copyReference} aria-label="Copy booking enquiry ID" title={copyStatus === 'copied' ? 'Copied' : 'Copy booking enquiry ID'}>{copyStatus === 'copied' ? <Check size={18} /> : <Copy size={18} />}</button>
          </div>
          <p className="privacy-note" role="status" aria-live="polite">{copyStatus === 'copied' ? 'Copied. Keep this ID for future reference.' : copyStatus === 'failed' ? 'Could not copy. Select the ID and copy it for future reference.' : 'Copy this ID and keep it for future reference.'}</p>
        </div>
        <a className="text-link" href={enquiryPath(request)}>View your bookings <ArrowRight size={16} /></a>
        <p className="privacy-note">This acknowledges your enquiry, not a confirmed booking.</p>
        <div className="modal-actions confirmation-actions">
          <a className="button button-dark" href={createWhatsAppUrl(`Hello AVELOF, I need help with enquiry ${request.reference}.`)} target="_blank" rel="noreferrer"><MessageCircle size={17} /> Need help?</a>
          <button className="button confirmation-close" onClick={onClose}><X size={17} /> No Thanks</button>
        </div>
      </> : <>
        <p className="eyebrow">Book Now</p>
        <h2 id="booking-title">{kind === 'hotel' ? 'Send us your hotel enquiry.' : kind === 'car' ? 'Send us your car rental enquiry.' : 'Send us your trip enquiry.'}</h2>
        <p id="booking-description" className="modal-intro">Share a few details and we’ll help plan the next steps.</p>
        <EnquiryForm kind={kind} selectedItem={selectedItem} onPrepared={prepared}>
        </EnquiryForm>
      </>}
    </section>
  </div>
}