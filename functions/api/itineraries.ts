import { isAdmin, privateReply } from '../_lib/enquiryAccess.ts'
import type { AccessEnv } from '../_lib/enquiryAccess.ts'

export const onRequest: PagesFunction<AccessEnv> = async ({ request, env }) => {
  if (!await isAdmin(request, env)) return privateReply({ error: 'Please sign in to use the itinerary builder.' }, 401)
  if (request.method !== 'GET') return privateReply({ error: 'Itinerary storage has been removed. Create and download the PDF in your browser; nothing is saved.' }, 410)
  return privateReply({ authorized: true, storage: false })
}
