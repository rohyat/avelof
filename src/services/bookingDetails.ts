import type { BookingKind } from '../types'

export function requestedBooking(kind: BookingKind, fields: Record<string, string>) {
  if (kind === 'hotel') return {
    type: 'Hotel booking', name: fields.preferredStay || 'Hotel selection pending',
    startLabel: 'Check-in date', endLabel: 'Check-out date',
    startDate: fields.checkInDate || null, endDate: fields.checkOutDate || null,
  }
  if (kind === 'car') return {
    type: 'Cab booking', name: fields.carRental || 'Vehicle selection pending',
    startLabel: 'Start date', endLabel: 'End date',
    startDate: fields.startDate || null, endDate: fields.endDate || null,
  }
  const customized = kind === 'package' && (fields.packagePreference === 'Custom package' || Boolean(fields.placesToVisit))
  return {
    type: kind === 'contact' ? 'General enquiry' : customized ? 'Customized package' : 'Package booking',
    name: fields.packagePreference === 'Custom package' ? 'Customized package' : fields.packagePreference || 'Package selection pending',
    startLabel: 'Start date', endLabel: 'End date',
    startDate: fields.arrivalDate || null, endDate: fields.departureDate || null,
  }
}