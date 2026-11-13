import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, RefreshCw, Trash2 } from 'lucide-react'
import OwnerPushNotifications from '../components/OwnerPushNotifications'
import NumberStepper from '../components/NumberStepper'
import { heatingOptions, hotelAmenities, hotelCategories, hotelCategoryLabels, hotelHighlightOptions, hotelRoomTypes, hotelStatusLabels, hotelTaxOptions, registrationLocations } from '../data/hotelRegistration'
import { hotelPriceSchema, hotelStatusSchema, hotelSubmissionSchema } from '../services/hotelSchema'
import type { AdminHotel, HotelStatus } from '../services/hotelSchema'
import { compressHotelPhotos, deleteHotel, hotelErrorText, HotelError, loadAdminHotels, lookupHotel, moderateHotel, saveHotel } from '../services/hotelService'
import type { HotelReceipt, OwnerHotel } from '../services/hotelService'

function PhotoPreview({ photo, index }: { photo: Blob; index: number }) {
  const imageRef = useRef<HTMLImageElement>(null)
  useEffect(() => {
    const next = URL.createObjectURL(photo)
    if (imageRef.current) imageRef.current.src = next
    return () => URL.revokeObjectURL(next)
  }, [photo])
  return <img ref={imageRef} alt={`Selected hotel photo ${index + 1}`} />
}
export default function HotelRegistrationPage() {
  const [photos, setPhotos] = useState<Blob[]>([])
  const [processing, setProcessing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [photoError, setPhotoError] = useState('')
  const [receipt, setReceipt] = useState<HotelReceipt | null>(null)
  const pending = useRef({ fingerprint: '', id: crypto.randomUUID() })
  const inFlight = useRef(false)
  const photoVersion = useRef(0)

  async function selectPhotos(files: File[]) {
    const version = ++photoVersion.current
    setProcessing(true)
    setPhotoError('')
    setPhotos([])
    try {
      const compressed = await compressHotelPhotos(files)
      if (photoVersion.current === version) setPhotos(compressed)
    } catch (failure) { if (photoVersion.current === version) setPhotoError(hotelErrorText(failure)) }
    finally { if (photoVersion.current === version) setProcessing(false) }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current || processing) return
    setError('')
    if (!photos.length || photoError) { setError('Select at least one valid hotel photo before submitting.'); return }
    const fields = new FormData(event.currentTarget)
    const roomCounts = hotelRoomTypes.map((roomType) => ({
      roomType,
      count: Number(fields.get(`roomCount_${roomType.toLowerCase()}`)),
    })).filter(({ count }) => count > 0)
    const details = {
      name: fields.get('name'), contactName: fields.get('contactName'), phone: fields.get('phone'),
      category: fields.get('category'), location: fields.get('location'),
      description: `${String(fields.get('category'))} accommodation in ${String(fields.get('location'))}.`,
      price: Number(fields.get('price')), mealPlan: 'Room only', taxDetails: fields.get('taxDetails'),
      breakfastPrice: Number(fields.get('breakfastPrice')), dinnerPrice: Number(fields.get('dinnerPrice')),
      heating: fields.get('heating'), amenities: fields.getAll('amenities'),
      highlights: fields.getAll('highlights'),
      roomTypes: roomCounts.map(({ roomType, count }) => `${roomType} (${count} ${count === 1 ? 'room' : 'rooms'})`),
      checkIn: fields.get('checkIn'), checkOut: fields.get('checkOut'), totalRooms: roomCounts.reduce((total, { count }) => total + count, 0),
      publicationConsent: fields.has('publicationConsent'), website: fields.get('website') ?? '',
    }
    const fingerprint = JSON.stringify({ details, photoVersion: photoVersion.current })
    if (pending.current.fingerprint && pending.current.fingerprint !== fingerprint) pending.current.id = crypto.randomUUID()
    pending.current.fingerprint = fingerprint
    const parsed = hotelSubmissionSchema.safeParse({ ...details, id: pending.current.id })
    if (!parsed.success) { setError(parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join(' ')); return }
    inFlight.current = true
    setBusy(true)
    try { setReceipt(await saveHotel(parsed.data, photos)) }
    catch (failure) { setError(hotelErrorText(failure)) }
    finally { inFlight.current = false; setBusy(false) }
  }

  return <section className="enquiry-access-page page-width hotel-registration-page">
    <Link className="text-link" to="/partners"><ArrowLeft size={16} /> Partner with AVELOF</Link>
    <div className="enquiry-access-heading"><div><p className="eyebrow">Partner with AVELOF</p><h1>Register your hotel</h1><p>Submit your property for review. It will appear in Hotels & stays only after AVELOF approval.</p></div></div>
    <p><Link className="text-link" to="/hotel-status">Already registered? Check your hotel status <ArrowRight size={16} /></Link></p>
    {receipt ? <section className="review-ready" role="status">
      <h2>Your hotel registration has been saved.</h2><p>Status: {hotelStatusLabels[receipt.status]}. This is not a confirmed listing or booking.</p>
      <dl className="hotel-receipt"><div><dt>Hotel ID</dt><dd>{receipt.hotelId}</dd></div><div><dt>Status access code</dt><dd>{receipt.accessCode}</dd></div></dl>
      <p>Your status code uses the first four letters of the hotel name and the last four digits of the registered phone number.</p>
      <Link className="button button-dark" to="/hotel-status">Check hotel status <ArrowRight size={16} /></Link>
    </section> : <form className="review-submission-form hotel-registration-form" onSubmit={submit} aria-busy={busy}>
      <fieldset disabled={busy} className="hotel-form-fields">
        <label>Hotel name<input name="name" maxLength={120} required /></label>
        <label>Contact person's name (private)<input name="contactName" maxLength={80} autoComplete="name" required /></label>
        <label>Phone number (private)<input name="phone" type="tel" autoComplete="tel" maxLength={30} required placeholder="10-digit Indian phone number" /><small>One hotel per phone number. You can use this number for private status lookup.</small></label>
        <label>Location<select name="location" required defaultValue=""><option value="" disabled>Select location</option>{registrationLocations.map((location) => <option key={location}>{location}</option>)}</select></label>
        <label>AVELOF category<select name="category" required defaultValue=""><option value="" disabled>Select category</option>{hotelCategories.map((category) => <option key={category} value={category}>{hotelCategoryLabels[category]}</option>)}</select><small>Our accommodation categories are not official star certifications.</small></label>
        <fieldset className="hotel-amenities hotel-room-types review-text-field"><legend>Room types and quantity</legend>{hotelRoomTypes.map((roomType) => <NumberStepper key={roomType} label={`${roomType} rooms`} name={`roomCount_${roomType.toLowerCase()}`} min={0} max={10000} defaultValue={1} />)}<small className="review-text-field">Set a room type to 0 if you do not offer it. The total room count is calculated from these quantities.</small></fieldset>
        <NumberStepper label="Room-only price (INR)" name="price" min={1} defaultValue={2000} step={100} currency />
        <NumberStepper label="Breakfast add-on (INR)" name="breakfastPrice" defaultValue={500} step={50} currency />
        <NumberStepper label="Dinner add-on (INR)" name="dinnerPrice" defaultValue={500} step={50} currency />
        <p className="privacy-note review-text-field">All rates are per room per night for 2 adults. Meals are optional add-ons for both adults. AVELOF may edit these prices before approval.</p>
        <label>Taxes<select name="taxDetails">{hotelTaxOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
        <label>Heating system<select name="heating" defaultValue="" required><option value="" disabled>Select heating system</option>{heatingOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
        <label>Check-in time<input name="checkIn" type="time" required defaultValue="14:00" /></label>
        <label>Check-out time<input name="checkOut" type="time" required defaultValue="11:00" /></label>
        <fieldset className="hotel-amenities hotel-amenity-options review-text-field"><legend>Amenities available</legend>{hotelAmenities.map((amenity) => <label key={amenity}><input type="checkbox" name="amenities" value={amenity} />{amenity}</label>)}</fieldset>
        <fieldset className="hotel-amenities hotel-highlights review-text-field"><legend>Major highlights</legend>{hotelHighlightOptions.map((highlight) => <label key={highlight}><input type="checkbox" name="highlights" value={highlight} />{highlight}</label>)}<small className="review-text-field">Select the points that apply. Selected highlights appear in your approved listing.</small></fieldset>
        <label className="review-text-field">Hotel photos (1-5 required)<input name="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple required onChange={(event) => { void selectPhotos(Array.from(event.target.files ?? [])) }} /><small>JPEG, PNG or WebP; original files up to 5 MB each. Photos retain up to 1920 px and are compressed to at most 1 MB each; original metadata is removed.</small></label>
        {processing && <p role="status">Preparing photos...</p>}
        {photoError && <p className="enquiry-error review-text-field" role="alert">{photoError}</p>}
        <div className="hotel-photo-grid review-text-field">{photos.map((photo, index) => <PhotoPreview key={index} photo={photo} index={index} />)}</div>
        <label className="enquiry-honeypot" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
        <label className="review-consent"><input name="publicationConsent" type="checkbox" required /><span>I am authorised to register this property and publish these photos. I consent to publication of approved hotel details and photos, including AVELOF's reviewed price. My contact name and phone stay private. I will not upload guest faces, identity documents or payment information.</span></label>
        {error && <p className="enquiry-error review-text-field" role="alert">{error}</p>}
        <button className="button button-dark" disabled={processing || !photos.length} type="submit">{busy ? 'Saving registration...' : 'Submit hotel for approval'} <ArrowRight size={16} /></button>
      </fieldset>
    </form>}
  </section>
}

export function HotelStatusPage() {
  const [hotel, setHotel] = useState<OwnerHotel | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current) return
    const fields = new FormData(event.currentTarget)
    setHotel(null); setError(''); setBusy(true); inFlight.current = true
    try { setHotel(await lookupHotel(String(fields.get('identifier')), String(fields.get('accessCode')))) }
    catch (failure) { setError(hotelErrorText(failure)) }
    finally { setBusy(false); inFlight.current = false }
  }
  return <section className="enquiry-access-page page-width">
    <Link className="text-link" to="/register-hotel"><ArrowLeft size={16} /> Hotel registration</Link>
    <div className="enquiry-access-heading"><div><p className="eyebrow">Registration lookup</p><h1>Check your hotel status</h1><p>Enter your hotel ID or registered phone and the status access code received after submission.</p></div></div>
    <form className="review-submission-form" onSubmit={submit}>
      <label>Hotel ID or phone number<input name="identifier" maxLength={80} required autoComplete="off" /></label>
      <label>Status access code<input name="accessCode" maxLength={12} minLength={5} required autoComplete="off" /></label>
      <button type="submit" className="button button-dark" disabled={busy}>{busy ? 'Checking...' : 'Check status'}</button>
    </form>
    {error && <p className="enquiry-error" role="alert">{error}</p>}
    {hotel && <section className="admin-review-record hotel-owner-status" aria-label="Hotel submission status">
      <h2>{hotel.name}</h2><p className="hotel-identifier">{hotel.hotelId}</p><p role="status">{hotelStatusLabels[hotel.status]}</p>
      <p>{hotel.location} · {hotelCategoryLabels[hotel.category]}</p><p>{hotel.description}</p>
      <p>{hotel.status === 'approved' ? 'Published' : 'Current'} rate: INR {hotel.price.toLocaleString('en-IN')} per room per night for 2 adults.</p>
      <p>{hotel.mealPlan} · {hotel.taxDetails}</p>
      {hotel.breakfastPrice !== undefined && <p>Optional breakfast: INR {hotel.breakfastPrice}; optional dinner: INR {hotel.dinnerPrice}, per room for 2 adults.</p>}
      <p>Heating: {hotel.heating}. Amenities: {hotel.amenities.join(', ') || 'None selected'}.</p>
      <ul>{hotel.highlights.map((point) => <li key={point}>{point}</li>)}</ul>
      {hotel.status === 'approved' ? <Link className="text-link" to={`/hotels/${hotel.id}`}>View approved listing <ArrowRight size={16} /></Link> : <p>This property is not publicly listed. Contact AVELOF for changes or questions.</p>}
    </section>}
  </section>
}

function AdminHotelRecord({ hotel, disabled, onSave, onDelete }: { hotel: AdminHotel; disabled: boolean; onSave: (hotel: AdminHotel, status: HotelStatus, price: number, note: string, breakfast?: number, dinner?: number) => Promise<void>; onDelete: (hotel: AdminHotel) => Promise<void> }) {
  const [note, setNote] = useState(hotel.ownerNote)
  const [status, setStatus] = useState<HotelStatus>(hotel.status)
  const [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    const parsed = hotelPriceSchema.safeParse(Number(fields.get('price')))
    if (!parsed.success) { setError('Enter a rate from INR 1 to INR 1,000,000 with at most two decimal places.'); return }
    setError('')
    await onSave(hotel, status, parsed.data, note, hotel.breakfastPrice !== undefined ? Number(fields.get('breakfastPrice')) : undefined, hotel.dinnerPrice !== undefined ? Number(fields.get('dinnerPrice')) : undefined)
  }
  return <article className="admin-review-record">
    <div className="admin-review-heading"><h2>{hotel.name}</h2><span className="enquiry-status">{hotelStatusLabels[hotel.status]}</span></div>
    <p className="hotel-identifier">{hotel.hotelId}</p><p>{hotel.location} · {hotelCategoryLabels[hotel.category]}</p>
    <p>Private contact: {hotel.contactName} · {hotel.phone}</p><p>{hotel.description}</p>
    <div className="hotel-photo-grid">{hotel.photos.map((photo, index) => <a href={photo} key={photo} target="_blank" rel="noreferrer"><img src={photo} alt={`${hotel.name}, submitted photo ${index + 1}`} loading="lazy" /></a>)}</div>
    <p>Heating: {hotel.heating}. Amenities: {hotel.amenities.join(', ') || 'None selected'}.</p>
    <p>{hotel.totalRooms} rooms. Room types: {hotel.roomTypes.join(', ')}. Check-in: {hotel.checkIn}; check-out: {hotel.checkOut}.</p>
    <h3>Public highlight points</h3><ul>{hotel.highlights.map((point) => <li key={point}>{point}</li>)}</ul>
    <p>Submitted rate: INR {hotel.submittedPrice.toLocaleString('en-IN')} per room per night for 2 adults. {hotel.mealPlan} · {hotel.taxDetails}.</p>
    <form className="review-submission-form" onSubmit={submit}>
      <fieldset disabled={disabled} className="hotel-form-fields">
        <NumberStepper label="Reviewed price (INR)" name="price" min={1} defaultValue={hotel.price} step={100} currency />
        {hotel.breakfastPrice !== undefined && <><NumberStepper label="Reviewed breakfast (INR)" name="breakfastPrice" defaultValue={hotel.breakfastPrice} step={50} currency /><NumberStepper label="Reviewed dinner (INR)" name="dinnerPrice" defaultValue={hotel.dinnerPrice} step={50} currency /></>}
        <label>Listing status<select value={status} onChange={(event) => setStatus(hotelStatusSchema.parse(event.target.value))}><option value="pending">Awaiting approval</option><option value="approved">Approve and publish</option><option value="rejected">Reject / remove from public listings</option></select></label>
        <label className="review-text-field">Note to hotel owner<textarea maxLength={1000} rows={2} value={note} onChange={(event) => setNote(event.target.value)} /></label>
        {error && <p className="enquiry-error" role="alert">{error}</p>}
        <button type="submit" className="button button-dark"><Check size={16} /> Save price and status</button>
      </fieldset>
    </form>
    <button type="button" className="button admin-record-delete" disabled={disabled} onClick={() => void onDelete(hotel)}><Trash2 size={16} /> Delete hotel registration</button>
  </article>
}

export function AdminHotelsPage() {
  const [listing, setListing] = useState<Awaited<ReturnType<typeof loadAdminHotels>> | null>(null)
  const [filters, setFilters] = useState<{ page: number; status: HotelStatus | 'all'; revision: number }>({ page: 1, status: 'pending', revision: 0 })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [signedOut, setSignedOut] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const inFlight = useRef(false)
  useEffect(() => {
    const controller = new AbortController()
    loadAdminHotels(filters.page, filters.status, controller.signal).then((data) => { setListing(data); setSignedOut(false) }).catch((failure: unknown) => {
      if (controller.signal.aborted) return
      setListing(null)
      if (failure instanceof HotelError && failure.status === 401) setSignedOut(true)
      else setError(hotelErrorText(failure))
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [filters])
  function refresh(page = filters.page, status = filters.status) {
    setLoading(true); setError(''); setFilters((current) => ({ page, status, revision: current.revision + 1 }))
  }
  async function save(hotel: AdminHotel, status: HotelStatus, price: number, note: string, breakfast?: number, dinner?: number) {
    if (inFlight.current) return
    inFlight.current = true; setSaving(true); setError(''); setNotice('')
    try { await moderateHotel(hotel.id, hotel.version, status, price, note, breakfast, dinner); setNotice('Hotel price and status saved.'); refresh() }
    catch (failure) {
      if (failure instanceof HotelError && failure.status === 401) { setSignedOut(true); setListing(null) }
      else setError(hotelErrorText(failure))
    } finally { setSaving(false); inFlight.current = false }
  }
  async function remove(hotel: AdminHotel) {
    if (inFlight.current || !window.confirm(`Permanently delete ${hotel.name}, its photos and linked reviews? This cannot be undone.`)) return
    inFlight.current = true; setSaving(true); setError(''); setNotice('')
    try {
      await deleteHotel(hotel.id, hotel.version)
      setNotice('Hotel registration permanently deleted.')
      refresh(listing?.hotels.length === 1 && filters.page > 1 ? filters.page - 1 : filters.page)
    } catch (failure) {
      if (failure instanceof HotelError && failure.status === 401) { setSignedOut(true); setListing(null) }
      else setError(hotelErrorText(failure))
    } finally { setSaving(false); inFlight.current = false }
  }
  return <section className="enquiry-access-page page-width">
    <Link className="text-link" to="/admin/panel"><ArrowLeft size={16} /> Owner dashboard</Link>
    <div className="enquiry-access-heading"><div><p className="eyebrow">AVELOF owner access</p><h1>Hotel registrations</h1></div></div>
    {signedOut ? <p>Please <Link to="/admin/panel">sign in to the owner dashboard</Link> to manage hotels.</p> : <>
      <nav className="admin-section-nav" aria-label="Owner sections"><Link to="/admin/panel">Enquiries</Link><Link to="/admin/panel/reviews">Reviews</Link><span aria-current="page">Hotels</span><Link to="/admin/panel/drivers">Drivers</Link></nav>
      <OwnerPushNotifications />
      <p>Check photo rights, property details and rate accuracy before approving. Category labels are not official star certifications. Phone numbers and contact names are never shown publicly.</p>
      <div className="admin-enquiry-toolbar"><strong>{listing?.total ?? 0} hotels</strong><label>Hotel status<select disabled={loading || saving} value={filters.status} onChange={(event) => refresh(1, event.target.value === 'all' ? 'all' : hotelStatusSchema.parse(event.target.value))}><option value="pending">Awaiting approval</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="all">All hotels</option></select></label><button type="button" className="icon-button" aria-label="Refresh hotels" title="Refresh hotels" disabled={loading || saving} onClick={() => refresh()}><RefreshCw size={18} /></button></div>
      {loading && <p role="status">Loading hotels...</p>}
      {notice && <p role="status">{notice}</p>}
      {error && <p className="enquiry-error" role="alert">{error}</p>}
      <div className="admin-review-list">{listing?.hotels.map((hotel) => <AdminHotelRecord key={`${hotel.id}-${hotel.version}`} hotel={hotel} disabled={loading || saving} onSave={save} onDelete={remove} />)}</div>
      {!loading && !error && !listing?.total && <p>No hotels in this view.</p>}
      {listing && <div className="admin-enquiry-pagination"><span>Page {filters.page} · {listing.total} hotels</span><button className="button button-outline" disabled={loading || saving || filters.page === 1} onClick={() => refresh(filters.page - 1)}>Previous</button><button className="button button-outline" disabled={loading || saving || filters.page * 25 >= listing.total} onClick={() => refresh(filters.page + 1)}>Next</button></div>}
    </>}
  </section>
}
