import { useEffect, useState } from 'react'
import { Download, FileCheck2, ImagePlus, ReceiptText, Share2, ShieldCheck, Users, Wallet } from 'lucide-react'
import { buildPaymentReceiptPdf, paymentReceiptFilename, paymentReceiptSchema, perPersonPricingSchema, receiptBalance, receiptTotalForPersons } from '../services/paymentReceipt'
import { advanceReceiptSequence, nextReceiptSequence, receiptNumberFor } from '../services/receiptSequence'
import { readReceiptScreenshot } from '../services/receiptScreenshot'
import { canSharePdf, downloadPdf, pdfFile, sharePdf } from '../services/pdfSharing'

export default function PaymentReceiptBuilder() {
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [title, setTitle] = useState('')
  const [total, setTotal] = useState('')
  const [pricingMode, setPricingMode] = useState<'total' | 'per-person'>('total')
  const [pricePerPerson, setPricePerPerson] = useState('')
  const [persons, setPersons] = useState('2')
  const [receiptDate, setReceiptDate] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  })
  const [received, setReceived] = useState('0')
  const [paymentMethod, setPaymentMethod] = useState('Bank transfer')
  const [transactionReference, setTransactionReference] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [downloaded, setDownloaded] = useState('')
  const [screenshot, setScreenshot] = useState<string | undefined>()
  const [imageBusy, setImageBusy] = useState(false)
  const [generated, setGenerated] = useState<{ file: File; fingerprint: string; number: string; url: string } | null>(null)
  const [counter, setCounter] = useState(() => {
    try { return { value: nextReceiptSequence(localStorage), error: '' } }
    catch (failure) {
      console.error('Receipt numbering failed', failure)
      return { value: 1050, error: failure instanceof Error ? failure.message : 'Could not read local receipt numbering.' }
    }
  })
  const receiptNumber = receiptNumberFor(Number(receiptDate.slice(0, 4)), counter.value)
  const pricing = perPersonPricingSchema.safeParse({ pricePerPerson: pricePerPerson.trim() ? Number(pricePerPerson) : NaN, persons: persons.trim() ? Number(persons) : NaN })
  const input = { guestName, guestPhone, title, total: pricingMode === 'per-person' ? pricing.success ? receiptTotalForPersons(pricing.data.pricePerPerson, pricing.data.persons) : NaN : total.trim() ? Number(total) : NaN, received: received.trim() ? Number(received) : NaN, receiptNumber, receiptDate, paymentMethod, transactionReference, screenshot,
    perPersonPricing: pricingMode === 'per-person' && pricing.success ? pricing.data : undefined }
  const fingerprint = JSON.stringify({ ...input, receiptNumber: undefined })
  const validation = paymentReceiptSchema.safeParse(input)
  const dirty = Boolean(guestName || guestPhone || title || total || pricePerPerson || transactionReference || screenshot || received !== '0') && downloaded !== fingerprint
  const current = generated?.fingerprint === fingerprint ? generated : null
  const amountsValid = Number.isFinite(input.total) && input.total >= 0 && Number.isFinite(input.received) && input.received >= 0 && input.received <= input.total
  const money = (value: number) => `INR ${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  useEffect(() => () => { if (generated) URL.revokeObjectURL(generated.url) }, [generated])
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  async function generate() {
    if (busy || imageBusy) return
    if (!validation.success) { setError(validation.error.issues[0]?.message ?? 'Check the receipt details.'); return }
    setBusy(true); setError('')
    try {
      if (!navigator.locks) throw new Error('This browser cannot safely coordinate local receipt numbering. Use a current browser on HTTPS.')
      await navigator.locks.request('avelof-receipt-number', async () => {
        const sequence = nextReceiptSequence(localStorage)
        const number = receiptNumberFor(Number(receiptDate.slice(0, 4)), sequence)
        const pdf = await buildPaymentReceiptPdf({ ...validation.data, receiptNumber: number })
        const file = pdfFile(pdf.output('blob'), paymentReceiptFilename(number))
        advanceReceiptSequence(localStorage, sequence)
        setCounter({ value: sequence + 1, error: '' })
        setGenerated({ file, fingerprint, number, url: URL.createObjectURL(file) })
        setDownloaded('')
      })
    } catch (failure) {
      console.error('Payment receipt generation failed', failure)
      setError(failure instanceof Error ? failure.message : 'Could not generate the payment receipt. Please retry.')
    } finally { setBusy(false) }
  }
  async function share() {
    if (!current || busy) return
    setBusy(true); setError('')
    try { if (await sharePdf(current.file)) setDownloaded(fingerprint) }
    catch (failure) {
      console.error('Payment receipt sharing failed', failure)
      setError(failure instanceof Error ? failure.message : 'Could not share the payment receipt. Try Download instead.')
    } finally { setBusy(false) }
  }
  async function upload(file: File | undefined) {
    if (!file) return
    setScreenshot(undefined); setImageBusy(true); setError('')
    try { setScreenshot(await readReceiptScreenshot(file)) }
    catch (failure) {
      console.error('Payment screenshot failed', failure)
      setError(failure instanceof Error ? failure.message : 'Could not read the payment screenshot.')
    } finally { setImageBusy(false) }
  }
  function startNew() {
    if (dirty && !window.confirm('Start a new receipt? Download or share the current receipt first if you need it. Guest details and screenshot will be cleared.')) return
    setGuestName(''); setGuestPhone(''); setTitle(''); setTotal(''); setReceived('0')
    setPricingMode('total'); setPricePerPerson(''); setPersons('2')
    setTransactionReference(''); setScreenshot(undefined); setGenerated(null); setDownloaded(''); setError('')
    try { setCounter({ value: nextReceiptSequence(localStorage), error: '' }) }
    catch (failure) {
      console.error('Receipt numbering failed', failure)
      setCounter(current => ({ ...current, error: failure instanceof Error ? failure.message : 'Could not read local receipt numbering.' }))
    }
  }

  return <section className="payment-workspace" aria-labelledby="payment-receipt-title">
    <header className="payment-workspace-heading">
      <div className="payment-heading-icon"><ReceiptText size={28} /></div>
      <div><p className="eyebrow">PAYMENTS, MADE CLEAR</p><h2 id="payment-receipt-title">Payment receipt</h2><p>A polished record for every journey. Add your guest, record the payment and prepare a branded PDF.</p></div>
      <span className="payment-private-badge"><ShieldCheck size={16} /> Browser-only &amp; private</span>
    </header>
    <div className="payment-workspace-grid">
      <fieldset className="receipt-fields payment-form" disabled={busy || imageBusy}>
        <legend className="sr-only">Receipt details</legend>
        <section className="payment-form-card">
          <h3><Users size={19} /><span>01</span> Guest &amp; journey</h3>
          <div className="itinerary-fields">
            <label>Guest name<input maxLength={60} autoComplete="off" placeholder="Guest's full name" value={guestName} onChange={event => setGuestName(event.target.value)} /></label>
            <label>Guest phone number<input type="tel" maxLength={25} autoComplete="off" placeholder="+91 98765 43210" value={guestPhone} onChange={event => setGuestPhone(event.target.value)} /></label>
            <label className="payment-full-width">Trip / package<input maxLength={80} placeholder="e.g. Kashmir family holiday" value={title} onChange={event => setTitle(event.target.value)} /></label>
            <label>Receipt number<input readOnly value={current?.number ?? (counter.error ? '' : receiptNumber)} /></label>
            <label>Receipt date<input type="date" value={receiptDate} onChange={event => setReceiptDate(event.target.value)} /></label>
          </div>
        </section>
        <section className="payment-form-card">
          <h3><Wallet size={19} /><span>02</span> Pricing &amp; payment</h3>
          <div className="payment-pricing-toggle" role="group" aria-label="Pricing basis">
            <button type="button" aria-pressed={pricingMode === 'total'} onClick={() => setPricingMode('total')}>Enter total amount</button>
            <button type="button" aria-pressed={pricingMode === 'per-person'} onClick={() => setPricingMode('per-person')}>Per person &times; guests</button>
          </div>
          <div className="itinerary-fields">
            {pricingMode === 'per-person' && <>
              <label>Price per person (INR)<input type="number" min={0} max={1000000000} step="0.01" placeholder="e.g. 15,000" value={pricePerPerson} onChange={event => setPricePerPerson(event.target.value)} /></label>
              <label>Number of persons<input type="number" min={1} max={100} step={1} value={persons} onChange={event => setPersons(event.target.value)} /></label>
            </>}
            <label className="payment-full-width">Total payment (INR)<input type="number" min={0} max={1000000000} step="0.01" placeholder="Agreed total for this journey" readOnly={pricingMode === 'per-person'} value={pricingMode === 'per-person' ? Number.isFinite(input.total) ? String(input.total) : '' : total} onChange={event => setTotal(event.target.value)} /></label>
            {pricingMode === 'per-person' && pricing.success && <p className="payment-calculation payment-full-width">{money(pricing.data.pricePerPerson)} &times; {pricing.data.persons} persons = {money(input.total)}</p>}
            <label>Payment received (INR)<input type="number" min={0} max={Number.isFinite(input.total) ? input.total : undefined} step="0.01" value={received} onChange={event => setReceived(event.target.value)} /></label>
            <label>Payment method<select value={paymentMethod} onChange={event => setPaymentMethod(event.target.value)}>{['Bank transfer', 'UPI', 'Cash', 'Card', 'Other'].map(method => <option key={method}>{method}</option>)}</select></label>
            <label className="payment-full-width">Transaction reference (optional)<input maxLength={100} placeholder="UPI / bank reference or payment ID" value={transactionReference} onChange={event => setTransactionReference(event.target.value)} /></label>
          </div>
        </section>
        <section className="payment-form-card">
          <h3><ImagePlus size={19} /><span>03</span> Payment evidence</h3>
          <label className="payment-upload"><span>Payment screenshot (optional)</span><span>PNG, JPEG or WebP &middot; up to 5 MB</span><input aria-label="Payment screenshot (optional)" type="file" accept="image/png,image/jpeg,image/webp" onChange={event => { void upload(event.target.files?.[0]); event.target.value = '' }} /></label>
          <p>Shown beside the payment details on page one. Never uploaded to a server or saved in browser storage.</p>
          {imageBusy && <p role="status">Preparing screenshot...</p>}
          {screenshot && <button type="button" className="text-link" onClick={() => setScreenshot(undefined)}>Remove screenshot</button>}
        </section>
      </fieldset>
      <aside className="payment-overview" aria-label="Receipt overview">
        <div className="payment-overview-heading"><FileCheck2 size={23} /><div><h3>Your receipt overview</h3><p>{current?.number ?? (counter.error ? 'Numbering unavailable' : receiptNumber)}</p></div><span>{current ? 'Ready' : 'Draft'}</span></div>
        <div className="payment-guest-summary"><strong>{guestName || 'Guest name'}</strong><span>{title || 'Your trip / package'}</span><span>{guestPhone || 'Guest phone number'}</span></div>
        <div className="receipt-summary" aria-live="polite">
          <div className="receipt-total"><span>Total payment</span><strong>{amountsValid ? money(input.total) : 'Enter amount'}</strong></div>
          <div className="receipt-received"><span>Payment received</span><strong>{amountsValid ? money(input.received) : 'Check amounts'}</strong></div>
          <div className="receipt-pending"><span>Pending payment</span><strong>{amountsValid ? money(receiptBalance(input.total, input.received)) : 'Check amounts'}</strong></div>
        </div>
        {amountsValid && input.total > 0 && <div className="payment-progress"><label htmlFor="payment-progress">Received {Math.round(input.received / input.total * 100)}% of total</label><progress id="payment-progress" value={input.received} max={input.total} /></div>}
        {screenshot && <div className="payment-evidence-preview"><span>Attached payment screenshot</span><img className="receipt-screenshot" src={screenshot} alt="Payment screenshot to include in receipt" /></div>}
        <div className="payment-export">
          {(error || counter.error) && <p className="enquiry-error" role="alert">{error || counter.error}</p>}
          {!current && <button type="button" className="button button-dark" disabled={busy || imageBusy} onClick={generate}><FileCheck2 size={18} />{busy ? 'Building receipt...' : 'Generate payment receipt'}</button>}
          {current && <>
            <p role="status">Receipt ready: {current.file.name}</p>
            <button type="button" className="button button-dark" disabled={busy} onClick={share}><Share2 size={18} />{busy ? 'Sharing...' : 'Share payment receipt PDF'}</button>
            <button type="button" className="button button-outline" disabled={busy} onClick={() => { downloadPdf(current.file); setDownloaded(fingerprint) }}><Download size={18} /> Download payment receipt PDF</button>
            {!canSharePdf(current.file) && <p>This browser has no PDF share menu. Open this page in a supported mobile browser to share without downloading. Tap Share for details.</p>}
            <a className="text-link" href={current.url} target="_blank" rel="noreferrer">Preview receipt PDF</a>
          </>}
          {downloaded === fingerprint && <p role="status">Receipt exported. No payment history is stored.</p>}
          <button type="button" className="text-link" disabled={busy || imageBusy} onClick={startNew}>New payment receipt</button>
        </div>
        <p className="payment-fine-print">An owner-entered payment record, not a booking confirmation or tax invoice. Receipt numbers advance on generation and stay in this browser; clearing browser data or using another device can repeat numbers.</p>
      </aside>
    </div>
  </section>
}
