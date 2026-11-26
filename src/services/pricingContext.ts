import { createContext, useContext } from 'react'
import { tourPackages } from '../data/catalog'
import type { PricingSettings } from './pricingSchema'
import { applyPackageDiscount } from './pricing'

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
  return !settings || loading || error ? [] : applyPackageDiscount(tourPackages, settings.discountPercent)
}
