import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, FileImage, Plus, Trash2 } from 'lucide-react'
import { businessKindLabels, businessKinds, businessLocations } from '../data/businessRegistration'
import { businessDetailsSchema, businessStatusSchema, businessSubmissionSchema } from '../services/businessSchema'
import type { AdminBusiness, BusinessDetails, BusinessReceipt, BusinessStatus, OwnerBusiness } from '../services/businessSchema'
import { BusinessError, businessErrorText, compressBusinessPhoto, deleteBusiness, editBusiness, loadAdminBusinesses, lookupBusiness, moderateBusiness, saveBusiness } from '../services/businessService'
import { hotelStatusLabels } from '../data/hotelRegistration'
import RegistrationReceipt from '../components/RegistrationReceipt'
import SubmissionProgress from '../components/SubmissionFeedback'
import PartnerPhotoEditor from '../components/PartnerPhotoEditor'
import RegistrationForm from '../components/RegistrationForm'
import MapLocationLink from '../components/MapLocationLink'
import { locationFields, mapCoordinates } from '../services/mapLocation'

function PhotoPreview({ photo }: { photo: Blob }) {
  const imageRef = useRef<HTMLImageElement>(null)
  useEffect(() => {
    const url = URL.createObjectURL(photo)
    if (imageRef.current) imageRef.current.src = url
    return () => URL.revokeObjectURL(url)
  }, [photo])
  return <img ref={imageRef} alt="Selected business photo preview" />
}

export default function BusinessRegistrationPage({ editing, onCancel }: { editing?: { business: OwnerBusiness; accessCode: string }; onCancel?: () => void } = {}) {
  const [photos, setPhotos] = useState<Blob[]>([])
  const [items, setItems] = useState(() => (editing?.business.items.length ? editing.business.items : ['']).map((name) => ({ id: crypto.randomUUID(), name })))
  const [processing, setProcessing] = useState(Boolean(editing))
  const [retainedPhotos, setRetainedPhotos] = useState<number[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [photoError, setPhotoError] = useState('')
  const [receipt, setReceipt] = useState<BusinessReceipt | null>(null)
  const [destination, setDestination] = useState<string>(editing?.business.location ?? 'Srinagar')
  const coordinates = mapCoordinates(editing?.business ?? {})
  const pending = useRef({ id: crypto.randomUUID(), fingerprint: '' })
  const photoVersion = useRef(0)
  const inFlight = useRef(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current || processing) return
    setError('')
    if ((!editing && !photos.length) || photoError) { setError('Select between one and five valid photos of your shop or restaurant and products.'); return }
    const fields = new FormData(event.currentTarget)
    const details = {
      name: fields.get('name'),
      kind: fields.get('kind'),
      location: fields.get('location'),
      ...locationFields(coordinates),
      address: fields.get('address'),
      description: editing?.business.description ?? '',
      items: items.map((item) => item.name.trim()).filter(Boolean),
      website: fields.get('website'),
      contactName: fields.get('contactName'),
      contactPhone: fields.get('contactPhone'),
      contactEmail: fields.get('contactEmail'),
      publicationConsent: fields.has('publicationConsent'),
      websiteTrap: fields.get('websiteTrap') ?? '',
    }
    const fingerprint = JSON.stringify({ details, photoVersion: photoVersion.current, retainedPhotos })
    if (pending.current.fingerprint && pending.current.fingerprint !== fingerprint) pending.current.id = crypto.randomUUID()
    pending.current.fingerprint = fingerprint
    const parsed = businessSubmissionSchema.safeParse({ ...details, id: editing?.business.id ?? pending.current.id })
    if (!parsed.success) { setError(parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join(' ')); return }
    inFlight.current = true
    setBusy(true)
    try { setReceipt(editing ? await editBusiness(parsed.data, { accessCode: editing.accessCode, version: editing.business.version }, photos, retainedPhotos) : await saveBusiness(parsed.data, photos)) }
    catch (failure) { setError(businessErrorText(failure)) }
    finally { inFlight.current = false; setBusy(false) }
  }

  async function selectPhotos(files: File[]) {
    const version = ++photoVersion.current
    setPhotos([])
    setError('')
    setPhotoError('')
    setProcessing(false)
    if (editing && !files.length) return
    if (files.length < 1 || files.length > 5) { setPhotoError('Choose between one and five photos of your shop or restaurant and products.'); return }
    setProcessing(true)
    try {
      const compressed: Blob[] = []
      for (let index = 0; index < files.length; index += 2) {
        compressed.push(...await Promise.all(files.slice(index, index + 2).map(compressBusinessPhoto)))
      }
      if (photoVersion.current === version) setPhotos(compressed)
    } catch (failure) {
      if (photoVersion.current === version) setPhotoError(businessErrorText(failure))
    } finally { if (photoVersion.current === version) setProcessing(false) }
  }

  return <section className="enquiry-access-page page-width">
    <Link className="text-link" to="/partners">Partner with AVELOF</Link>
    <div className="enquiry-access-heading"><div><p className="eyebrow">Local restaurants and shops</p><h1>{editing ? 'Edit your business' : 'Register your business'}</h1><p>Share your business with travellers. AVELOF reviews every submission before it appears in Food & Shopping.</p></div></div>
    {receipt ? <RegistrationReceipt kind="Business" reference={receipt.id} accessCode={receipt.accessCode}>
      <h2>Your registration has been received.</h2>
      <p>Status: {hotelStatusLabels[receipt.status]}. Your listing is not public until approved. This is a discovery listing only; it does not accept orders or payments, and no discount or booking is guaranteed.</p>
      <dl className="hotel-receipt"><dt>Business ID</dt><dd>{receipt.id}</dd><dt>Status access code</dt><dd>{receipt.accessCode}</dd></dl>
      <p>Your access code uses the first four letters of your business name and the last four digits of your registered phone number. Save these details; changing your name or phone may change the code.</p>
      {editing ? <button className="button button-outline" type="button" onClick={onCancel}>Check business status</button> : <Link className="button button-outline" to="/business-status">Check business status</Link>}
      <Link className="button button-dark" to="/food-and-shopping">Explore Food & Shopping <ArrowRight size={16} /></Link>
    </RegistrationReceipt> : <RegistrationForm className="review-submission-form" onSubmit={submit} aria-busy={busy}>
      <fieldset className="registration-fields" disabled={busy}>
        <section className="hotel-form-fields registration-section" aria-labelledby="business-public-title">
          <div className="registration-section-heading"><span>01</span><div><h2 id="business-public-title">Public business listing</h2><p>These details are shown only after AVELOF approves your registration.</p></div></div>
          {editing && <p className="review-text-field privacy-note">Saving changes hides this listing until AVELOF approves it again. Existing photos are kept unless you choose replacements.</p>}
          <label>Business name<input name="name" maxLength={120} required autoComplete="organization" defaultValue={editing?.business.name} /></label>
          <label>Business type<select name="kind" required defaultValue={editing?.business.kind ?? 'restaurant'}>{businessKinds.map((kind) => <option key={kind} value={kind}>{businessKindLabels[kind]}</option>)}</select></label>
          <label>Destination<select name="location" required value={destination} onChange={(event) => setDestination(event.target.value)}>{businessLocations.map((location) => <option key={location}>{location}</option>)}</select></label>
          <label>Public address or area<input name="address" maxLength={200} required autoComplete="street-address" defaultValue={editing?.business.address} placeholder="Address or nearby main attraction" /><small>Include a nearby main attraction or landmark so guests can recognise the area.</small></label>
          <fieldset className="business-items-fields review-text-field"><legend>Products or dishes available (optional)</legend><p>Add up to 20 item names for guests to browse. This is not an online ordering menu.</p>{items.map((item, index) => <div className="business-item-row" key={item.id}><label>Item {index + 1}<input name={`item-${item.id}`} maxLength={100} value={item.name} placeholder="For example, saffron or walnut wood crafts" onChange={(event) => setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, name: event.target.value } : entry))} /></label>{items.length > 1 && <button className="icon-button" type="button" aria-label={`Remove item ${index + 1}`} onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))}><Trash2 size={18} /></button>}</div>)}<button className="button button-outline" type="button" disabled={items.length >= 20} onClick={() => setItems((current) => [...current, { id: crypto.randomUUID(), name: '' }])}><Plus size={16} />Add another item</button></fieldset>
          <label>Public website (optional)<input name="website" type="url" maxLength={200} placeholder="https://example.com" defaultValue={editing?.business.website} /></label>
        </section>
        <section className="hotel-form-fields registration-section" aria-labelledby="business-contact-title">
          <div className="registration-section-heading"><span>02</span><div><h2 id="business-contact-title">Private contact & photos</h2><p>Your contact details are for AVELOF's review only and will not be published.</p></div></div>
          <label>Contact person's name<input name="contactName" maxLength={100} required autoComplete="name" defaultValue={editing?.business.contactName} /></label>
          <label>Private contact phone<input name="contactPhone" type="tel" maxLength={30} required autoComplete="tel" defaultValue={editing?.business.contactPhone} /></label>
          <label>Private contact email<input name="contactEmail" type="email" maxLength={200} required autoComplete="email" defaultValue={editing?.business.contactEmail} /></label>
          {editing ? <PartnerPhotoEditor kind="business" id={editing.business.id} accessCode={editing.accessCode} version={editing.business.version} onChange={(next, retained, blocked) => { photoVersion.current++; setPhotos(next); setRetainedPhotos(retained); setProcessing(blocked) }} /> : <>
          <label className="review-text-field photo-upload-field"><span className="photo-upload-heading"><FileImage size={24} aria-hidden="true" /> Shop, restaurant & product photos (1-5 required)</span><small>Choose between one and five JPEG, PNG or WebP photos, up to 5 MB each. Show your shop or restaurant and the products or dishes you offer. Photos are resized, compressed and stripped of original metadata before upload.</small><input name="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple required onChange={(event) => void selectPhotos(Array.from(event.target.files ?? []))} /></label>
          {photoError && <p className="enquiry-error review-text-field" role="alert">{photoError}</p>}
          <div className="hotel-photo-grid review-text-field">{photos.map((photo, index) => <PhotoPreview key={index} photo={photo} />)}</div>
          </>}
          <label className="enquiry-honeypot" aria-hidden="true">Website<input name="websiteTrap" tabIndex={-1} autoComplete="off" /></label>
          <label className="review-consent"><input name="publicationConsent" type="checkbox" required /><span>I am authorised to register this business and use these photos. I consent to publishing the business name, type, destination, address{coordinates ? ', existing map pin' : ''}, item names, website and photos if approved. My contact name, phone and email stay private. I understand this listing does not take orders or payments and does not guarantee a discount.</span></label>
          {error && <p className="enquiry-error review-text-field" role="alert">{error}</p>}
          {!editing && <p className="review-text-field" role="status">{processing ? 'Preparing photos...' : photos.length ? `${photos.length} photos ready to upload.` : 'Select at least one photo before submitting.'}</p>}
          {busy && <p className="review-text-field" role="status">Submitting your business for review…</p>}
          <button className="button button-dark" type="submit" disabled={processing || (!editing && !photos.length) || Boolean(photoError) || busy}>{busy ? 'Submitting…' : editing ? 'Save changes for approval' : 'Submit for approval'} <ArrowRight size={16} /></button>
          {editing && <button className="button button-outline" type="button" onClick={onCancel}>Cancel editing</button>}
          <p className="registration-submit-note">Your registration remains private and is not published until AVELOF approves it.</p>
        </section>
      </fieldset>
    </RegistrationForm>}
    {busy && <SubmissionProgress title="Saving your business registration">Uploading photos and saving your restaurant or shop details. Please keep this page open until you see your receipt.</SubmissionProgress>}
  </section>
}

export function BusinessStatusPage() {
  const [business, setBusiness] = useState<OwnerBusiness | null>(null)
  const [accessCode, setAccessCode] = useState('')
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const inFlight = useRef(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current) return
    inFlight.current = true
    const fields = new FormData(event.currentTarget)
    const code = String(fields.get('accessCode')).trim().toUpperCase()
    setBusy(true); setError(''); setBusiness(null); setAccessCode('')
    try { setBusiness(await lookupBusiness(String(fields.get('identifier')).trim(), code)); setAccessCode(code) }
    catch (failure) { setError(businessErrorText(failure)) }
    finally { setBusy(false); inFlight.current = false }
  }
  if (editing && business) return <BusinessRegistrationPage editing={{ business, accessCode }} onCancel={() => { setEditing(false); setBusiness(null); setAccessCode('') }} />
  return <section className="enquiry-access-page page-width"><Link to="/partners">Partner with AVELOF</Link><h1>Edit your business details</h1><p>Enter your business ID or registered phone number and status access code to check your restaurant or shop registration. The code uses the first four letters of the business name and last four phone digits.</p><form className="review-submission-form" onSubmit={submit}><label>Business ID or phone number<input name="identifier" maxLength={80} required autoComplete="off" /></label><label>Status access code<input name="accessCode" minLength={5} maxLength={12} required autoComplete="off" /></label><button className="button button-dark" disabled={busy}>{busy ? 'Checking...' : 'Check status'}</button></form>{error && <p className="enquiry-error" role="alert">{error}</p>}{business && <section className="admin-review-record hotel-owner-status"><h2>{business.name}</h2><p>{businessKindLabels[business.kind]} · {business.location}</p><p className="hotel-identifier">{business.id}</p><p role="status">{hotelStatusLabels[business.status]}</p>{business.status === 'approved' ? <Link to="/food-and-shopping">View business directory</Link> : <p>Not publicly listed.</p>}<p>Saving changes hides your listing until it is approved again.</p><button className="button button-dark" type="button" onClick={() => setEditing(true)}>Edit registration</button></section>}</section>
}

function BusinessRecord({ business, disabled, save, remove }: {
  business: AdminBusiness
  disabled: boolean
  save: (business: AdminBusiness, details: BusinessDetails, status: BusinessStatus, note: string) => Promise<void>
  remove: (business: AdminBusiness) => Promise<void>
}) {
  const [status, setStatus] = useState<BusinessStatus>(business.status)
  const [destination, setDestination] = useState<string>(business.location)
  const coordinates = mapCoordinates(business)
  const [validationError, setValidationError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    const parsed = businessDetailsSchema.safeParse({
      name: fields.get('name'),
      kind: fields.get('kind'),
      location: fields.get('location'),
      address: fields.get('address'),
      ...locationFields(coordinates),
      description: fields.get('description'),
      items: String(fields.get('items') ?? '').split('\n').map((item) => item.trim()).filter(Boolean),
      website: fields.get('website'),
    })
    if (!parsed.success) { setValidationError(parsed.error.issues.map((issue) => issue.message).join(' ')); return }
    setValidationError('')
    await save(business, parsed.data, status, String(fields.get('ownerNote')))
  }
  return <article className="admin-review-record">
    <h2>{business.name} · {businessKindLabels[business.kind]}</h2>
    <p>{business.location} · {business.address}</p>
    <MapLocationLink location={business} />
    <p>Private contact: {business.contactName} · {business.contactPhone} · {business.contactEmail}</p>
    <div className="hotel-photo-grid">{(business.photos ?? [business.photo]).map((photo, index) => <a key={photo} href={photo} target="_blank" rel="noreferrer"><img src={photo} alt={`Business photo ${index + 1} for ${business.name}`} /></a>)}</div>
    <form onSubmit={submit} className="review-submission-form">
      <fieldset className="hotel-form-fields" disabled={disabled}>
        <label>Business name<input name="name" maxLength={120} required defaultValue={business.name} /></label>
        <label>Business type<select name="kind" defaultValue={business.kind}>{businessKinds.map((kind) => <option key={kind} value={kind}>{businessKindLabels[kind]}</option>)}</select></label>
        <label>Destination<select name="location" value={destination} onChange={(event) => setDestination(event.target.value)}>{businessLocations.map((location) => <option key={location}>{location}</option>)}</select></label>
        <label>Public address<input name="address" maxLength={200} required defaultValue={business.address} /></label>
        <label className="review-text-field">Public description (legacy, optional)<textarea name="description" rows={4} maxLength={1600} defaultValue={business.description} /></label>
        <label className="review-text-field">Available items (one per line, up to 20)<textarea name="items" rows={5} maxLength={2019} defaultValue={business.items.join('\n')} /></label>
        <label>Public website<input name="website" type="url" maxLength={200} defaultValue={business.website} /></label>
        <label>Listing status<select value={status} onChange={(event) => setStatus(businessStatusSchema.parse(event.target.value))}><option value="pending">Awaiting approval</option><option value="approved">Approve and publish</option><option value="rejected">Reject / hide</option></select></label>
        <label className="review-text-field">Private note<textarea name="ownerNote" maxLength={1000} defaultValue={business.ownerNote} /></label>
        {validationError && <p role="alert" className="enquiry-error">{validationError}</p>}
        <button className="button button-dark" type="submit">Save business listing</button>
      </fieldset>
    </form>
    <button type="button" className="button admin-record-delete" disabled={disabled} onClick={() => void remove(business)}><Trash2 size={16} /> Delete registration</button>
  </article>
}

export function AdminBusinessesPage() {
  const [listing, setListing] = useState<Awaited<ReturnType<typeof loadAdminBusinesses>> | null>(null)
  const [filters, setFilters] = useState<{ page: number; status: BusinessStatus | 'all'; revision: number }>({ page: 1, status: 'pending', revision: 0 })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [signedOut, setSignedOut] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const inFlight = useRef(false)
  function refresh(page = filters.page, status = filters.status) {
    setError('')
    setLoading(true)
    setFilters((current) => ({ page, status, revision: current.revision + 1 }))
  }
  useEffect(() => {
    const controller = new AbortController()
    loadAdminBusinesses(filters.page, filters.status, controller.signal)
      .then((data) => { setListing(data); setSignedOut(false) })
      .catch((failure: unknown) => {
        if (!controller.signal.aborted) {
          setListing(null)
          if (failure instanceof BusinessError && failure.status === 401) setSignedOut(true)
          else setError(businessErrorText(failure))
        }
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [filters])
  async function save(business: AdminBusiness, details: BusinessDetails, status: BusinessStatus, note: string) {
    if (inFlight.current) return
    inFlight.current = true; setSaving(true); setError('')
    try {
      await moderateBusiness(business, details, status, note)
      setNotice('Business listing and approval status saved.')
      refresh()
    } catch (failure) {
      if (failure instanceof BusinessError && failure.status === 401) { setSignedOut(true); setListing(null) }
      else setError(businessErrorText(failure))
    } finally { setSaving(false); inFlight.current = false }
  }
  async function remove(business: AdminBusiness) {
    if (inFlight.current || !window.confirm(`Permanently delete ${business.name} and its photo? This cannot be undone.`)) return
    inFlight.current = true; setSaving(true); setError(''); setNotice('')
    try {
      await deleteBusiness(business.id, business.version)
      setNotice('Business registration permanently deleted.')
      refresh(listing?.businesses.length === 1 && filters.page > 1 ? filters.page - 1 : filters.page)
    } catch (failure) {
      if (failure instanceof BusinessError && failure.status === 401) { setSignedOut(true); setListing(null) }
      else setError(businessErrorText(failure))
    } finally { setSaving(false); inFlight.current = false }
  }
  return <section className="enquiry-access-page page-width">
    <h1>Food & Shopping registrations</h1>
    {signedOut ? <p><Link to="/admin/panel">Sign in to the owner dashboard</Link> to manage business registrations.</p> : <>
      <nav className="admin-section-nav" aria-label="Owner sections"><Link to="/admin/panel">Enquiries</Link><Link to="/admin/panel/reviews">Reviews</Link><Link to="/admin/panel/hotels">Hotels</Link><Link to="/admin/panel/drivers">Drivers</Link><span aria-current="page">Food & Shopping</span></nav>
      <p>Review business accuracy, publication consent, identity, operating details and the submitted photo before approval. Owner contact details remain private. These are discovery listings only, without ordering, checkout or guaranteed discounts.</p>
      <div className="admin-enquiry-toolbar"><label>Business status<select disabled={loading || saving} value={filters.status} onChange={(event) => refresh(1, event.target.value === 'all' ? 'all' : businessStatusSchema.parse(event.target.value))}><option value="pending">Awaiting approval</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="all">All</option></select></label><button className="button button-outline" disabled={loading || saving} onClick={() => refresh()}>Refresh businesses</button></div>
      {loading && <p role="status">Loading business registrations…</p>}
      {error && <p role="alert" className="enquiry-error">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {listing && !loading && <div className="admin-review-list">{listing.businesses.map((business) => <BusinessRecord key={`${business.id}-${business.version}`} business={business} disabled={saving} save={save} remove={remove} />)}</div>}
      {listing && !loading && !listing.businesses.length && <p>No business registrations match this status.</p>}
      {listing && listing.total > listing.pageSize && <nav aria-label="Business registration pages"><button className="button button-outline" disabled={loading || saving || filters.page <= 1} onClick={() => refresh(filters.page - 1)}>Previous</button><span>Page {filters.page} of {Math.ceil(listing.total / listing.pageSize)}</span><button className="button button-outline" disabled={loading || saving || filters.page * listing.pageSize >= listing.total} onClick={() => refresh(filters.page + 1)}>Next</button></nav>}
    </>}
  </section>
}
