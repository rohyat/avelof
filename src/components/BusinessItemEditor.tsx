import { useEffect, useRef } from 'react'
import { Trash2 } from 'lucide-react'
import { businessErrorText, compressBusinessPhoto } from '../services/businessService'
import type { BusinessItem } from '../services/businessSchema'

export type EditableBusinessItem = BusinessItem & { photo?: Blob; preview?: string; processing?: boolean; error?: string }

export default function BusinessItemEditor({ item, index, onChange, onRemove }: { item: EditableBusinessItem; index: number; onChange: (changes: Partial<EditableBusinessItem>) => void; onRemove: () => void }) {
  const image = useRef<HTMLImageElement>(null)
  const revision = useRef(0)
  useEffect(() => {
    const url = item.photo ? URL.createObjectURL(item.photo) : item.preview
    if (image.current) image.current.src = url ?? ''
    return () => { if (item.photo && url) URL.revokeObjectURL(url) }
  }, [item.photo, item.preview])
  async function selectPhoto(file?: File) {
    const current = ++revision.current
    onChange({ photo: undefined, processing: Boolean(file), error: '' })
    if (!file) return
    try {
      const photo = await compressBusinessPhoto(file)
      if (current === revision.current) onChange({ photo, processing: false })
    } catch (failure) {
      if (current === revision.current) onChange({ error: businessErrorText(failure), processing: false })
    }
  }
  return <fieldset className="business-item-editor">
    <legend>Item {index + 1}</legend>
    <label>Item {index + 1} heading<input name={`itemName_${item.id}`} required maxLength={100} value={item.name} onChange={(event) => onChange({ name: event.target.value })} /></label>
    <label>Item {index + 1} description<textarea name={`itemDescription_${item.id}`} required maxLength={1000} rows={3} value={item.description} onChange={(event) => onChange({ description: event.target.value })} /></label>
    <label><span>Item {index + 1} photo</span><input aria-label={`Item ${index + 1} photo`} name={`itemPhoto_${item.id}`} type="file" accept="image/jpeg,image/png,image/webp" required={!item.preview && !item.photo} onChange={(event) => void selectPhoto(event.target.files?.[0])} /><small>Exactly one photo. JPEG, PNG or WebP, up to 5 MB; compressed before upload.</small></label>
    {(item.photo || item.preview) && <div className="hotel-photo-grid"><img ref={image} alt={`Photo for item ${index + 1}`} /></div>}
    {item.processing && <p role="status">Preparing item photo...</p>}
    {item.error && <p role="alert" className="enquiry-error">{item.error}</p>}
    <button className="button button-outline" type="button" aria-label={`Remove item ${index + 1}`} onClick={onRemove}><Trash2 size={16} />Remove item</button>
  </fieldset>
}
