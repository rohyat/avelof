import DateCalendarInput from './DateCalendarInput'
import { hotelRoomPriceForDate, hotelSeasonNotice } from '../services/hotelPricing'

export default function HotelDateInput({ roomRate, checkout = false, ...props }: {
  label: string; name: string; value: string; min?: string; roomRate?: number; onChange: (date: string) => void; checkout?: boolean
}) {
  return <DateCalendarInput {...props}
    disabled={!checkout && roomRate === undefined}
    priceForDate={!checkout && roomRate !== undefined ? (date) => hotelRoomPriceForDate(roomRate, date) : undefined}
    priceSuffix=" per room for this night"
    triggerLabel={`View ${checkout ? 'check-out calendar' : 'check-in calendar prices'}`}
    closeLabel={checkout ? 'Close check-out calendar' : 'Close price calendar'}
    helpText={checkout ? 'Select your check-out date. Your check-out date is not charged.' : 'Room-only price per room for the night of each date. Meals extra. Select your check-in date.'}
    notice={checkout ? undefined : hotelSeasonNotice}
  />
}
