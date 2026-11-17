import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowLeft, ArrowRight, Check, Flame, MapPin, MoonStar, Mountain, ShieldCheck, TriangleAlert, Trees, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import DestinationPhotos from '../components/DestinationPhotos'
import CallAssistance from '../components/CallAssistance'
import LocalTripCarousel from '../components/LocalTripCarousel'
import TripPlannerSteps from '../components/TripPlannerSteps'
import HotelRates from '../components/HotelRates'
import DateInput from '../components/DateInput'
import { rentalCars } from '../data/catalog'
import { localTreks, localTrekPhotos, localTripPreferences, picnicPlaces } from '../data/localTrips'
import { providedDestinationPhotos } from '../data/previewPhotos'
import { enquiryPath, prepareRequest, saveEnquiry } from '../services/bookingService'
import { indianPhoneNumber } from '../services/phoneNumbers'
import { hotelSelectionValue, hotelsInLocation, useRegisteredHotels } from '../services/hotelService'
import type { BookingPayload, PreparedRequest } from '../types'

function today() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function nextDay(value: string) {
  if (!value) return ''
  const date = new Date(`${value}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
}

export default function LocalTripsPage() {
  const [step, setStep] = useState(0)
  const [details, setDetails] = useState({ fullName: '', phoneNumber: '', pickup: '', drop: '', arrivalDate: '', adults: '2' })
  const [car, setCar] = useState('')
  const [kind, setKind] = useState<'trek' | 'picnic'>('picnic')
  const [trekId, setTrekId] = useState('')
  const [placeId, setPlaceId] = useState('')
  const [attractions, setAttractions] = useState<string[]>([])
  const [campfire, setCampfire] = useState(false)
  const [overnight, setOvernight] = useState(false)
  const [hotelId, setHotelId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [receipt, setReceipt] = useState<PreparedRequest | null>(null)
  const inFlight = useRef(false)
  const pending = useRef<{ fingerprint: string; request: PreparedRequest } | null>(null)
  const stepHeading = useRef<HTMLHeadingElement>(null)
  const place = picnicPlaces.find((item) => item.id === placeId)
  const trek = localTreks.find((item) => item.id === trekId)
  const wantsStay = kind === 'picnic' && overnight
  const registered = useRegisteredHotels(wantsStay)
  const placeHotels = place ? hotelsInLocation(registered.hotels, [place.name, ...place.aliases]) : []
  const selectedHotel = placeHotels.find((hotel) => hotel.id === hotelId)
  const checkout = wantsStay ? nextDay(details.arrivalDate) : ''
  const vehicleStep = wantsStay ? 3 : 2

  function chooseKind(next: 'trek' | 'picnic') {
    setKind(next)
    setError('')
  }

  function startEnquiry(next: 'trek' | 'picnic') {
    chooseKind(next)
    setStep(0)
    if (receipt) {
      setReceipt(null)
      pending.current = null
    }
  }

  function changeStep(next: number) {
    setStep(next)
    setError('')
    requestAnimationFrame(() => {
      stepHeading.current?.focus()
      stepHeading.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    })
  }

  function detailsError() {
    if (!details.fullName.trim()) return 'Enter your name.'
    if (!indianPhoneNumber(details.phoneNumber)) return 'Enter a valid 10-digit Indian phone number.'
    if (!details.pickup.trim() || !details.drop.trim()) return 'Enter your pickup and drop locations.'
    const guests = Number(details.adults)
    if (!Number.isInteger(guests) || guests < 1 || guests > 100) return 'Enter a group size from 1 to 100.'
    if (!details.arrivalDate || details.arrivalDate < today()) return 'Choose today or a future date.'
    return ''
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current) return
    setError('')
    const invalidDetails = detailsError()
    if (invalidDetails) { changeStep(0); setError(invalidDetails); return }
    if (step === 0) { changeStep(1); return }
    if (kind === 'trek' && !trek || kind === 'picnic' && !place) { changeStep(1); setError('Choose a trek or picnic destination.'); return }
    if (step === 1) { changeStep(2); return }
    if (wantsStay && hotelId !== 'help' && !selectedHotel) { changeStep(2); setError('Choose a hotel or ask AVELOF to help find a stay.'); return }
    if (wantsStay && step === 2) { changeStep(3); return }
    const form = new FormData(event.currentTarget)
    const phone = indianPhoneNumber(details.phoneNumber)
    if (!phone) { setError('Enter a valid 10-digit Indian phone number.'); return }
    if (car !== 'No car needed' && !rentalCars.some((vehicle) => vehicle.name === car)) { setError('Choose a vehicle.'); return }
    const destination = kind === 'trek' ? `${trek!.name} (${trek!.region})` : place!.name
    const selected = kind === 'picnic' ? attractions : []
    const notes = [
      `Local trip: ${destination}`,
      `Pickup location: ${details.pickup.trim()}`,
      `Drop location: ${details.drop.trim()}`,
      ...(selected.length ? [`Places of interest requested: ${selected.join(', ')}`] : []),
      ...(kind === 'picnic' ? [`Campfire requested: ${campfire ? 'Yes, subject to permission and conditions' : 'No'}`] : []),
      ...(wantsStay ? [`One-night stay requested in ${place!.name}: ${details.arrivalDate} to ${checkout}`, `Preferred hotel: ${selectedHotel ? hotelSelectionValue(selectedHotel) : 'Ask AVELOF to help find a stay'}`] : []),
    ].join('\n')
    const payload: BookingPayload = { kind: 'contact', fields: {
      fullName: details.fullName.trim(), phoneNumber: phone, adults: String(Number(details.adults)), children: '0',
      packagePreference: kind === 'trek' ? localTripPreferences[0] : localTripPreferences[1],
      arrivalDate: details.arrivalDate, carRental: car, selectedDestinations: destination, selectedActivities: selected.join(', '), customDetails: notes,
      ...(wantsStay ? { departureDate: checkout, checkInDate: details.arrivalDate, checkOutDate: checkout, tripNights: '1', preferredStay: selectedHotel ? hotelSelectionValue(selectedHotel) : `Help find a stay in ${place!.name}` } : {}),
    } }
    const fingerprint = JSON.stringify(payload)
    if (pending.current?.fingerprint !== fingerprint) pending.current = { fingerprint, request: prepareRequest(payload) }
    inFlight.current = true
    setBusy(true)
    try { setReceipt(await saveEnquiry(payload, pending.current.request, String(form.get('website') ?? ''))) }
    catch (failure) { setError(failure instanceof Error && failure.name !== 'TimeoutError' && failure.name !== 'TypeError' ? failure.message : 'We could not confirm your enquiry was saved. Please try again with the same details.') }
    finally { inFlight.current = false; setBusy(false) }
  }

  return <>
    {busy && <SubmissionProgress title="Saving your enquiry">Please keep this page open while we save your local trip enquiry.</SubmissionProgress>}
    {receipt && <SubmissionSuccess title="Enquiry saved"><p>Enquiry ID: <strong>{receipt.reference}</strong></p><p>We will get in touch to discuss the details. This is not a confirmed booking.</p></SubmissionSuccess>}
    <section className="local-trips-hero" style={{ backgroundImage: `linear-gradient(90deg, rgba(15, 42, 30, .88), rgba(15, 42, 30, .35)), url("${providedDestinationPhotos.yusmarg}")` }}>
      <div className="page-width">
        <div className="breadcrumb"><Link to="/">Home</Link><span>/</span><span>Local Trips</span></div>
        <p className="eyebrow">Born in Kashmir, built for Kashmir</p>
        <h1>Our home. Your next adventure.</h1>
        <p>Made for local families and friends who want to experience more of Kashmir, together.</p>
      </div>
    </section>
    <div className="section page-width local-trips-content">
      <CallAssistance />
      <div className="local-discovery-tiles">
      <section id="local-picnics" className="local-discovery-section" aria-labelledby="local-picnics-title">
        <div className="local-discovery-heading"><p className="eyebrow">A day close to home</p><h2 id="local-picnics-title">Picnics & day trips</h2>
        <p>Swipe through the places and choose one for your day out.</p>
        <ul className="local-trip-points local-icon-points"><li><MapPin size={17} aria-hidden="true" /><span>Choose one destination and the sights you’d like to explore.</span></li><li><Users size={17} aria-hidden="true" /><span>Tell us your group size, transport needs and whether you’d like a one-night stay.</span></li><li><ShieldCheck size={17} aria-hidden="true" /><span>Our team will check access, availability and the price with you.</span></li></ul>
        </div>
        <div className="local-discovery-tile">
        <LocalTripCarousel label="Places">{picnicPlaces.map((item) => <article className="local-trip-card local-discovery-card" key={item.id}>
          <DestinationPhotos places={[item]} />
          <div className="local-discovery-copy"><p className="eyebrow">{item.count}</p><h3>{item.name}</h3><p>{item.detail}</p>
            <ul className="local-trip-points local-icon-points">{item.attractions.slice(0, 3).map((attraction) => <li key={attraction.name}><MapPin size={17} aria-hidden="true" /><span>{attraction.name}</span></li>)}</ul>
            <a className="button button-dark" href="#local-enquiry" onClick={() => { startEnquiry('picnic'); if (placeId !== item.id) { setAttractions([]); setHotelId('') } setPlaceId(item.id) }}>Plan a day trip <ArrowRight size={16} aria-hidden="true" /></a>
          </div>
        </article>)}</LocalTripCarousel>
        </div>
      </section>
      <section id="local-treks" className="local-discovery-section" aria-labelledby="local-treks-title">
        <div className="local-discovery-heading"><h2 id="local-treks-title">Treks</h2>
        <p>Swipe through the treks and choose one for your adventure.</p>
        <ul className="local-trip-points local-icon-points"><li><Mountain size={17} aria-hidden="true" /><span>Trek ideas, not confirmed departures.</span></li><li><Users size={17} aria-hidden="true" /><span>Multi-day and high-altitude routes need suitable fitness, acclimatisation, qualified guides and a planned itinerary.</span></li><li><ShieldCheck size={17} aria-hidden="true" /><span>Weather, access, permits and safety must be checked before travel.</span></li></ul>
        </div>
        <div className="local-discovery-tile">
        <LocalTripCarousel label="Treks">{localTreks.map((item) => <article className="local-trip-card local-discovery-card" key={item.id}>
          <img className="local-discovery-photo" src={localTrekPhotos[item.id].image} alt={localTrekPhotos[item.id].alt} loading="lazy" />
          <div className="local-discovery-copy"><p className="eyebrow">{item.region}</p><h3>{item.name}</h3><p>{item.description}</p>
            <ul className="local-trip-points local-icon-points">{item.highlights.map((highlight) => <li key={highlight}><Check size={17} aria-hidden="true" /><span>{highlight}</span></li>)}</ul>
            <a className="button button-dark" href="#local-enquiry" onClick={() => { startEnquiry('trek'); setTrekId(item.id) }}>Plan a trek <ArrowRight size={16} aria-hidden="true" /></a>
          </div>
        </article>)}</LocalTripCarousel>
        </div>
      </section>
      </div>
      <section id="local-enquiry" className="local-trips-notice" aria-labelledby="local-enquiry-title">
        <div className="local-enquiry-content"><p className="eyebrow">Plan your day or adventure</p><h2 id="local-enquiry-title">Send a local trip enquiry</h2><p>Share your preferences. We’ll check the details and get back to you.</p>
          <aside className="local-launch-notice" aria-label="Local Trips launch notice"><TriangleAlert size={18} aria-hidden="true" /><div><strong>Launching soon</strong><p>Enquiries open. Confirmed bookings not yet available.</p></div></aside>
          {receipt ? <div role="status" className="review-ready"><h3>Your enquiry has been saved.</h3><p>Enquiry ID: <strong>{receipt.reference}</strong></p><p>We’ll get in touch to discuss the details. This is not a confirmed booking.</p><Link className="text-link" to={enquiryPath(receipt)}>View your enquiry <ArrowRight size={16} /></Link><button className="button button-outline" type="button" onClick={() => { setReceipt(null); pending.current = null; changeStep(0) }}>Start another enquiry</button></div> :
          <form className="enquiry-form local-enquiry-form" onSubmit={(event) => void submit(event)} aria-busy={busy}>
            <TripPlannerSteps step={step} onStepChange={changeStep} disabled={busy} labels={wantsStay ? ['Your details', 'Places', 'Hotels', 'Vehicle'] : ['Your details', 'Places', 'Vehicle']} />
            <h3 ref={stepHeading} tabIndex={-1} className="local-step-heading">{step === 0 ? 'Trip type & your details' : step === 1 ? kind === 'trek' ? 'Choose one trek' : 'Choose one picnic destination' : wantsStay && step === 2 ? 'Choose your one-night stay' : 'Choose your vehicle'}</h3>
            <fieldset disabled={busy} className="local-enquiry-fields">
              {step === 0 && <>
                <fieldset className="local-type-picker"><legend>Trip type</legend><div className="local-type-grid">
                  <label className={`planner-place-card${kind === 'picnic' ? ' is-selected' : ''}`}><input type="radio" name="tripType" checked={kind === 'picnic'} onChange={() => chooseKind('picnic')} /><Trees size={24} aria-hidden="true" /><strong>Picnic / day trip</strong></label>
                  <label className={`planner-place-card${kind === 'trek' ? ' is-selected' : ''}`}><input type="radio" name="tripType" checked={kind === 'trek'} onChange={() => chooseKind('trek')} /><Mountain size={24} aria-hidden="true" /><strong>Trek</strong></label>
                </div></fieldset>
                {kind === 'picnic' && <label className="local-campfire"><input type="checkbox" aria-labelledby="local-overnight-label" aria-describedby="local-overnight-help" checked={overnight} onChange={(event) => { setOvernight(event.target.checked); if (!event.target.checked) setHotelId('') }} /><span><MoonStar size={16} aria-hidden="true" /> <span id="local-overnight-label">Stay overnight for one night</span><small id="local-overnight-help">Check in on your trip date and check out the next day. Hotel availability and rooms will be confirmed by AVELOF.</small></span></label>}
                <div className="form-grid"><label>Name<input name="fullName" autoComplete="name" maxLength={100} required value={details.fullName} onChange={(event) => setDetails({ ...details, fullName: event.target.value })} /></label><label>Phone number<input name="phoneNumber" type="tel" autoComplete="tel" maxLength={25} required value={details.phoneNumber} onChange={(event) => setDetails({ ...details, phoneNumber: event.target.value })} /></label></div>
                <div className="form-grid"><label>Your area / pickup location<input name="pickup" maxLength={200} required placeholder="Enter your area or pickup point" value={details.pickup} onChange={(event) => setDetails({ ...details, pickup: event.target.value })} /></label><label>Drop location<input name="drop" maxLength={200} required placeholder="Where should we drop you after the trip?" value={details.drop} onChange={(event) => setDetails({ ...details, drop: event.target.value })} /></label></div>
                <div className="form-grid"><label>Group size<input type="number" name="adults" min="1" max="100" required value={details.adults} onChange={(event) => setDetails({ ...details, adults: event.target.value })} /></label><label>Preferred date<DateInput name="arrivalDate" min={today()} required value={details.arrivalDate} onChange={(event) => setDetails({ ...details, arrivalDate: event.target.value })} /></label></div>
                {wantsStay && checkout && <p className="privacy-note">One night · Check-in: {details.arrivalDate} · Check-out: {checkout}</p>}
              </>}
              {step === 1 && <>
                <fieldset className="planner-destination-picker"><legend>{kind === 'trek' ? 'Choose a trek' : 'Choose a place'}</legend>
                  <p className="planner-place-summary">Select one {kind === 'trek' ? 'trek' : 'destination'} for this enquiry.</p>
                  <div className="planner-destination-grid">{kind === 'trek' ? localTreks.map((item) => <article className={`planner-place-card${trekId === item.id ? ' is-selected' : ''}`} key={item.id}>
                    <label><input type="radio" name="trek" required checked={trekId === item.id} onChange={() => setTrekId(item.id)} /><Mountain size={24} aria-hidden="true" /><strong>{item.name}</strong><span>{item.region}</span><span>{item.description}</span></label>
                  </article>) : picnicPlaces.map((item) => <article className={`planner-place-card${placeId === item.id ? ' is-selected' : ''}`} key={item.id}>
                    <DestinationPhotos places={[item]} />
                    <label><input type="radio" name="place" required checked={placeId === item.id} onChange={() => { setPlaceId(item.id); setAttractions([]); setHotelId('') }} /><strong>{item.name}</strong><span>{item.count}</span></label>
                  </article>)}</div>
                </fieldset>
                {kind === 'picnic' && <>
                {place && <fieldset className="local-attractions"><legend>What would you like to explore? <span>(optional)</span></legend>{place.attractions.map((item) => <label key={item.name}><input type="checkbox" checked={attractions.includes(item.name)} onChange={(event) => { const checked = event.target.checked; setAttractions((current) => checked ? [...current, item.name] : current.filter((name) => name !== item.name)) }} /><span><strong>{item.name}</strong><small>{item.detail}</small></span></label>)}</fieldset>}
                <label className="local-campfire"><input type="checkbox" checked={campfire} onChange={(event) => setCampfire(event.target.checked)} /><span><Flame size={16} aria-hidden="true" /> Request a campfire <small>Only where legally permitted and safe; availability is not guaranteed.</small></span></label>
                </>}
              </>}
              {wantsStay && step === 2 && <>
                <p className="privacy-note">One night in {place?.name} · Check-in: {details.arrivalDate} · Check-out: {checkout}. These are listed hotels, not date-specific availability. Room types, meals, group capacity and the final price need confirmation.</p>
                {registered.loading ? <p role="status">Loading AVELOF hotels...</p> : registered.error ? <div role="alert"><p className="enquiry-error">{registered.error}</p><button className="button button-outline" type="button" onClick={registered.reload}>Retry loading hotels</button></div> : placeHotels.length === 0 ? <p>No AVELOF hotels are currently listed in {place?.name}. You can ask our team to help find a stay.</p> : null}
                <fieldset className="local-hotel-picker"><legend>Preferred hotel in {place?.name}</legend><div className="planner-destination-grid">
                  {placeHotels.map((hotel) => <article className={`planner-hotel-card${hotelId === hotel.id ? ' is-selected' : ''}`} key={hotel.id}>
                    <label className="local-hotel-choice"><input type="radio" name="localHotel" required checked={hotelId === hotel.id} onChange={() => setHotelId(hotel.id)} /><img src={hotel.image} alt={`${hotel.name}, hotel photo`} loading="lazy" /><strong>{hotel.name}</strong><span>{hotelCategoryLabel(hotel.category)} · {hotelLocationLabel(hotel)}</span></label>
                    <HotelRates hotel={hotel} date={details.arrivalDate || undefined} compact />
                  </article>)}
                  <article className={`planner-hotel-card${hotelId === 'help' ? ' is-selected' : ''}`}><label className="local-hotel-choice"><input type="radio" name="localHotel" required checked={hotelId === 'help'} onChange={() => setHotelId('help')} /><strong>Help me find a stay</strong><span>Ask AVELOF to suggest a hotel in {place?.name}. Availability and price are not confirmed.</span></label></article>
                </div></fieldset>
              </>}
              {step === vehicleStep && <>
                <fieldset className="planner-vehicle-picker"><legend>Preferred vehicle</legend><div className="planner-vehicle-grid">
                  {rentalCars.map((vehicle) => <div className={`planner-vehicle-choice${car === vehicle.name ? ' is-selected' : ''}`} key={vehicle.id}>
                    <label><input type="radio" name="carRental" required checked={car === vehicle.name} onChange={() => setCar(vehicle.name)} /><img src={vehicle.image} alt="" loading="lazy" /><strong>{vehicle.name}</strong><span>Up to {vehicle.seats} seats</span><span>Fare on enquiry</span></label>
                  </div>)}
                  <div className={`planner-vehicle-choice${car === 'No car needed' ? ' is-selected' : ''}`}><label><input type="radio" name="carRental" required checked={car === 'No car needed'} onChange={() => setCar('No car needed')} /><strong>No car needed</strong><span>I will arrange my own transport</span></label></div>
                </div></fieldset>
                <p className="privacy-note">Vehicle availability, suitability for your group, local taxi rules and fares must be confirmed. Additional local transfers or attraction fees may apply.</p>
                <section className="planner-activity-summary" aria-label="Your local trip"><h4>Your local trip</h4><p>{kind === 'trek' ? trek?.name : place?.name} · {details.adults} people · {details.arrivalDate}</p><p>Pickup: {details.pickup} · Drop: {details.drop}</p>{kind === 'picnic' && attractions.length > 0 && <p>Explore: {attractions.join(', ')}</p>}</section>
                {wantsStay && <p className="privacy-note">One night · {details.arrivalDate} to {checkout} · {selectedHotel?.name ?? 'Help me find a stay'}. Hotel stay requested, not confirmed.</p>}
              </>}
              <label className="enquiry-honeypot" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
              {error && <p className="enquiry-error" role="alert">{error}</p>}
              <div className="local-enquiry-actions">{step > 0 && <button className="button button-outline" type="button" onClick={() => changeStep(step - 1)}><ArrowLeft size={16} /> Back</button>}<button className="button button-dark" type="submit">{busy ? 'Saving enquiry...' : step === 0 ? 'Next: places' : step === 1 && wantsStay ? 'Next: hotels' : step < vehicleStep ? 'Next: vehicle' : 'Send enquiry'} <ArrowRight size={16} /></button></div>
              <p className="privacy-note">Your contact details are used to respond to this enquiry and are not published.</p>
            </fieldset>
          </form>}
        </div>
      </section>
    </div>
  </>
}
import SubmissionProgress, { SubmissionSuccess } from '../components/SubmissionFeedback'
import { hotelCategoryLabel, hotelLocationLabel } from '../data/hotelRegistration'
