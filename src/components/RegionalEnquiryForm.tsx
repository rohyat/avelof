import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowRight } from 'lucide-react'
import BookingModal from './BookingModal'
import DateInput from './DateInput'
import SubmissionProgress from './SubmissionFeedback'
import { prepareRequest, saveEnquiry } from '../services/bookingService'
import { enquirySchema } from '../services/enquirySchema'
import { indianPhoneNumber } from '../services/phoneNumbers'
import type { BookingKind, BookingPayload, PreparedRequest } from '../types'
import type { Region } from '../data/regions'

export default function RegionalEnquiryForm({ region, kind = 'contact', preference = 'General travel enquiry', initialDetails }: { region: Region; kind?: BookingKind; preference?: string; initialDetails?: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [receipt, setReceipt] = useState<PreparedRequest | null>(null)
  const [start, setStart] = useState('')
  const pending = useRef<{ fingerprint: string; request: PreparedRequest } | null>(null)
  const inFlight = useRef(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current) return
    const form = new FormData(event.currentTarget)
    const fields: Record<string, string> = {
      region, fullName: String(form.get('fullName') ?? ''),
      phoneNumber: indianPhoneNumber(String(form.get('phoneNumber') ?? '')),
      adults: String(form.get('adults') ?? ''), children: String(form.get('children') ?? ''),
      packagePreference: preference, customDetails: String(form.get('customDetails') ?? ''),
    }
    if (kind === 'car') Object.assign(fields, { carRental: preference, startDate: start, endDate: String(form.get('endDate') ?? '') })
    if (kind === 'package') Object.assign(fields, { arrivalDate: start, departureDate: String(form.get('endDate') ?? '') })
    const payload: BookingPayload = { kind, fields }
    const request = prepareRequest(payload)
    const parsed = enquirySchema.safeParse({ ...payload, reference: request.reference, website: String(form.get('website') ?? '') })
    if (!parsed.success) { setError(parsed.error.issues.map((issue) => issue.message).join(' ')); return }
    const fingerprint = JSON.stringify(payload)
    if (pending.current?.fingerprint !== fingerprint) pending.current = { fingerprint, request }
    inFlight.current = true
    setBusy(true)
    setError('')
    try { setReceipt(await saveEnquiry(payload, pending.current.request, parsed.data.website)) }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Your enquiry could not be saved. Please try again or call AVELOF.') }
    finally { inFlight.current = false; setBusy(false) }
  }

  return <>
    <form className="enquiry-form ladakh-enquiry" onSubmit={submit} aria-busy={busy}>
      <h2>Send a {region} enquiry.</h2><p>{preference}. Tell us your requirements; prices and availability need confirmation.</p>
      {busy && <SubmissionProgress title="Saving your enquiry">Please wait for the database response. This does not confirm a booking.</SubmissionProgress>}
      <fieldset disabled={busy}>
        <label className="enquiry-honeypot" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
        <div className="form-grid">
          <label>Name<input name="fullName" autoComplete="name" required maxLength={100} /></label>
          <label>Phone number<input name="phoneNumber" type="tel" autoComplete="tel" required maxLength={25} placeholder="10-digit Indian phone number" /></label>
          <label>Adults<input name="adults" type="number" min={1} max={100} defaultValue={2} required /></label>
          <label>Children<input name="children" type="number" min={0} max={100} defaultValue={0} required /></label>
          {kind !== 'contact' && <><label>Start date<DateInput name="startDate" value={start} onChange={(event) => setStart(event.target.value)} required /></label><label>End date<DateInput name="endDate" min={start || undefined} required /></label></>}
        </div>
        <label>Dates, route and requirements<textarea name="customDetails" rows={4} maxLength={20000} defaultValue={initialDetails} placeholder="Starting point, dates, preferred stays and anything you would like us to know" /></label>
        {error && <p className="enquiry-error" role="alert">{error}</p>}
        <button className="button button-dark" type="submit">{busy ? 'Saving enquiry...' : 'Submit enquiry'}<ArrowRight size={17} aria-hidden="true" /></button>
        <p className="privacy-note">By submitting, you agree that AVELOF may store these details, show your selected service and dates with masked contact details in booking lookup, and contact you about your enquiry. This is not a confirmed booking.</p>
      </fieldset>
    </form>
    {receipt && <BookingModal kind={kind} region={region} initialRequest={receipt} onClose={() => setReceipt(null)} />}
  </>
}
