import { useEffect, useRef, useState } from 'react'
import { FileImage, X } from 'lucide-react'
import { z } from 'zod'
import { compressHotelPhotos, HotelError, requestHotel } from '../services/hotelService'
import { BusinessError, compressBusinessPhoto } from '../services/businessService'

function NewPhoto({ photo }: { photo: Blob }) {
  const image = useRef<HTMLImageElement>(null)
  useEffect(() => {
    const url = URL.createObjectURL(photo)
    if (image.current) image.current.src = url
    return () => URL.revokeObjectURL(url)
  }, [photo])
  return <img ref={image} alt="New photo to upload" />
}

const responseSchema = z.object({ photos: z.array(z.string().regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/)).min(1).max(5) })
const photoErrorText = (failure: unknown) => failure instanceof HotelError || failure instanceof BusinessError ? failure.message : 'Could not prepare your photos. Please try again.'

export default function PartnerPhotoEditor({ kind, id, accessCode, version, onChange }: {
  kind: 'hotel' | 'driver' | 'business'; id: string; accessCode: string; version: number
  onChange: (photos: Blob[], retained: number[], blocked: boolean) => void
}) {
  const [existing, setExisting] = useState<string[]>([])
  const [retained, setRetained] = useState<number[]>([])
  const [photos, setPhotos] = useState<Blob[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [revision, setRevision] = useState(0)
  const callback = useRef(onChange)
  const maximum = kind === 'driver' ? 1 : 5
  const count = retained.length + photos.length
  useEffect(() => { callback.current = onChange }, [onChange])
  useEffect(() => {
    const controller = new AbortController()
    requestHotel('/api/partner-photos', 'POST', { kind, id, accessCode, version }, controller.signal)
      .then((response) => {
        const next = responseSchema.parse(response).photos
        if (next.length > maximum) throw new Error('Unexpected photo count.')
        if (!controller.signal.aborted) { setExisting(next); setRetained(next.map((_, index) => index)); setLoadError('') }
      })
      .catch((failure: unknown) => { if (!controller.signal.aborted) setLoadError(photoErrorText(failure)) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [kind, id, accessCode, version, maximum, revision])
  useEffect(() => {
    callback.current(photos, retained, loading || processing || Boolean(loadError) || count < 1)
  }, [photos, retained, loading, processing, loadError, count])

  async function add(files: File[]) {
    if (!files.length) return
    setUploadError('')
    if (files.length + count > maximum) { setUploadError(`Keep at most ${maximum} ${maximum === 1 ? 'portrait' : 'photos'}. Remove a photo first to add another.`); return }
    setProcessing(true)
    try {
      const next = kind === 'business' ? await Promise.all(files.map(compressBusinessPhoto)) : await compressHotelPhotos(files)
      setPhotos((current) => [...current, ...next])
    } catch (failure) { setUploadError(photoErrorText(failure)) }
    finally { setProcessing(false) }
  }
  return <div className="review-text-field partner-photo-editor">
    <p>Keep the photos you want. Use the X to remove a photo, then add new ones. Changes apply only after you save successfully.</p>
    {loading && <p role="status">Loading your existing photos...</p>}
    {loadError && <p className="enquiry-error" role="alert">{loadError} <button type="button" className="text-link" onClick={() => { setLoading(true); setLoadError(''); setRevision((value) => value + 1) }}>Retry loading photos</button></p>}
    {!loading && !loadError && <>
      <div className="hotel-photo-grid">
        {retained.map((index) => <div className="editable-photo" key={`saved-${index}`}>
          <img src={existing[index]} alt={`Existing ${kind} photo ${index + 1}`} />
          <button type="button" className="photo-remove" aria-label={`Remove existing photo ${index + 1}`} disabled={processing} onClick={() => { setRetained((current) => current.filter((value) => value !== index)); setUploadError('') }}><X size={18} aria-hidden="true" /></button>
        </div>)}
        {photos.map((photo, index) => <div className="editable-photo" key={`new-${index}`}>
          <NewPhoto photo={photo} />
          <button type="button" className="photo-remove" aria-label={`Remove new photo ${index + 1}`} disabled={processing} onClick={() => setPhotos((current) => current.filter((_, position) => position !== index))}><X size={18} aria-hidden="true" /></button>
        </div>)}
      </div>
      <label className="photo-upload-field"><span className="photo-upload-heading"><FileImage size={24} aria-hidden="true" /> Add {kind === 'driver' ? 'driver portrait' : `${kind} photos`}</span><input aria-label={`Add ${kind === 'driver' ? 'driver portrait' : `${kind} photos`}`} type="file" accept="image/jpeg,image/png,image/webp" multiple={maximum > 1} disabled={processing || count >= maximum} onChange={(event) => { void add(Array.from(event.target.files ?? [])); event.target.value = '' }} /></label>
      <p className="privacy-note">JPEG, PNG or WebP, up to 5 MB each. Photos are resized to at most 1920 px and 1 MB, with original metadata removed.</p>
      <p role="status">{processing ? 'Preparing photos...' : `${count} of ${maximum} photos selected.`}</p>
      {!count && <p className="enquiry-error" role="alert">Add at least one photo before saving.</p>}
    </>}
    {uploadError && <p className="enquiry-error" role="alert">{uploadError}</p>}
  </div>
}
