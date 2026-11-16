import { createContext, useContext, useMemo } from 'react'
import { tourPackages } from '../data/catalog'
import { discountedPrice } from './pricingSchema'
import type { PricingSettings } from './pricingSchema'

interface PricingContext {
  settings: PricingSettings | null
  loading: boolean
  error: string
  reload: () => void
  saved: (settings: PricingSettings) => void
}
export const pricingContext = createContext<PricingContext | null>(null)

export function usePricing() {
  const context = useContext(pricingContext)
  if (!context) throw new Error('PricingProvider is required.')
  return context
}

export function useTourPackages() {
  const { settings, loading, error } = usePricing()
  return useMemo(() => !settings || loading || error ? [] : tourPackages.map((item) => ({
    ...item, price: discountedPrice(item.price, settings.discountPercent),
    originalPrice: settings.discountPercent > 0 ? item.price : undefined,
  })), [settings, loading, error])
}
