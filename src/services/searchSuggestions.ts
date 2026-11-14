export interface SearchSuggestion {
  id: string
  label: string
  detail?: string
  aliases?: readonly string[]
  priority?: boolean
}

function normalise(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function editDistance(left: string, right: string) {
  let row = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let i = 1; i <= left.length; i++) {
    const next = [i]
    for (let j = 1; j <= right.length; j++) {
      next[j] = Math.min(next[j - 1] + 1, row[j] + 1, row[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1))
    }
    row = next
  }
  return row[right.length]
}

export function searchSuggestions<T extends SearchSuggestion>(items: readonly T[], value: string): T[] {
  const query = normalise(value).slice(0, 100)
  if (query.length < 2) return []
  return items.map((suggestion) => {
    let score = Infinity
    const names = [suggestion.label, ...suggestion.aliases ?? []]
      .flatMap((name) => [normalise(name), ...name.split(/[^a-z0-9]+/i).filter((word) => word.length >= 2).map(normalise)])
    for (const name of names) {
      if (name === query) score = Math.min(score, 0)
      else if (name.startsWith(query)) score = Math.min(score, 1)
      else if (name.includes(query)) score = Math.min(score, 2)
      else if (query.length >= 4) {
        const tolerance = query.length >= 5 ? 2 : 1
        // Match misspelled prefixes too, so partial names can complete.
        for (let length = Math.max(2, query.length - tolerance); length <= Math.min(name.length, query.length + tolerance); length++) {
          const distance = editDistance(query, name.slice(0, length))
          if (distance <= tolerance) score = Math.min(score, 3 + distance)
        }
      }
    }
    return { suggestion, score }
  }).filter((match) => Number.isFinite(match.score))
    .sort((left, right) => left.score - right.score
      || Number(Boolean(right.suggestion.priority)) - Number(Boolean(left.suggestion.priority))
      || left.suggestion.label.localeCompare(right.suggestion.label))
    .map((match) => match.suggestion)
}

export function parseRecentSearches<T extends SearchSuggestion>(value: string | null, items: readonly T[]): T[] {
  if (!value) return []
  const parsed: unknown = JSON.parse(value)
  if (!Array.isArray(parsed)) throw new Error('Invalid recent searches')
  return [...new Set(parsed.filter((id): id is string => typeof id === 'string'))]
    .flatMap((id) => {
      const suggestion = items.find((item) => item.id === id)
      return suggestion ? [suggestion] : []
    }).slice(0, 8)
}
