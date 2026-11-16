export const hotelSeasonStart = '2026-12-06'
export const hotelSeasonNotice = 'Current room rates through 5 December 2026; 10% higher from 6 December 2026. Meals unchanged.'
const dayMilliseconds = 86400000

export function hotelDateValue(value: string) {
  const timestamp = Date.parse(`${value}T00:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) throw new RangeError('Choose a valid hotel stay date.')
  return timestamp
}

export function hotelRoomPriceForDate(price: number, date?: string) {
  if (!Number.isFinite(price) || price < 0) throw new RangeError('Hotel room rates must be non-negative numbers.')
  if (date) hotelDateValue(date)
  return date && date >= hotelSeasonStart ? Math.round(price * 110 / 100) : price
}

export function hotelStayPrice(roomRate: number, mealRate: number, start: string, end: string, rooms: number) {
  const startTime = hotelDateValue(start), endTime = hotelDateValue(end)
  if (endTime <= startTime || !Number.isInteger(rooms) || rooms < 1 || rooms > 100 || !Number.isFinite(mealRate) || mealRate < 0) throw new RangeError('Choose valid stay dates, room quantities and meal rates.')
  const nights = (endTime - startTime) / dayMilliseconds
  const standardNights = Math.max(0, Math.min(endTime, hotelDateValue(hotelSeasonStart)) - startTime) / dayMilliseconds
  const seasonalNights = nights - standardNights
  const standardRate = hotelRoomPriceForDate(roomRate)
  const seasonalRate = hotelRoomPriceForDate(roomRate, hotelSeasonStart)
  const groups = [
    { nights: standardNights, roomRate: standardRate },
    { nights: seasonalNights, roomRate: seasonalRate },
  ].filter((group) => group.nights > 0)
  const nightlyRates = groups.map((group) => Math.round((group.roomRate + mealRate) * 100) / 100)
  return {
    nights, groups,
    minNightly: Math.min(...nightlyRates), maxNightly: Math.max(...nightlyRates),
    total: Math.round((standardNights * standardRate + seasonalNights * seasonalRate + mealRate * nights) * rooms * 100) / 100,
  }
}

export const hotelRateRange = (min: number, max = min) => min === max ? `₹${min.toLocaleString('en-IN')}` : `₹${min.toLocaleString('en-IN')} to ₹${max.toLocaleString('en-IN')}`
