import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, FileImage, RefreshCw, Trash2 } from 'lucide-react'
import RegistrationReceipt from '../components/RegistrationReceipt'
import PartnerRegistrationLayout from '../components/PartnerRegistrationLayout'
import HotelFeature from '../components/HotelFeature'
import OwnerPushNotifications from '../components/OwnerPushNotifications'
import NumberStepper from '../components/NumberStepper'
import { heatingOptions, hotelAmenities, hotelCategories, hotelCategoryLabels, hotelHighlightOptions, hotelMealPlans, hotelPhotoCount, hotelRoomRateBasis, hotelRoomTypes, hotelStatusLabels, hotelTaxOptions, registrationLocations } from '../data/hotelRegistration'
import { hotelPriceSchema, hotelStatusSchema, hotelSubmissionSchema } from '../services/hotelSchema'
import type { AdminHotel, HotelRoomRate, HotelStatus } from '../services/hotelSchema'
import { compressHotelPhotos, deleteHotel, hotelErrorText, HotelError, loadAdminHotels, lookupHotel, moderateHotel, saveHotel, selectedHotelRoom, updateHotel } from '../services/hotelService'
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
export default function HotelRegistrationPage({ editing, accessCode, onCancel }: { editing?: OwnerHotel; accessCode?: string; onCancel?: () => void } = {}) {
  const [photos, setPhotos] = useState<Blob[]>([])
  const [processing, setProcessing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [photoError, setPhotoError] = useState('')
  const [photoNotice, setPhotoNotice] = useState('')
  const [receipt, setReceipt] = useState<HotelReceipt | null>(null)
  const pending = useRef({ fingerprint: '', id: crypto.randomUUID() })
  const inFlight = useRef(false)
  const photoVersion = useRef(0)
  const legacyRooms = Boolean(editing && !editing.roomRates)
  const highlights = [...new Set([...hotelHighlightOptions, ...(editing?.highlights ?? [])])]

  async function selectPhotos(files: File[]) {
    const version = ++photoVersion.current
    setProcessing(true)
    setPhotoError('')
    setPhotoNotice(files.length > hotelPhotoCount ? `You selected ${files.length} photos. Only the first ${hotelPhotoCount} will be uploaded.` : '')
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
    if ((!editing && !photos.length) || photoError) { setError('Select at least one valid hotel photo before submitting.'); return }
    const fields = new FormData(event.currentTarget)
    const roomCounts = hotelRoomTypes.map((roomType) => ({
      roomType,
      count: Number(fields.get(`roomCount_${roomType.toLowerCase()}`)),
      price: Number(fields.get(`roomPrice_${roomType.toLowerCase()}`)),
    })).filter(({ count }) => count > 0)
    const details = {
      name: fields.get('name'), contactName: fields.get('contactName'), phone: fields.get('phone'),
      category: fields.get('category'), location: fields.get('location'),
      description: editing ? fields.get('description') : `${String(fields.get('category'))} accommodation in ${String(fields.get('location'))}.`,
      price: legacyRooms ? Number(fields.get('legacyPrice')) : Math.min(...roomCounts.map(({ price }) => price)),
      ...(!legacyRooms ? { roomRates: roomCounts } : {}),
      mealPlan: legacyRooms && editing?.breakfastPrice === undefined ? fields.get('mealPlan') : 'Room only', taxDetails: fields.get('taxDetails'),
      ...(!editing || editing.breakfastPrice !== undefined ? { breakfastPrice: Number(fields.get('breakfastPrice')), dinnerPrice: Number(fields.get('dinnerPrice')) } : {}),
      heating: fields.get('heating'), amenities: fields.getAll('amenities'),
      highlights: fields.getAll('highlights'),
      roomTypes: legacyRooms ? String(fields.get('legacyRoomTypes')).split('\n').map((room) => room.trim()).filter(Boolean) : roomCounts.map(({ roomType, count }) => `${roomType} (${count} ${count === 1 ? 'room' : 'rooms'})`),
      checkIn: fields.get('checkIn'), checkOut: fields.get('checkOut'), totalRooms: legacyRooms ? Number(fields.get('totalRooms')) : roomCounts.reduce((total, { count }) => total + count, 0),
      publicationConsent: fields.has('publicationConsent'), website: fields.get('website') ?? '',
    }
    const fingerprint = JSON.stringify({ details, photoVersion: photoVersion.current })
    if (pending.current.fingerprint && pending.current.fingerprint !== fingerprint) pending.current.id = crypto.randomUUID()
    pending.current.fingerprint = fingerprint
    const parsed = hotelSubmissionSchema.safeParse({ ...details, id: editing?.id ?? pending.current.id })
    if (!parsed.success) { setError(parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join(' ')); return }
    inFlight.current = true
    setBusy(true)
    try {
      if (editing) {
        if (!accessCode) throw new HotelError('Check your status again before editing.', 401)
        setReceipt(await updateHotel(parsed.data, editing.version, accessCode, photos))
      } else setReceipt(await saveHotel(parsed.data, photos))
    }
    catch (failure) { setError(hotelErrorText(failure)) }
    finally { inFlight.current = false; setBusy(false) }
  }

  return <PartnerRegistrationLayout kind="hotel" editing={Boolean(editing)}>
    {receipt ? <RegistrationReceipt kind="Hotel" reference={receipt.hotelId} accessCode={receipt.accessCode}>
      <h2>{editing ? 'Your hotel changes have been saved.' : 'Your hotel registration has been saved.'}</h2><p>Status: {hotelStatusLabels[receipt.status]}. {editing && 'Your hotel is hidden publicly until AVELOF approves these changes. '}This is not a confirmed listing or booking.</p>
      <dl className="hotel-receipt"><div><dt>Hotel ID</dt><dd>{receipt.hotelId}</dd></div><div><dt>Status access code</dt><dd>{receipt.accessCode}</dd></div></dl>
      <p>Your status code uses the first four letters of the hotel name and the last four digits of the registered phone number.</p>
      {editing ? <button className="button button-dark" type="button" onClick={onCancel}>Check hotel status <ArrowRight size={16} /></button> : <Link className="button button-dark" to="/hotel-status">Check hotel status <ArrowRight size={16} /></Link>}
    </RegistrationReceipt> : <form className="review-submission-form hotel-registration-form" onSubmit={submit} aria-busy={busy}>
      <fieldset disabled={busy} className="registration-fields">
        <section className="hotel-form-fields registration-section" aria-labelledby="hotel-property-title">
        <div className="registration-section-heading"><span>01</span><div><h2 id="hotel-property-title">Property & contact</h2><p>A few essentials about your hotel and how we can reach you.</p></div></div>
        {editing && <p className="privacy-note review-text-field">Editing {editing.hotelId}. Saving hides this listing until AVELOF approves it again. If you change the hotel name or phone, keep the updated access code shown after saving.</p>}
        <label>Hotel name<input name="name" maxLength={120} required defaultValue={editing?.name} /></label>
        <label>Contact person's name (private)<input name="contactName" maxLength={80} autoComplete="name" required defaultValue={editing?.contactName} /></label>
        <label>Phone number (private)<input name="phone" type="tel" autoComplete="tel" maxLength={30} required placeholder="10-digit Indian phone number" defaultValue={editing?.phone} /><small>One hotel per phone number. You can use this number for private status lookup.</small></label>
        <label>Location<select name="location" required defaultValue={editing?.location ?? ''}><option value="" disabled>Select location</option>{registrationLocations.map((location) => <option key={location}>{location}</option>)}</select></label>
        <label>AVELOF category<select name="category" required defaultValue={editing?.category ?? ''}><option value="" disabled>Select category</option>{hotelCategories.map((category) => <option key={category} value={category}>{hotelCategoryLabels[category]}</option>)}</select><small>Our accommodation categories are not official star certifications.</small></label>
        {editing && <label className="review-text-field">Hotel description<textarea name="description" required minLength={20} maxLength={1600} defaultValue={editing.description} /></label>}
        </section>
        <section className="hotel-form-fields registration-section" aria-labelledby="hotel-rooms-title">
        <div className="registration-section-heading"><span>02</span><div><h2 id="hotel-rooms-title">Rooms & rates</h2><p>Tell us what you offer. Meals are optional add-ons.</p></div></div>
        <div className="privacy-note review-text-field hotel-commission-note">
          <strong>Customer price & commission:</strong>
          <ul>
            <li><strong>The room price you enter is the price shown directly to customers once approved.</strong></li>
            <li>AVELOF's 10% commission is deducted from the amount you enter.</li>
            <li>You receive the remaining 90%. Please set your price accordingly.</li>
          </ul>
          <div className="hotel-commission-examples">
            <table>
              <caption>Price examples (INR)</caption>
              <thead><tr><th scope="col">You enter / Customer sees</th><th scope="col">You receive (90%)</th><th scope="col">AVELOF retains (10%)</th></tr></thead>
              <tbody>
                {[2000, 3000, 5000].map((price) => <tr key={price}><td>{price.toLocaleString('en-IN')}</td><td>{(price * 0.9).toLocaleString('en-IN')}</td><td>{(price * 0.1).toLocaleString('en-IN')}</td></tr>)}
              </tbody>
            </table>
          </div>
        </div>
        {legacyRooms ? <><label className="review-text-field">Room types (one per line)<textarea name="legacyRoomTypes" required defaultValue={editing?.roomTypes.join('\n')} /></label><NumberStepper label="Total rooms" name="totalRooms" min={1} max={10000} defaultValue={editing?.totalRooms} /><NumberStepper label="Nightly rate (INR)" name="legacyPrice" min={1} defaultValue={editing?.price} currency />{editing?.breakfastPrice === undefined && <label>Meal plan<select name="mealPlan" defaultValue={editing?.mealPlan}>{hotelMealPlans.map((plan) => <option key={plan}>{plan}</option>)}</select></label>}</> : <fieldset className="hotel-amenities hotel-room-types review-text-field"><legend>Room types, quantity & nightly rates</legend>{hotelRoomTypes.map((roomType) => <div className="registration-room-rate" key={roomType}><NumberStepper label={`${roomType} rooms`} name={`roomCount_${roomType.toLowerCase()}`} min={0} max={10000} defaultValue={editing ? editing.roomRates?.find((room) => room.roomType === roomType)?.count ?? 0 : 1} /><NumberStepper label={`${roomType} rate (INR)`} name={`roomPrice_${roomType.toLowerCase()}`} min={1} defaultValue={editing?.roomRates?.find((room) => room.roomType === roomType)?.price ?? 2000} step={100} currency /></div>)}<small className="review-text-field">Set a room type to 0 if you do not offer it. Only available room types and their rates are listed. Hotel cards show the lowest room rate.</small></fieldset>}
        {(!editing || editing.breakfastPrice !== undefined) && <><NumberStepper label="Breakfast add-on (INR)" name="breakfastPrice" defaultValue={editing?.breakfastPrice ?? 500} step={50} currency />
        <NumberStepper label="Dinner add-on (INR)" name="dinnerPrice" defaultValue={editing?.dinnerPrice ?? 500} step={50} currency /></>}
        <p className="privacy-note review-text-field">Rates are per room per night: Family rooms cover 4 people; other room types cover 2 people. Enter the base breakfast and dinner add-ons for 2 people; Family rooms automatically use 1.5 times each meal charge for 4 people. AVELOF may edit these prices before approval.</p>
        <label>Taxes<select name="taxDetails" defaultValue={editing?.taxDetails}>{hotelTaxOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
        </section>
        <section className="hotel-form-fields registration-section" aria-labelledby="hotel-facilities-title">
        <div className="registration-section-heading"><span>03</span><div><h2 id="hotel-facilities-title">The stay experience</h2><p>The comforts and little details guests can look forward to.</p></div></div>
        <label>Heating system<select name="heating" defaultValue={editing?.heating ?? ''} required><option value="" disabled>Select heating system</option>{heatingOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
        <label>Check-in time<input name="checkIn" type="time" required defaultValue={editing?.checkIn ?? '14:00'} /></label>
        <label>Check-out time<input name="checkOut" type="time" required defaultValue={editing?.checkOut ?? '11:00'} /></label>
        <fieldset className="hotel-amenities hotel-amenity-options review-text-field"><legend>Amenities available</legend>{hotelAmenities.map((amenity) => <label key={amenity}><input type="checkbox" name="amenities" value={amenity} defaultChecked={editing?.amenities.includes(amenity)} /><HotelFeature label={amenity} /></label>)}</fieldset>
        <fieldset className="hotel-amenities hotel-highlights review-text-field"><legend>Major highlights</legend>{highlights.map((highlight) => <label key={highlight}><input type="checkbox" name="highlights" value={highlight} defaultChecked={editing?.highlights.includes(highlight)} /><HotelFeature label={highlight} /></label>)}<small className="review-text-field">Select the points that apply. Selected highlights appear in your approved listing.</small></fieldset>
        </section>
        <section className="hotel-form-fields registration-section" aria-labelledby="hotel-photos-title">
        <div className="registration-section-heading"><span>04</span><div><h2 id="hotel-photos-title">Photos & final check</h2><p>Give travellers a feel for your property, then send it for review.</p></div></div>
        {editing && <p className="privacy-note review-text-field">Your existing photos are kept unless you choose replacement photos. A new selection replaces the entire photo set.</p>}
        <label className="review-text-field photo-upload-field"><span className="photo-upload-heading"><FileImage size={24} aria-hidden="true" /> {editing ? 'Replacement hotel photos (optional)' : 'Hotel photos (1-5 required)'}</span><small>Choose photos to upload. If you select more than five, only the first five are used.</small><input aria-label={editing ? 'Replacement hotel photos (optional)' : 'Hotel photos (1-5 required)'} name="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple required={!editing} onChange={(event) => { const files = Array.from(event.target.files ?? []); if (editing && !files.length) { photoVersion.current++; setPhotos([]); setPhotoError(''); setPhotoNotice(''); setProcessing(false) } else void selectPhotos(files) }} /><small>JPEG, PNG or WebP; original files up to 5 MB each. Photos retain up to 1920 px and are compressed to at most 1 MB each; original metadata is removed.</small></label>
        <p role="status" className="review-text-field">{photoNotice} {processing ? 'Preparing photos...' : photos.length ? `${photos.length} ${photos.length === 1 ? 'photo ready' : 'photos ready'} to upload.` : ''}</p>
        {photoError && <p className="enquiry-error review-text-field" role="alert">{photoError}</p>}
        <div className="hotel-photo-grid review-text-field">{photos.map((photo, index) => <PhotoPreview key={index} photo={photo} index={index} />)}</div>
        <label className="enquiry-honeypot" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
        <label className="review-consent"><input name="publicationConsent" type="checkbox" required /><span>I am authorised to register this property and publish these photos. I consent to publication of approved hotel details and photos, including AVELOF's reviewed price. My contact name and phone stay private. I will not upload guest faces, identity documents or payment information.</span></label>
        {error && <p className="enquiry-error review-text-field" role="alert">{error}</p>}
        {busy && <p className="review-text-field" role="status">Uploading photos and saving your hotel registration. Please keep this page open.</p>}
        <button className="button button-dark" disabled={processing || (!editing && !photos.length)} type="submit">{busy ? 'Saving registration...' : editing ? 'Save changes for approval' : 'Submit hotel for approval'} <ArrowRight size={16} /></button>
        {editing && <button className="button button-outline" type="button" onClick={onCancel}>Cancel editing</button>}
        <p className="registration-submit-note">Your hotel will not appear publicly until AVELOF approves it.</p>
        </section>
      </fieldset>
    </form>}
  </PartnerRegistrationLayout>
}

export function HotelStatusPage() {
  const [hotel, setHotel] = useState<OwnerHotel | null>(null)
  const [accessCode, setAccessCode] = useState('')
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current) return
    const fields = new FormData(event.currentTarget)
    setHotel(null); setAccessCode(''); setEditing(false); setError(''); setBusy(true); inFlight.current = true
    try {
      const code = String(fields.get('accessCode')).trim().toUpperCase()
      setHotel(await lookupHotel(String(fields.get('identifier')), code))
      setAccessCode(code)
    }
    catch (failure) { setError(hotelErrorText(failure)) }
    finally { setBusy(false); inFlight.current = false }
  }
  if (editing && hotel) return <HotelRegistrationPage key={`${hotel.id}-${hotel.version}`} editing={hotel} accessCode={accessCode} onCancel={() => { setEditing(false); setHotel(null); setAccessCode('') }} />
  return <section className="enquiry-access-page page-width">
    <Link className="text-link" to="/register-hotel"><ArrowLeft size={16} /> Hotel registration</Link>
    <div className="enquiry-access-heading"><div><p className="eyebrow">Already registered?</p><h1>Edit your hotel details</h1><p>Enter your hotel ID or registered phone and the status access code received after submission to check your status and edit your details.</p></div></div>
    <form className="review-submission-form" onSubmit={submit}>
      <label>Hotel ID or phone number<input name="identifier" maxLength={80} required autoComplete="off" /></label>
      <label>Status access code<input name="accessCode" maxLength={12} minLength={5} required autoComplete="off" /></label>
      <button type="submit" className="button button-dark" disabled={busy}>{busy ? 'Checking...' : 'Check status'}</button>
    </form>
    {error && <p className="enquiry-error" role="alert">{error}</p>}
    {hotel && <section className="admin-review-record hotel-owner-status" aria-label="Hotel submission status">
      <h2>{hotel.name}</h2><p className="hotel-identifier">{hotel.hotelId}</p><p role="status">{hotelStatusLabels[hotel.status]}</p>
      <p>{hotel.location} · {hotelCategoryLabels[hotel.category]}</p><p>{hotel.description}</p>
      <p>{hotel.status === 'approved' ? 'Published' : 'Current'} rate: INR {hotel.price.toLocaleString('en-IN')} {hotelRoomRateBasis(selectedHotelRoom(hotel)?.roomType)}.</p>
      <p>{hotel.mealPlan} · {hotel.taxDetails}</p>
      {hotel.roomRates && <ul>{hotel.roomRates.map((room) => <li key={room.roomType}>{room.roomType}: INR {room.price.toLocaleString('en-IN')} {hotelRoomRateBasis(room.roomType)}</li>)}</ul>}
      {hotel.breakfastPrice !== undefined && <p>Base optional breakfast: INR {hotel.breakfastPrice}; dinner: INR {hotel.dinnerPrice}, for 2 people. Family rooms cover 4 people and use 1.5 times each meal charge.</p>}
      <p>Heating: {hotel.heating}. Amenities: {hotel.amenities.join(', ') || 'None selected'}.</p>
      <ul>{hotel.highlights.map((point) => <li key={point}>{point}</li>)}</ul>
      {hotel.status === 'approved' ? <Link className="text-link" to={`/hotels/${hotel.id}`}>View approved listing <ArrowRight size={16} /></Link> : <p>This property is not publicly listed.</p>}
      <p>Saving edits returns your registration to awaiting approval and hides it publicly until AVELOF approves it again.</p>
      <button className="button button-dark" type="button" onClick={() => setEditing(true)}>Edit hotel details</button>
    </section>}
  </section>
}

function AdminHotelRecord({ hotel, disabled, onSave, onDelete }: { hotel: AdminHotel; disabled: boolean; onSave: (hotel: AdminHotel, status: HotelStatus, price: number, note: string, breakfast?: number, dinner?: number, roomRates?: HotelRoomRate[]) => Promise<void>; onDelete: (hotel: AdminHotel) => Promise<void> }) {
  const [note, setNote] = useState(hotel.ownerNote)
  const [status, setStatus] = useState<HotelStatus>(hotel.status)
  const [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    const roomRates = hotel.roomRates?.map((room) => ({ ...room, price: Number(fields.get(`roomPrice_${room.roomType}`)) }))
    const parsed = hotelPriceSchema.safeParse(roomRates ? Math.min(...roomRates.map(({ price }) => price)) : Number(fields.get('price')))
    if (!parsed.success) { setError('Enter a rate from INR 1 to INR 1,000,000 with at most two decimal places.'); return }
    setError('')
    if (roomRates?.some((room) => !hotelPriceSchema.safeParse(room.price).success)) { setError('Check the reviewed rate for each room type.'); return }
    await onSave(hotel, status, parsed.data, note, hotel.breakfastPrice !== undefined ? Number(fields.get('breakfastPrice')) : undefined, hotel.dinnerPrice !== undefined ? Number(fields.get('dinnerPrice')) : undefined, roomRates)
  }
  return <article className="admin-review-record">
    <div className="admin-review-heading"><h2>{hotel.name}</h2><span className="enquiry-status">{hotelStatusLabels[hotel.status]}</span></div>
    <p className="hotel-identifier">{hotel.hotelId}</p><p>{hotel.location} · {hotelCategoryLabels[hotel.category]}</p>
    <p>Private contact: {hotel.contactName} · {hotel.phone}</p><p>{hotel.description}</p>
    <div className="hotel-photo-grid">{hotel.photos.map((photo, index) => <a href={photo} key={photo} target="_blank" rel="noreferrer"><img src={photo} alt={`${hotel.name}, submitted photo ${index + 1}`} loading="lazy" /></a>)}</div>
    <p>Heating: {hotel.heating}. Amenities: {hotel.amenities.join(', ') || 'None selected'}.</p>
    <p>{hotel.totalRooms} rooms. Room types: {hotel.roomTypes.join(', ')}. Check-in: {hotel.checkIn}; check-out: {hotel.checkOut}.</p>
    <h3>Public highlight points</h3><ul>{hotel.highlights.map((point) => <li key={point}>{point}</li>)}</ul>
    <p>Submitted rate: INR {hotel.submittedPrice.toLocaleString('en-IN')} {hotelRoomRateBasis(selectedHotelRoom(hotel)?.roomType)}. {hotel.mealPlan} · {hotel.taxDetails}.</p>
    <p>Family room rates cover 4 people; other room rates cover 2 people. Reviewed breakfast and dinner are base charges for 2 people; Family rooms use 1.5 times each charge.</p>
    <form className="review-submission-form" onSubmit={submit}>
      <fieldset disabled={disabled} className="hotel-form-fields">
        {hotel.roomRates ? hotel.roomRates.map((room) => <NumberStepper key={room.roomType} label={`Reviewed ${room.roomType} rate (INR)`} name={`roomPrice_${room.roomType}`} min={1} defaultValue={room.price} step={100} currency />) : <NumberStepper label="Reviewed price (INR)" name="price" min={1} defaultValue={hotel.price} step={100} currency />}
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
  async function save(hotel: AdminHotel, status: HotelStatus, price: number, note: string, breakfast?: number, dinner?: number, roomRates?: HotelRoomRate[]) {
    if (inFlight.current) return
    inFlight.current = true; setSaving(true); setError(''); setNotice('')
    try { await moderateHotel(hotel.id, hotel.version, status, price, note, breakfast, dinner, roomRates); setNotice('Hotel price and status saved.'); refresh() }
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
