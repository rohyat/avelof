let visitSeed: string | undefined

function hotelVisitSeed() {
  if (visitSeed) return visitSeed
  const generated = crypto.randomUUID()
  try {
    visitSeed = sessionStorage.getItem('avelof:hotel-order') || generated
    sessionStorage.setItem('avelof:hotel-order', visitSeed)
  } catch (error) {
    console.warn('Could not save the hotel order for this visit.', error)
    visitSeed = generated
  }
  return visitSeed
}

export function orderHotelsForVisit<T extends { id: string }>(hotels: T[], seed = hotelVisitSeed()): T[] {
  const score = (id: string) => {
    let hash = 2166136261
    for (const character of `${seed}:${id}`) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619)
    hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b)
    hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35)
    return (hash ^ (hash >>> 16)) >>> 0
  }
  return hotels.map((hotel) => ({ hotel, score: score(hotel.id) }))
    .sort((a, b) => a.score - b.score || a.hotel.id.localeCompare(b.hotel.id))
    .map(({ hotel }) => hotel)
}
