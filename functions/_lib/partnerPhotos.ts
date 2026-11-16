import { z } from 'zod'

const indexesSchema = z.array(z.number().int().min(0).max(4)).max(5)
  .refine((indexes) => new Set(indexes).size === indexes.length).optional()

export function readRetainedPhotos(form: FormData) {
  if (!form.has('retainedPhotos')) return indexesSchema.safeParse(undefined)
  if (form.getAll('retainedPhotos').length !== 1) return indexesSchema.safeParse(null)
  try { return indexesSchema.safeParse(JSON.parse(String(form.get('retainedPhotos')))) }
  catch { return indexesSchema.safeParse(null) }
}

export function retainedPhotoKeys(current: string[], retained: number[] | undefined, uploads: number, maximum = 5) {
  const indexes = retained ?? (uploads ? [] : current.map((_, index) => index))
  if (indexes.some((index) => index >= current.length) || indexes.length + uploads < 1 || indexes.length + uploads > maximum) return null
  return indexes.map((index) => current[index])
}
