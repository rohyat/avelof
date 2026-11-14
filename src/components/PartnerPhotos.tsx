import { useEffect, useRef, useState } from 'react'
import { FileImage } from 'lucide-react'
import { compressHotelPhotos, hotelErrorText, HotelError } from '../services/hotelService'
function Preview({ photo }: { photo: Blob }) {
  const ref = useRef<HTMLImageElement>(null)
  useEffect(() => { const url = URL.createObjectURL(photo); if (ref.current) ref.current.src = url; return () => URL.revokeObjectURL(url) }, [photo])
  return <img ref={ref} alt="Driver portrait preview" />
}
export default function PartnerPhotos({ onChange }: { onChange: (photos: Blob[], processing: boolean) => void }) {
  const [photos, setPhotos] = useState<Blob[]>([])
  const [error, setError] = useState('')
  const [processing, setProcessing] = useState(false)
  const sequence = useRef(0)
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
    <label className="photo-upload-field"><span className="photo-upload-heading"><FileImage size={24} aria-hidden="true" /> Driver portrait (one photo required)</span><small>Choose a portrait photo to upload.</small><input aria-label="Driver portrait (one photo required)" type="file" accept="image/jpeg,image/png,image/webp" required onChange={(event) => { void select(Array.from(event.target.files ?? [])) }} /></label>
    <p className="privacy-note">Up to 5 MB original; resized to 1920 px and 1 MB. Upload a clear photo of yourself only; do not include another person's face, readable number plates or documents.</p>
    <p role="status">{processing ? 'Preparing portrait...' : photos.length ? 'Portrait ready to upload.' : ''}</p>
    {error && <p role="alert" className="enquiry-error">{error}</p>}
    <div className="hotel-photo-grid">{photos.map((photo) => <Preview key={photo.size} photo={photo} />)}</div>
  </div>
}
