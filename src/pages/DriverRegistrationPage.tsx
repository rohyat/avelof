import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import { Trash2 } from 'lucide-react'
import NumberStepper from '../components/NumberStepper'
import PartnerPhotos from '../components/PartnerPhotos'
import OwnerPushNotifications from '../components/OwnerPushNotifications'
import { driverDistricts, driverVehicleNumberPattern, driverVehicleOptions, normalizeDriverVehicleNumber } from '../data/driverRegistration'
import { hotelStatusLabels } from '../data/hotelRegistration'
import { driverReceiptSchema, driverStatusResultSchema, driverSubmissionSchema } from '../services/driverSchema'
import type { AdminDriver } from '../services/driverSchema'
import { HotelError, hotelErrorText } from '../services/hotelService'
import { hotelStatusSchema } from '../services/hotelSchema'
import type { HotelStatus } from '../services/hotelSchema'
import { deleteDriver, loadAdminDrivers, lookupDriver, moderateDriver, saveDriver } from '../services/driverService'

export default function DriverRegistrationPage() {
  const [photos, setPhotos] = useState<Blob[]>([])
  const [processing, setProcessing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [vehicleNumberError, setVehicleNumberError] = useState('')
  const [receipt, setReceipt] = useState<z.infer<typeof driverReceiptSchema> | null>(null)
  const pending = useRef({ id: crypto.randomUUID(), fingerprint: '' })
  const photoVersion = useRef(0)
  const inFlight = useRef(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current || processing) return
    const fields = new FormData(event.currentTarget)
    const details = {
      fullName: fields.get('fullName'), phone: fields.get('phone'),
      age: Number(fields.get('age')), licenceNumber: fields.get('licenceNumber'), vehicleNumber: fields.get('vehicleNumber'),
      vehicleId: fields.get('vehicleId'), location: fields.get('location'),
      seats: Number(fields.get('seats')),
      publicationConsent: fields.has('publicationConsent'), website: fields.get('website') ?? '',
    }
    setError('')
    const fingerprint = JSON.stringify({ details, photos: photoVersion.current })
    if (pending.current.fingerprint && pending.current.fingerprint !== fingerprint) pending.current.id = crypto.randomUUID()
    pending.current.fingerprint = fingerprint
    const parsed = driverSubmissionSchema.safeParse({ ...details, id: pending.current.id })
    if (!parsed.success) { setError(parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join(' ')); return }
    if (photos.length !== 1) { setError('Select one valid driver portrait photo.'); return }
    setBusy(true); inFlight.current = true
    try { setReceipt(await saveDriver(parsed.data, photos[0])) } catch (failure) { setError(hotelErrorText(failure)) }
    finally { setBusy(false); inFlight.current = false }
  }
  return <section className="enquiry-access-page page-width">
    <Link className="text-link" to="/partners">Partner with AVELOF</Link>
    <div className="enquiry-access-heading"><div><p className="eyebrow">Driver partners</p><h1>Register as a driver</h1><p>After approval, your full name, portrait, vehicle details and vehicle registration appear in our driver directory. Your phone and driving-licence numbers are masked; age and full contact details remain private.</p></div></div>
    <p><Link to="/driver-status">Already registered? Check driver status</Link></p>
    {receipt ? <section className="review-ready" role="status"><h2>Your driver registration has been saved.</h2><p>{hotelStatusLabels[receipt.status]}. Not a confirmed listing or booking.</p><dl className="hotel-receipt"><dt>Driver ID</dt><dd>{receipt.driverId}</dd><dt>Status access code</dt><dd>{receipt.accessCode}</dd></dl><p>Your status code uses the first four letters of your name and the last four digits of your registered phone number.</p><Link to="/driver-status" className="button button-dark">Check driver status</Link></section> : <form className="review-submission-form" onSubmit={submit}>
      <fieldset className="hotel-form-fields" disabled={busy}>
        <label>Full legal name<input name="fullName" maxLength={100} required autoComplete="name" /></label>
        <NumberStepper label="Age (minimum 18)" name="age" min={18} max={100} />
        <label>Phone number<input name="phone" type="tel" required maxLength={30} autoComplete="tel" /><small>One driver registration per Indian phone number; only a masked number is shown publicly.</small></label>
        <label>Driving licence number<input name="licenceNumber" maxLength={40} minLength={5} required /></label>
        <label>Vehicle registration number<input name="vehicleNumber" maxLength={13} minLength={10} required pattern="JK[0-9]{2}[A-Za-z]{1,2}-[0-9]{4}" placeholder="JK13B-1444 or JK01AB-1485" title="Use JK13B-1444 or JK01AB-1485 format." aria-invalid={Boolean(vehicleNumberError)} aria-describedby={vehicleNumberError ? 'vehicle-number-error' : undefined} onChange={(event) => { const normalized = normalizeDriverVehicleNumber(event.currentTarget.value); event.currentTarget.value = normalized; setVehicleNumberError(normalized && !driverVehicleNumberPattern.test(normalized) ? 'Use format JK13B-1444 or JK01AB-1485.' : '') }} onBlur={(event) => { const normalized = normalizeDriverVehicleNumber(event.currentTarget.value); event.currentTarget.value = normalized; setVehicleNumberError(normalized && !driverVehicleNumberPattern.test(normalized) ? 'Use format JK13B-1444 or JK01AB-1485.' : '') }} />{vehicleNumberError && <small id="vehicle-number-error" className="enquiry-error" role="alert">{vehicleNumberError}</small>}</label>
        <label>Vehicle<select name="vehicleId" required>{driverVehicleOptions.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.label}</option>)}</select></label>
        <label>District<select name="location">{driverDistricts.map((district) => <option key={district}>{district}</option>)}</select></label>
        <NumberStepper label="Passenger seats (excluding driver)" name="seats" min={1} max={60} />
        <PartnerPhotos onChange={(next, loading) => { photoVersion.current++; setPhotos(next); setProcessing(loading) }} />
        <label className="enquiry-honeypot" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
        <label className="review-consent"><input name="publicationConsent" type="checkbox" required /><span>I consent to publishing my full name, masked phone number, masked driving-licence number, driver portrait, vehicle registration, vehicle, base location and passenger seats after AVELOF approval. My age, full phone number and full driving-licence number stay private.</span></label>
        {error && <p className="enquiry-error review-text-field" role="alert">{error}</p>}
        <button type="submit" className="button button-dark" disabled={processing || !photos.length}>{busy ? 'Saving...' : processing ? 'Preparing photos...' : 'Submit driver for approval'}</button>
      </fieldset>
    </form>}
  </section>
}

export function DriverStatusPage() {
  const [driver, setDriver] = useState<z.infer<typeof driverStatusResultSchema> | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const fields = new FormData(event.currentTarget)
    setBusy(true); setError(''); setDriver(null)
    try { setDriver(await lookupDriver(String(fields.get('identifier')), String(fields.get('accessCode')))) }
    catch (failure) { setError(hotelErrorText(failure)) } finally { setBusy(false) }
  }
  return <section className="enquiry-access-page page-width"><Link to="/partners">Partner with AVELOF</Link><h1>Check driver status</h1>
    <form className="review-submission-form" onSubmit={submit}><label>Driver ID or phone number<input name="identifier" maxLength={80} required autoComplete="off" /></label><label>Status access code<input name="accessCode" minLength={5} maxLength={12} required autoComplete="off" /></label><button className="button button-dark" disabled={busy}>Check status</button></form>
    {error && <p className="enquiry-error" role="alert">{error}</p>}
    {driver && <section className="admin-review-record hotel-owner-status"><h2>{driver.fullName}</h2><p>{driver.vehicleName} · {driver.location} · {driver.seats} seats</p><p className="hotel-identifier">{driver.driverId}</p><p role="status">{hotelStatusLabels[driver.status]}</p>{driver.status === 'approved' ? <Link to="/drivers">View driver listing</Link> : <p>Not publicly listed. Contact AVELOF for changes.</p>}</section>}
  </section>
}
function DriverRecord({ driver, disabled, save, remove }: { driver: AdminDriver; disabled: boolean; save: (driver: AdminDriver, status: HotelStatus, price: number, note: string, vehicleNumber: string) => Promise<void>; remove: (driver: AdminDriver) => Promise<void> }) {
  const [status, setStatus] = useState<HotelStatus>(driver.status)
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const fields = new FormData(event.currentTarget); await save(driver, status, Number(fields.get('price')), String(fields.get('ownerNote')), String(fields.get('vehicleNumber'))) }
  return <article className="admin-review-record"><h2>{driver.fullName} · {driver.vehicleName}</h2><p className="hotel-identifier">{driver.driverId} · {hotelStatusLabels[driver.status]}</p><p>Private: age {driver.age}, phone {driver.phone}, licence {driver.licenceNumber}, vehicle registration {driver.vehicleNumber}</p><p>Public listing: {driver.fullName} · {driver.maskedPhone} · {driver.location} · {driver.seats} passenger seats</p><div className="hotel-photo-grid"><a href={driver.photo} target="_blank" rel="noreferrer"><img src={driver.photo} alt={`Portrait of ${driver.fullName}`} /></a></div>
    <form onSubmit={submit} className="review-submission-form"><fieldset className="hotel-form-fields" disabled={disabled}>
      <NumberStepper label="Daily rate (INR)" name="price" min={1} step={100} defaultValue={driver.price} currency />
      <label>Vehicle registration number<input name="vehicleNumber" required defaultValue={driver.vehicleNumber} pattern="JK[0-9]{2}[A-Za-z]{1,2}-[0-9]{4}" placeholder="JK13B-1444 or JK01AB-1485" title="Use JK13B-1444 or JK01AB-1485 format." onBlur={(event) => { event.currentTarget.value = normalizeDriverVehicleNumber(event.currentTarget.value) }} /></label>
      <label>Driver listing status<select value={status} onChange={(event) => setStatus(hotelStatusSchema.parse(event.target.value))}><option value="pending">Awaiting approval</option><option value="approved">Approve and publish</option><option value="rejected">Reject / hide</option></select></label>
      <label className="review-text-field">Note to driver<textarea name="ownerNote" maxLength={1000} defaultValue={driver.ownerNote} /></label><button className="button button-dark">Save driver price and status</button>
    </fieldset></form>
    <button type="button" className="button admin-record-delete" disabled={disabled} onClick={() => void remove(driver)}><Trash2 size={16} /> Delete driver registration</button>
  </article>
}
export function AdminDriversPage() {
  const [listing, setListing] = useState<Awaited<ReturnType<typeof loadAdminDrivers>> | null>(null)
  const [filters, setFilters] = useState<{ page: number; status: HotelStatus | 'all'; revision: number }>({ page: 1, status: 'pending', revision: 0 })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [signedOut, setSignedOut] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const inFlight = useRef(false)
  function refresh(page = filters.page, status = filters.status) { setError(''); setLoading(true); setFilters((current) => ({ page, status, revision: current.revision + 1 })) }
  useEffect(() => {
    const controller = new AbortController()
    loadAdminDrivers(filters.page, filters.status, controller.signal).then((data) => { setListing(data); setSignedOut(false) }).catch((failure: unknown) => { if (!controller.signal.aborted) { setListing(null); if (failure instanceof HotelError && failure.status === 401) setSignedOut(true); else setError(hotelErrorText(failure)) } }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [filters])
  async function save(driver: AdminDriver, status: HotelStatus, price: number, note: string, vehicleNumber: string) {
    if (inFlight.current) return
    inFlight.current = true; setSaving(true); setError('')
    try { await moderateDriver(driver.id, driver.version, status, price, note, vehicleNumber); setNotice('Driver price, vehicle registration and status saved.'); refresh() }
    catch (failure) { if (failure instanceof HotelError && failure.status === 401) { setSignedOut(true); setListing(null) } else setError(hotelErrorText(failure)) }
    finally { setSaving(false); inFlight.current = false }
  }
  async function remove(driver: AdminDriver) {
    if (inFlight.current || !window.confirm(`Permanently delete ${driver.fullName}, the driver photo and linked reviews? This cannot be undone.`)) return
    inFlight.current = true; setSaving(true); setError(''); setNotice('')
    try {
      await deleteDriver(driver.id, driver.version)
      setNotice('Driver registration permanently deleted.')
      refresh(listing?.drivers.length === 1 && filters.page > 1 ? filters.page - 1 : filters.page)
    } catch (failure) {
      if (failure instanceof HotelError && failure.status === 401) { setSignedOut(true); setListing(null) }
      else setError(hotelErrorText(failure))
    } finally { setSaving(false); inFlight.current = false }
  }
  return <section className="enquiry-access-page page-width"><h1>Driver registrations</h1>
    {signedOut ? <p><Link to="/admin/panel">Sign in to the owner dashboard</Link> to manage drivers.</p> : <>
      <nav className="admin-section-nav" aria-label="Owner sections"><Link to="/admin/panel">Enquiries</Link><Link to="/admin/panel/reviews">Reviews</Link><Link to="/admin/panel/hotels">Hotels</Link><span aria-current="page">Drivers</span></nav><OwnerPushNotifications />
      <p>Verify driver identity, licence validity, commercial eligibility, vehicle permits, insurance, photos and rates before approval. Do not publish licence numbers, contacts or readable plates.</p>
      <div className="admin-enquiry-toolbar"><label>Driver status<select disabled={loading || saving} value={filters.status} onChange={(event) => refresh(1, event.target.value === 'all' ? 'all' : hotelStatusSchema.parse(event.target.value))}><option value="pending">Awaiting approval</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="all">All</option></select></label><button className="button button-outline" disabled={loading || saving} onClick={() => refresh()}>Refresh drivers</button></div>
      {loading && <p role="status">Loading drivers...</p>}{error && <p role="alert" className="enquiry-error">{error}</p>}{notice && <p role="status">{notice}</p>}
      <div className="admin-review-list">{listing?.drivers.map((driver) => <DriverRecord key={`${driver.id}-${driver.version}`} driver={driver} disabled={loading || saving} save={save} remove={remove} />)}</div>
      {!loading && !error && !listing?.total && <p>No drivers in this view.</p>}
      {listing && <div className="admin-enquiry-pagination"><span>Page {filters.page} · {listing.total} drivers</span><button disabled={loading || saving || filters.page === 1} onClick={() => refresh(filters.page - 1)}>Previous</button><button disabled={loading || saving || filters.page * 25 >= listing.total} onClick={() => refresh(filters.page + 1)}>Next</button></div>}
    </>}
  </section>
}
