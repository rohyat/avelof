import { useRef, useState } from 'react'
import { FileImage } from 'lucide-react'
import { compressHotelPhotos, hotelErrorText, HotelError } from '../services/hotelService'
import UploadedPhoto from './UploadedPhoto'
export default function PartnerPhotos({ onChange }: { onChange: (photos: Blob[], processing: boolean) => void }) {
  const [photos, setPhotos] = useState<Blob[]>([])
  const [error, setError] = useState('')
  const [processing, setProcessing] = useState(false)
  const sequence = useRef(0)
  const input = useRef<HTMLInputElement>(null)
  async function select(files: File[]) {
    const current = ++sequence.current
    setError(''); setPhotos([]); setProcessing(true); onChange([], true)
    try {
      if (files.length !== 1) throw new HotelError('Select exactly one driver portrait photo.', 400)
      const next = await compressHotelPhotos(files)
      if (current === sequence.current) { setPhotos(next); onChange(next, false) }
    } catch (failure) { if (current === sequence.current) { setError(hotelErrorText(failure)); onChange([], false) } }
    finally { if (current === sequence.current) setProcessing(false) }
  }
  return <div className="review-text-field">
    <label className="photo-upload-field"><span className="photo-upload-heading"><FileImage size={24} aria-hidden="true" /> Driver portrait (one photo required)</span><small>Choose a portrait photo to upload. Use the X on the preview to remove it.</small><input ref={input} name="portrait" aria-label="Driver portrait (one photo required)" type="file" accept="image/jpeg,image/png,image/webp" required={!photos.length} onChange={(event) => { void select(Array.from(event.target.files ?? [])) }} /></label>
    <p className="privacy-note">Up to 5 MB original; resized to 1920 px and 1 MB. Upload a clear photo of yourself only; do not include another person's face, readable number plates or documents.</p>
    <p role="status">{processing ? 'Preparing portrait...' : photos.length ? 'Portrait ready to upload.' : ''}</p>
    {error && <p role="alert" className="enquiry-error">{error}</p>}
    <div className="hotel-photo-grid">{photos.map((photo) => <UploadedPhoto key={photo.size} photo={photo} alt="Driver portrait preview" removeLabel="Remove driver portrait" disabled={processing} onRemove={() => {
      sequence.current++
      setPhotos([]); setError(''); onChange([], false)
      if (input.current) input.current.value = ''
    }} />)}</div>
  </div>
}
