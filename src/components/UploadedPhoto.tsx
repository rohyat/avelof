import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

export default function UploadedPhoto({ photo, alt, removeLabel, disabled, onRemove }: {
  photo: Blob; alt: string; removeLabel: string; disabled?: boolean; onRemove: () => void
}) {
  const image = useRef<HTMLImageElement>(null)
  useEffect(() => {
    const url = URL.createObjectURL(photo)
    if (image.current) image.current.src = url
    return () => URL.revokeObjectURL(url)
  }, [photo])
  return <div className="editable-photo">
    <img ref={image} alt={alt} />
    <button type="button" className="photo-remove" aria-label={removeLabel} disabled={disabled} onClick={onRemove}><X size={18} aria-hidden="true" /></button>
  </div>
}
