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

const clicksKey = 'avelof:hotel-clicks'

function readClicks(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(clicksKey) || '[]')
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

export function recordHotelClick(id: string) {
  try {
    localStorage.setItem(clicksKey, JSON.stringify([id, ...readClicks().filter((clicked) => clicked !== id)].slice(0, 50)))
  } catch (error) {
    console.warn('Could not save the clicked hotel.', error)
  }
}

export function orderHotelsForVisit<T extends { id: string }>(hotels: T[], seed = hotelVisitSeed()): T[] {
  const clicked = readClicks()
  const rank = (id: string) => { const index = clicked.indexOf(id); return index === -1 ? Infinity : index }
  const shuffled = shuffleForVisit(hotels, seed)
  return [...shuffled].sort((a, b) => rank(a.id) - rank(b.id) || 0)
}

function shuffleForVisit<T extends { id: string }>(hotels: T[], seed: string): T[] {
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
