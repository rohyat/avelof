import { useEffect, useId, useState } from 'react'
import { ArrowRight, History, Search } from 'lucide-react'
import { parseRecentSearches, searchSuggestions } from '../services/searchSuggestions'
import type { SearchSuggestion } from '../services/searchSuggestions'

export default function SearchAutocomplete<T extends SearchSuggestion>({ label, placeholder, value, onChange, onSelect, items, storageKey, submitLabel, suggestionsLabel, recentLabel }: {
  label: string; placeholder: string; value: string; onChange: (value: string) => void; onSelect: (item: T) => void
  items: readonly T[]; storageKey: string; submitLabel: string; suggestionsLabel: string; recentLabel: string
}) {
  const [history, setHistory] = useState(() => {
    try { return { items: parseRecentSearches(localStorage.getItem(storageKey), items), error: '' } }
    catch { return { items: [], error: 'Recent searches could not be loaded in this browser. You can still search.' } }
  })
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const id = useId()
  const suggestions = value.trim() ? searchSuggestions(items, value).slice(0, 8) : history.items
  useEffect(() => {
    if (open && active >= 0) document.getElementById(`${id}-${active}`)?.scrollIntoView({ block: 'nearest' })
  }, [active, open, id])

  function choose(item: T) {
    const recent = [item, ...history.items.filter((entry) => entry.id !== item.id)].slice(0, 8)
    try {
      localStorage.setItem(storageKey, JSON.stringify(recent.map((entry) => entry.id)))
      setHistory({ items: recent, error: '' })
    } catch { setHistory({ items: recent, error: 'Your browser could not save recent searches. Search still works for this visit.' }) }
    setOpen(false)
    setActive(-1)
    onSelect(item)
  }

  function clearHistory() {
    try { localStorage.removeItem(storageKey); setHistory({ items: [], error: '' }) }
    catch { setHistory((current) => ({ ...current, error: 'Your browser could not clear recent searches. Check browser storage permissions and try again.' })) }
  }

  return <div className="search-autocomplete">
    <div className="place-filters" role="search" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}>
      <div className="place-search"><label htmlFor={`${id}-input`}>{label}</label><div><Search size={18} aria-hidden="true" /><input id={`${id}-input`} type="search" role="combobox" aria-autocomplete="list" aria-expanded={open && suggestions.length > 0} aria-controls={id} aria-activedescendant={open && active >= 0 && active < suggestions.length ? `${id}-${active}` : undefined} autoComplete="off" maxLength={100} value={value}
        onFocus={() => { setOpen(true); setActive(-1) }}
        onChange={(event) => { onChange(event.target.value); setOpen(true); setActive(-1) }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') { event.preventDefault(); setOpen(false); setActive(-1); return }
          if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && suggestions.length) {
            event.preventDefault()
            setOpen(true)
            setActive((current) => event.key === 'ArrowDown' ? (current + 1) % suggestions.length : (current <= 0 ? suggestions.length : current) - 1)
          }
          if (event.key === 'Enter' && suggestions.length) { event.preventDefault(); choose(suggestions[active >= 0 && active < suggestions.length ? active : 0]) }
        }} placeholder={placeholder} /><button type="button" className="place-search-submit" aria-label={submitLabel} onClick={() => {
          if (suggestions.length && value.trim()) choose(suggestions[active >= 0 && active < suggestions.length ? active : 0])
          else setOpen(true)
        }}><ArrowRight size={20} aria-hidden="true" /></button></div></div>
      {open && suggestions.length > 0 && <div className="place-suggestions">
        {!value.trim() && <div className="place-recent-heading"><span><History size={15} aria-hidden="true" /> Recent searches</span><button type="button" onClick={clearHistory}>Clear history</button></div>}
        <ul id={id} role="listbox" aria-label={value.trim() ? suggestionsLabel : recentLabel}>{suggestions.map((item, index) => <li id={`${id}-${index}`} role="option" aria-selected={active === index} key={item.id} onPointerDown={(event) => event.preventDefault()} onClick={() => choose(item)}>
          <Search size={17} aria-hidden="true" /><span><strong>{item.label}</strong>{item.detail && <small>{item.detail}</small>}</span><ArrowRight size={16} aria-hidden="true" />
        </li>)}</ul>
      </div>}
    </div>
    {history.error && <p className="privacy-note" role="alert">{history.error}</p>}
  </div>
}
