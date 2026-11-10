import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowLeft, Check, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, LockKeyhole, LogOut, RefreshCw, Save, Search } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { business } from '../config'
import { EnquiryAccessError, loadAdminEnquiries, lookupBookingSummaries, signInAdmin, signOutAdmin, updateBookingStatus } from '../services/enquiryAccessService'
import { indianPhoneNumber } from '../services/phoneNumbers'
import { requestedBooking } from '../services/bookingDetails'
import type { BookingStatus, BookingSummary, EnquirySummary } from '../types'

const typeLabels = { package: 'Tour package', hotel: 'Hotel', car: 'Cab', contact: 'General' }
const packageLabels: Record<string, string> = { DLX: 'Deluxe package', PRM: 'Premium package', CSTM: 'Customized package' }
const statusLabels = { received: 'Booked (request)', booked: 'Confirmed', running: 'Running', completed: 'Completed' }
const statusSteps: BookingStatus[] = ['received', 'booked', 'running', 'completed']
const statusMessages = {
  received: 'Your booking request is recorded. AVELOF has not yet confirmed availability.',
  booked: 'Your booking has been marked Confirmed by AVELOF.',
  running: 'Your journey is in progress.',
  completed: 'Your journey has been marked Completed by AVELOF.',
}

function receivedDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function errorText(error: unknown) {
  return error instanceof EnquiryAccessError ? error.message : 'Could not load enquiries. Please try again.'
}

function requestedDate(value: string | null) {
  if (!value) return 'Not provided'
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'UTC' }).format(date) : value
}

function EnquiryDetails({ enquiry }: { enquiry: EnquirySummary }) {
  const requested = requestedBooking(enquiry.kind, enquiry.fields)
  return <div className="enquiry-summary">
    <div className="enquiry-summary-meta"><strong>{enquiry.reference}</strong><span className={`enquiry-status status-${enquiry.status}`}>{statusLabels[enquiry.status]}</span></div>
    <p className="privacy-note">{typeLabels[enquiry.kind]} request submitted {receivedDate(enquiry.createdAt)}. {enquiry.status === 'received' ? 'This is not a confirmed booking.' : 'Booking status managed by AVELOF.'}</p>
    <section className="admin-trip-overview" aria-label="Requested booking details">
      <h3>{requested.type}</h3>
      <dl><div><dt>{enquiry.kind === 'hotel' ? 'Hotel' : enquiry.kind === 'car' ? 'Cab' : 'Package'}</dt><dd>{requested.name}</dd></div><div><dt>{requested.startLabel}</dt><dd>{requestedDate(requested.startDate)}</dd></div><div><dt>{requested.endLabel}</dt><dd>{requestedDate(requested.endDate)}</dd></div></dl>
    </section>
    <dl className="enquiry-detail-list">{Object.entries(enquiry.fields).filter(([, value]) => value.trim()).map(([label, value]) => <div key={label} className={value.includes('\n') || value.length > 150 ? 'enquiry-detail-wide' : ''}><dt>{label.replaceAll(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase())}</dt><dd>{value}</dd></div>)}</dl>
  </div>
}

function BookingOverview({ booking }: { booking: BookingSummary }) {
  const activeStep = statusSteps.indexOf(booking.status)
  const packageLabel = booking.kind === 'package' ? packageLabels[booking.reference.split('_')[1]] : undefined
  const requested = booking.bookingDetails
  return <section className="booking-overview" aria-label="Booking summary">
    <div className="booking-overview-heading"><div><p className="eyebrow">{packageLabel ?? `${typeLabels[booking.kind]} enquiry`}</p><h2>{booking.reference}</h2></div><span className={`enquiry-status status-${booking.status}`}>{statusLabels[booking.status]}</span></div>
    <section className="customer-trip-overview" aria-label="Requested booking details">
      <h3>{requested.type}</h3>
      <dl><div className="customer-trip-selection"><dt>{booking.kind === 'hotel' ? 'Hotel name' : booking.kind === 'car' ? 'Cab name' : 'Package name'}</dt><dd>{requested.name}</dd></div><div><dt>{requested.startLabel}</dt><dd>{requestedDate(requested.startDate)}</dd></div><div><dt>{requested.endLabel}</dt><dd>{requestedDate(requested.endDate)}</dd></div></dl>
    </section>
    <ol className="booking-progress" aria-label="Booking progress">{statusSteps.map((status, index) => <li key={status} className={index < activeStep ? 'is-complete' : index === activeStep ? 'is-current' : ''} aria-current={index === activeStep ? 'step' : undefined}><span className="booking-step-mark">{index < activeStep ? <Check size={16} /> : index + 1}</span><span>{status === 'received' ? 'Booked' : statusLabels[status]}</span></li>)}</ol>
    <p className="booking-status-message">{statusMessages[booking.status]}</p>
    <dl className="booking-masked-identity"><div><dt>Name</dt><dd>{booking.maskedName}</dd></div><div><dt>Phone number</dt><dd>{booking.maskedPhone}</dd></div></dl>
  </section>
}

export default function EnquiriesPage() {
  const navigate = useNavigate()
  const [initialReference] = useState(() => {
    const parameters = new URLSearchParams(window.location.hash.slice(1))
    return parameters.get('reference') ?? ''
  })
  const [identifier, setIdentifier] = useState(initialReference)
  const [loadedIdentifier, setLoadedIdentifier] = useState('')
  const [bookings, setBookings] = useState<BookingSummary[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState('')
  const [busy, setBusy] = useState(Boolean(initialReference))
  const [error, setError] = useState('')

  useEffect(() => {
    if (!window.location.hash) return
    navigate('/my-enquiries', { replace: true })
    if (!initialReference) return
    const controller = new AbortController()
    lookupBookingSummaries(initialReference, controller.signal)
      .then((found) => { setBookings(found); setLoadedIdentifier(initialReference) })
      .catch((failure: unknown) => { if (!controller.signal.aborted) setError(errorText(failure)) })
      .finally(() => { if (!controller.signal.aborted) setBusy(false) })
    return () => controller.abort()
  }, [initialReference, navigate])

  useEffect(() => {
    if (!loadedIdentifier) return
    const controller = new AbortController()
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      lookupBookingSummaries(loadedIdentifier, controller.signal).then((updated) => {
        setBookings(updated)
        setRefreshError('')
      }).catch((failure: unknown) => { if (!controller.signal.aborted) setRefreshError(errorText(failure)) })
    }, 120000)
    return () => { controller.abort(); window.clearInterval(timer) }
  }, [loadedIdentifier])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || refreshing) return
    setBusy(true)
    setError('')
    setBookings([])
    setLoadedIdentifier('')
    setRefreshError('')
    try {
      const requested = indianPhoneNumber(identifier) || identifier.trim().toUpperCase()
      const found = await lookupBookingSummaries(requested)
      setBookings(found)
      setLoadedIdentifier(requested)
    } catch (failure) { setError(errorText(failure)) }
    finally { setBusy(false) }
  }

  async function refreshStatus() {
    if (!loadedIdentifier || refreshing || busy) return
    setRefreshing(true)
    setRefreshError('')
    try {
      const updated = await lookupBookingSummaries(loadedIdentifier)
      setBookings(updated)
    } catch (failure) { setRefreshError(errorText(failure)) }
    finally { setRefreshing(false) }
  }

  return <section className="enquiry-access-page page-width">
    <Link className="text-link" to="/"><ArrowLeft size={16} /> Home</Link>
    <div className="enquiry-access-heading"><ClipboardList size={28} /><div><p className="eyebrow">Your AVELOF journey</p><h1>Check your bookings</h1></div></div>
    <div className="enquiry-access-layout">
      <div className="booking-lookup-panel"><form className="enquiry-lookup-form" onSubmit={submit} aria-busy={busy}>
        <label className="full-field">Booking ID or phone number<input value={identifier} onChange={(event) => setIdentifier(event.target.value)} onBlur={(event) => { const phone = indianPhoneNumber(event.target.value); if (phone) setIdentifier(phone) }} required maxLength={40} autoComplete="off" spellCheck={false} placeholder="Booking ID or 10-digit phone number" /></label>
        <button className="button button-dark" disabled={busy || refreshing} type="submit"><Search size={17} /> {busy ? 'Checking...' : 'View bookings'}</button>
      </form>
        {error && <p className="enquiry-error" role="alert">{error}</p>}
      </div>
      <div className="customer-enquiry-result" aria-live="polite">{bookings.length ? <>
        <div className="booking-result-toolbar"><span>{bookings.length === 1 ? 'Booking request' : `${bookings.length} booking requests`}</span><button className="icon-button" onClick={refreshStatus} disabled={refreshing || busy} title="Refresh booking status" aria-label="Refresh booking status"><RefreshCw size={18} /></button></div>
        <div className="booking-results-list">{bookings.map((booking) => <BookingOverview key={booking.reference} booking={booking} />)}</div>
        {refreshError && <p className="enquiry-error" role="alert">{refreshError}</p>}
      </> : <div className="enquiry-empty"><ClipboardList size={30} /><h2>Your journey, at a glance.</h2><p>Requests are not confirmed until AVELOF checks availability and marks them Confirmed.</p></div>}</div>
    </div>
  </section>
}

function BookingStatusEditor({ enquiry, onSaved }: { enquiry: EnquirySummary; onSaved: (updated: EnquirySummary) => void }) {
  const [status, setStatus] = useState(enquiry.status)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || status === enquiry.status) return
    setBusy(true)
    setError('')
    try { onSaved(await updateBookingStatus(enquiry.reference, status, enquiry.statusVersion)) }
    catch (failure) { setError(errorText(failure)) }
    finally { setBusy(false) }
  }

  return <form className="booking-status-editor" onSubmit={save} aria-busy={busy}>
    <label className="full-field">Booking status<select value={status} onChange={(event) => setStatus(event.target.value as BookingStatus)} disabled={busy}>{statusSteps.map((step) => <option key={step} value={step}>{statusLabels[step]}</option>)}</select></label>
    <button className="button button-dark" type="submit" disabled={busy || status === enquiry.status}><Save size={16} /> {busy ? 'Saving...' : 'Save status'}</button>
    {enquiry.statusUpdatedAt && <p className="privacy-note">Updated {receivedDate(enquiry.statusUpdatedAt)}</p>}
    {error && <p className="enquiry-error" role="alert">{error}</p>}
  </form>
}

export function AdminEnquiriesPage() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const [username, setUsername] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [records, setRecords] = useState<EnquirySummary[]>([])
  const [total, setTotal] = useState(0)
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState({ page: 1, status: '', reference: '' })
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    loadAdminEnquiries(filters, controller.signal).then((listing) => {
      setSignedIn(true)
      setRecords(listing.enquiries)
      setTotal(listing.total)
    }).catch((failure: unknown) => {
      if (controller.signal.aborted) return
      setRecords([])
      setTotal(0)
      if (failure instanceof EnquiryAccessError && failure.status === 401) setSignedIn(false)
      else { setSignedIn(false); setError(errorText(failure)) }
    }).finally(() => { if (!controller.signal.aborted) setBusy(false) })
    return () => controller.abort()
  }, [filters])

  function reload(nextFilters: typeof filters) {
    setBusy(true)
    setError('')
    setFilters(nextFilters)
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try { await signInAdmin(indianPhoneNumber(username) || username.trim(), code); setCode(''); setSignedIn(true); reload({ page: 1, status: '', reference: '' }) }
    catch (failure) { setError(errorText(failure)); setBusy(false) }
  }

  async function logout() {
    setBusy(true)
    setError('')
    try { await signOutAdmin(); setSignedIn(false); setRecords([]); setTotal(0); setCode('') }
    catch (failure) { setError(errorText(failure)) }
    finally { setBusy(false) }
  }

  function statusSaved(updated: EnquirySummary) {
    setNotice(`${updated.reference} marked ${statusLabels[updated.status]}.`)
    reload({ ...filters })
  }

  return <section className="enquiry-access-page admin-enquiries-page page-width">
    <Link className="text-link" to="/my-enquiries"><ArrowLeft size={16} /> Check bookings</Link>
    <div className="enquiry-access-heading"><LockKeyhole size={28} /><div><p className="eyebrow">AVELOF owner access</p><h1>{signedIn ? 'Enquiry dashboard' : 'Owner sign-in'}</h1></div></div>
    {error && <p className="enquiry-error" role="alert">{error}</p>}
    {signedIn && notice && <p className="booking-admin-notice" role="status">{notice}</p>}
    {signedIn === null ? <p role="status">Checking your session...</p> : !signedIn ? <form className="enquiry-lookup-form admin-login-form" onSubmit={login} aria-busy={busy}>
      <label className="full-field">Business phone number<input type="tel" inputMode="tel" value={username} onChange={(event) => setUsername(event.target.value)} onBlur={(event) => { const phone = indianPhoneNumber(event.target.value); if (phone) setUsername(phone) }} required maxLength={25} autoComplete="username" placeholder={indianPhoneNumber(business.phone)} /></label>
      <label className="full-field">Password<input type="password" value={code} onChange={(event) => setCode(event.target.value)} required maxLength={256} autoComplete="current-password" /></label>
      <button className="button button-dark" disabled={busy} type="submit"><LockKeyhole size={17} /> {busy ? 'Signing in...' : 'Sign in'}</button>
    </form> : <>
      <nav className="admin-section-nav" aria-label="Owner sections"><span aria-current="page">Enquiries</span><Link to="/admin/panel/reviews">Reviews</Link></nav>
      <div className="admin-enquiry-toolbar">
        <strong>{total} {total === 1 ? 'enquiry' : 'enquiries'}</strong>
        <form className="admin-enquiry-search" onSubmit={(event) => { event.preventDefault(); reload({ ...filters, reference: query.trim().toUpperCase(), page: 1 }) }}>
          <label className="full-field"><span className="sr-only">Search booking enquiry ID</span><input value={query} onChange={(event) => setQuery(event.target.value.toUpperCase())} maxLength={40} pattern="[A-Z0-9_]*" placeholder="Booking enquiry ID" disabled={busy} /></label>
          <button type="submit" className="icon-button" title="Search by enquiry ID" aria-label="Search by enquiry ID" disabled={busy}><Search size={19} /></button>
        </form>
        <label className="full-field admin-status-filter"><span className="sr-only">Filter by status</span><select value={filters.status} onChange={(event) => reload({ ...filters, status: event.target.value, page: 1 })} disabled={busy}><option value="">All statuses</option>{statusSteps.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></label>
        <button className="icon-button" title="Refresh enquiries" aria-label="Refresh enquiries" disabled={busy} onClick={() => reload({ ...filters })}><RefreshCw size={19} /></button>
        <button className="button confirmation-close" disabled={busy} onClick={logout}><LogOut size={17} /> Sign out</button>
      </div>
      {busy && <p role="status">Loading enquiries...</p>}
      <div className="admin-enquiry-list">{records.map((record) => <details className="admin-enquiry-record" key={record.reference}>
        <summary><span><strong>{record.reference}</strong><small>{typeLabels[record.kind]}</small></span><span>{record.fields.fullName}<small>{record.fields.phoneNumber}</small></span><time dateTime={record.createdAt}>{receivedDate(record.createdAt)}</time><span className={`enquiry-status status-${record.status}`}>{statusLabels[record.status]}</span><ChevronDown size={18} /></summary>
        <EnquiryDetails enquiry={record} />
        <BookingStatusEditor key={`${record.reference}:${record.statusVersion}`} enquiry={record} onSaved={statusSaved} />
      </details>)}</div>
      {!records.length && !busy && <p className="enquiry-empty" role="status">No enquiries match these filters.</p>}
      <div className="admin-enquiry-pagination"><span>{total ? `${(filters.page - 1) * 25 + 1}-${Math.min(filters.page * 25, total)} of ${total}` : '0 enquiries'}</span><button className="icon-button" title="Previous page" aria-label="Previous page" disabled={busy || filters.page <= 1} onClick={() => reload({ ...filters, page: filters.page - 1 })}><ChevronLeft size={20} /></button><button className="icon-button" title="Next page" aria-label="Next page" disabled={busy || filters.page * 25 >= total} onClick={() => reload({ ...filters, page: filters.page + 1 })}><ChevronRight size={20} /></button></div>
    </>}
  </section>
}