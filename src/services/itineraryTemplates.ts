import { z } from 'zod'
import { itineraryDraftSchema } from './itineraryBuilderSchema.ts'
import type { ItineraryDraft } from './itineraryBuilderSchema.ts'

export const itineraryTemplatesKey = 'avelof:itinerary-templates:v1'
export const itineraryTemplateLimit = 10
const templateSchema = z.object({
  id: z.uuidv4(),
  name: z.string().trim().min(1, 'Enter a template name.').max(60),
  draft: itineraryDraftSchema.refine(draft => draft.guestName === 'Template' && draft.travelDate === '', 'Templates must not contain guest names or travel dates.'),
}).strict()
const templatesSchema = z.array(templateSchema).max(itineraryTemplateLimit).refine(items => new Set(items.map(item => item.id)).size === items.length, 'Template IDs must be unique.')
export type ItineraryTemplate = z.infer<typeof templateSchema>
export function readItineraryTemplates(storage: Pick<Storage, 'getItem'>): ItineraryTemplate[] {
  const raw = storage.getItem(itineraryTemplatesKey)
  return raw === null ? [] : templatesSchema.parse(JSON.parse(raw))
}
export function saveItineraryTemplate(storage: Pick<Storage, 'getItem' | 'setItem'>, name: string, draft: ItineraryDraft, id: string = crypto.randomUUID()): ItineraryTemplate[] {
  const current = readItineraryTemplates(storage)
  const template = templateSchema.parse({ id, name, draft: { ...draft, guestName: 'Template', travelDate: '' } })
  const index = current.findIndex(item => item.id === id)
  if (index < 0 && current.length >= itineraryTemplateLimit) throw new Error('You have 10 templates. Update or delete an existing template before saving another.')
  const next = templatesSchema.parse(index < 0 ? [...current, template] : current.map(item => item.id === id ? template : item))
  storage.setItem(itineraryTemplatesKey, JSON.stringify(next))
  return next
}
export function deleteItineraryTemplate(storage: Pick<Storage, 'getItem' | 'setItem'>, id: string) {
  const next = readItineraryTemplates(storage).filter(item => item.id !== id)
  storage.setItem(itineraryTemplatesKey, JSON.stringify(next))
  return next
}
export function openItineraryTemplate(template: ItineraryTemplate): ItineraryDraft {
  return { ...structuredClone(templateSchema.parse(template).draft), guestName: '', travelDate: '' }
}
