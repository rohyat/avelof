import { useState } from 'react'
import type { FormEvent } from 'react'
import { usePricing } from '../services/pricingContext'
import { pricingSettingsSchema } from '../services/pricingSchema'
import { hotelErrorText, requestHotel } from '../services/hotelService'
import { PricingNotice } from './PricingProvider'

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
      saved(pricingSettingsSchema.parse(await requestHotel('/api/pricing', 'PATCH', input.data)))
      setNotice(`Saved ${input.data.discountPercent}% discount for hotels and packages. Cabs are unchanged.`)
    } catch (failure) { setSaveError(hotelErrorText(failure)) }
    finally { setBusy(false) }
  }
  return <section className="admin-review-record" aria-labelledby="admin-pricing-title">
    <h2 id="admin-pricing-title">Hotel &amp; package discount</h2>
    <p>Applies to all hotel room rates and standard packages. Hotel regular room rates include the 50% markup; discounted room rates round to whole rupees. Package prices adjust to selected nights. Meals and cab offers are unchanged. Displayed hotel/package prices include all taxes and charges.</p>
    <PricingNotice />
    {settings && !loading && !error && <form key={settings.version} onSubmit={submit}>
      <label>Hotel and package discount (%)<input name="discountPercent" type="number" min="0" max="100" step="0.01" required defaultValue={settings.discountPercent} disabled={busy} /></label>
      <button className="button button-dark" disabled={busy}>{busy ? 'Saving discount...' : 'Save hotel and package discount'}</button>
    </form>}
    {saveError && <p role="alert">{saveError} <button className="text-link" type="button" disabled={busy} onClick={() => { setSaveError(''); setNotice(''); reload() }}>Reload current discount</button></p>}
    {notice && <p role="status">{notice}</p>}
  </section>
}
