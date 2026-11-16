import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { pricingSettingsSchema } from '../services/pricingSchema'
import type { PricingSettings } from '../services/pricingSchema'
import { hotelErrorText, requestHotel } from '../services/hotelService'
import { pricingContext, usePricing } from '../services/pricingContext'

export default function PricingProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<PricingSettings | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  const pendingRequest = useRef<AbortController | null>(null)
  const reload = useCallback(() => { setLoading(true); setError(''); setRevision((value) => value + 1) }, [])
  const saved = useCallback((next: PricingSettings) => { pendingRequest.current?.abort(); setSettings(next); setLoading(false); setError(''); window.dispatchEvent(new Event('avelof-pricing-updated')) }, [])
  useEffect(() => {
    const controller = new AbortController()
    pendingRequest.current = controller
    requestHotel('/api/pricing', 'GET', undefined, controller.signal)
      .then((response) => { if (!controller.signal.aborted) { setSettings(pricingSettingsSchema.parse(response)); setError('') } })
      .catch((failure: unknown) => { if (!controller.signal.aborted) { setSettings(null); setError(hotelErrorText(failure)) } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [revision])
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') reload() }
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [reload])
  return <pricingContext.Provider value={{ settings, loading, error, reload, saved }}>{children}</pricingContext.Provider>
}

export function PricingNotice() {
  const { loading, error, reload } = usePricing()
  if (loading) return <p role="status">Loading current prices...</p>
  return error ? <p className="enquiry-error" role="alert">{error} <button type="button" className="text-link" onClick={reload}>Retry loading prices</button></p> : null
}
