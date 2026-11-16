import { useState } from 'react'
import type { FormEvent } from 'react'
import { usePricing } from '../services/pricingContext'
import { pricingSettingsSchema } from '../services/pricingSchema'
import { hotelErrorText, requestHotel } from '../services/hotelService'

export default function AdminPricing() {
  const { settings, loading, error, reload, saved } = usePricing()
  const [busy, setBusy] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [notice, setNotice] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!settings || busy || loading || error) return
    const input = pricingSettingsSchema.safeParse({ discountPercent: Number(new FormData(event.currentTarget).get('discountPercent')), version: settings.version })
    if (!input.success) { setSaveError('Enter a discount from 0 to 100%, with at most two decimal places.'); return }
    setBusy(true); setSaveError(''); setNotice('')
    try {
      const next = pricingSettingsSchema.parse(await requestHotel('/api/pricing', 'PATCH', input.data))
      saved(next)
      setNotice(`Saved ${next.discountPercent}% discount for hotels and packages. Cabs are unchanged.`)
    } catch (failure) { setSaveError(hotelErrorText(failure)) }
    finally { setBusy(false) }
  }
  return <section className="admin-review-record" aria-labelledby="admin-pricing-title">
    <h2 id="admin-pricing-title">Hotel &amp; package discount</h2>
    <p>Hotel regular room rates are the tax-exclusive reviewed hotel rates plus 45%, rounded up to whole rupees. Package regular prices: Deluxe INR 22,000/person; Premium INR 36,000/person. The saved discount applies to these rates everywhere. Optional hotel meal add-ons are not discounted. Hotel-specific confirmed GST is added after the discount and selected meals. Reconfirm each hotel's GST if a discount changes its applicable tax treatment. All cab prices and discounts are unchanged.</p>
    {loading ? <p role="status">Loading discount settings...</p> : error || !settings ? <p role="alert" className="enquiry-error">{error || 'Pricing settings are unavailable.'}</p> : <form key={settings.version} onSubmit={submit}>
      <label>Hotel and package discount (%)<input type="number" name="discountPercent" required min={0} max={100} step="0.01" defaultValue={settings.discountPercent} disabled={busy} /></label>
      <button className="button button-dark" type="submit" disabled={busy}>{busy ? 'Saving discount...' : 'Save hotel and package discount'}</button>
    </form>}
    <button className="text-link" type="button" disabled={busy || loading} onClick={() => { setNotice(''); setSaveError(''); reload() }}>Reload current discount</button>
    {saveError && <p role="alert" className="enquiry-error">{saveError}</p>}
    {notice && <p role="status">{notice}</p>}
  </section>
}
