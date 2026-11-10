import { createHash } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ownerGuestReviewMonths, ownerProvidedGuestReviews } from '../src/data/catalog.ts'
import { reviewSubmissionSchema } from '../src/services/reviewSchema.ts'

function stableReviewId(sourceKey) {
  const bytes = createHash('sha256').update(`avelof-owner-review:${sourceKey}`).digest().subarray(0, 16)
  bytes[6] = (bytes[6] & 15) | 64
  bytes[8] = (bytes[8] & 63) | 128
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function buildOwnerReviewImport() {
  const database = new DatabaseSync(':memory:')
  const quote = (value) => database.prepare('SELECT quote(?) AS literal').get(value).literal
  const ids = []
  const keys = new Set()
  try {
    const statements = ownerProvidedGuestReviews.map((review) => {
      const sourceKey = `owner:${review.id}`
      if (keys.has(sourceKey)) throw new Error('Duplicate owner review source key.')
      keys.add(sourceKey)
      const submission = reviewSubmissionSchema.parse({
        id: stableReviewId(sourceKey), reviewerName: review.name, bookingId: review.bookingId,
        experience: review.packageName, rating: review.rating, title: review.reviewTitle,
        reviewText: review.reviewText, publicationConsent: true,
      })
      const { id, reviewerName, bookingId, experience, rating, title, reviewText } = submission
      const payloadHash = createHash('sha256').update(JSON.stringify({ reviewerName, bookingId, experience, rating, title, reviewText, publicationConsent: true })).digest('hex')
      ids.push(id)
      const reviewMonth = ownerGuestReviewMonths[review.id]
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(reviewMonth ?? '')) throw new Error('Invalid owner-provided review month.')
      const values = [id, reviewerName, bookingId, experience, rating, title, reviewText, payloadHash, sourceKey, reviewMonth].map(quote)
      return `INSERT INTO reviews (id, reviewer_name, booking_id, experience, rating, title, review_text, publication_consent, payload_hash, submission_source, source_key, review_month, status, published_at) VALUES (${values.slice(0, 7).join(', ')}, 1, ${values[7]}, 'owner_provided', ${values[8]}, ${values[9]}, 'published', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) ON CONFLICT (source_key) DO NOTHING;`
    })
    return { sql: `${statements.join('\n')}\n`, ids, count: statements.length }
  } finally { database.close() }
}

async function main() {
  if (process.argv.includes('--check-client')) {
    const files = await readdir(resolve('dist'), { recursive: true })
    for (const file of files.filter((name) => /\.(js|html|css)$/.test(name))) {
      const text = await readFile(resolve('dist', file), 'utf8')
      if (ownerProvidedGuestReviews.some((review) => text.includes(review.bookingId))) throw new Error('Private review references must not be in frontend assets.')
    }
    console.log('Private owner-review booking references are absent from frontend assets.')
    return
  }
  if (!process.argv.includes('--owner-approved')) throw new Error('Use --owner-approved only when the owner has confirmed the source reviews and authorized publication.')
  const imported = buildOwnerReviewImport()
  const directory = resolve('.wrangler/tmp')
  await mkdir(directory, { recursive: true })
  const destination = resolve(directory, 'owner-guest-reviews.sql')
  await writeFile(destination, imported.sql, { mode: 0o600 })
  console.log(`Prepared ${imported.count} owner-approved reviews in .wrangler/tmp/owner-guest-reviews.sql.`)
  console.log('Import after database migrations. Stable IDs/source keys avoid duplicates and preserve existing moderation decisions.')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(() => {
  console.error('Review import preparation failed. Check source validation and the --owner-approved option; no private booking references were printed.')
  process.exitCode = 1
})