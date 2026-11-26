import { useEffect, useState } from 'react'
import type { ItineraryDraft } from '../services/itineraryBuilderSchema'
import { deleteItineraryTemplate, itineraryTemplatesKey, openItineraryTemplate, readItineraryTemplates, saveItineraryTemplate } from '../services/itineraryTemplates'
import type { ItineraryTemplate } from '../services/itineraryTemplates'

export default function ItineraryTemplates({ draft, inputError, onOpen }: { draft: ItineraryDraft; inputError: string; onOpen: (draft: ItineraryDraft) => void }) {
  const [storageState, setStorageState] = useState<{ templates: ItineraryTemplate[]; error: string; available: boolean }>(() => {
    try { return { templates: readItineraryTemplates(localStorage), error: '', available: true } }
    catch (failure) {
      console.error('Local itinerary templates failed', failure)
      return { templates: [], error: failure instanceof Error ? failure.message : 'Could not access browser templates.', available: false }
    }
  })
  const { templates, error, available } = storageState
  const [name, setName] = useState('')
  const [notice, setNotice] = useState('')
  function fail(failure: unknown) {
    console.error('Local itinerary templates failed', failure)
    setStorageState(current => ({ ...current, error: failure instanceof Error ? failure.message : 'Could not access browser templates.' }))
  }
  function reload() {
    try { setStorageState({ templates: readItineraryTemplates(localStorage), available: true, error: '' }) }
    catch (failure) { setStorageState(current => ({ ...current, available: false })); fail(failure) }
  }
  useEffect(() => {
    const sync = (event: StorageEvent) => { if (event.key === itineraryTemplatesKey || event.key === null) reload() }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])
  function save(template?: ItineraryTemplate) {
    setNotice(''); setStorageState(current => ({ ...current, error: '' }))
    if (inputError) { setStorageState(current => ({ ...current, error: inputError })); return }
    if (template && !window.confirm(`Replace "${template.name}" with the current itinerary?`)) return
    try {
      setStorageState({ templates: saveItineraryTemplate(localStorage, template?.name ?? name, draft, template?.id), error: '', available: true })
      setName(''); setNotice('Template saved in this browser only. Guest name and travel date are not stored.')
    } catch (failure) { fail(failure) }
  }
  function remove(template: ItineraryTemplate) {
    if (!window.confirm(`Delete "${template.name}" from this browser?`)) return
    try { setStorageState({ templates: deleteItineraryTemplate(localStorage, template.id), error: '', available: true }); setNotice('Template deleted from this browser.') }
    catch (failure) { fail(failure) }
  }
  return <section className="itinerary-editor-section">
    <h2>Local itinerary templates</h2>
    <p>Save up to 10 reusable plans on this browser/device only, never in the database. Guest name and travel date are cleared. Guest count, price, rooms and all journey details stay editable. Clearing browser data removes your templates.</p>
    <label>Template name<input maxLength={60} value={name} onChange={event => setName(event.target.value)} /></label>
    <button type="button" className="button button-outline" disabled={!available || templates.length >= 10} onClick={() => save()}>Save as template</button>
    <p>{templates.length} / 10 templates saved</p>
    {templates.map(template => <div className="itinerary-day-editor" key={template.id}>
      <strong>{template.name}</strong>
      <p>{template.draft.days.length} days · {template.draft.tier}</p>
      <button type="button" className="button button-outline" onClick={() => onOpen(openItineraryTemplate(template))}>Open {template.name}</button>
      <button type="button" className="button button-outline" onClick={() => save(template)}>Update {template.name}</button>
      <button type="button" className="button button-outline" onClick={() => remove(template)}>Delete {template.name}</button>
    </div>)}
    {error && <p className="enquiry-error" role="alert">{error} <button type="button" onClick={reload}>Retry loading templates</button></p>}
    {notice && <p role="status">{notice}</p>}
  </section>
}
