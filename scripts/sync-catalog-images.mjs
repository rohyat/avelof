import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { previewPhotos } from '../src/data/previewPhotos.ts'

function webp(bytes) {
  return bytes.length > 12 && bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP'
}

async function main() {
  for (const photo of Object.values(previewPhotos)) {
    const destination = resolve('public', photo.image.slice(1))
    let existing
    try { existing = await readFile(destination) } catch (error) { if (error.code !== 'ENOENT') throw error }
    if (existing && webp(existing) && !process.argv.includes('--refresh')) {
      console.log(`Kept ${photo.image} (${existing.length} bytes)`)
      continue
    }
    const source = new URL(photo.source)
    source.search = new URLSearchParams({ fit: 'crop', w: '1400', q: '75', fm: 'webp' }).toString()
    const response = await fetch(source, { signal: AbortSignal.timeout(30000) })
    if (!response.ok || !response.headers.get('content-type')?.startsWith('image/webp')) throw new Error(`Image download failed for ${photo.place}: HTTP ${response.status}`)
    const bytes = Buffer.from(await response.arrayBuffer())
    if (!webp(bytes) || bytes.length > 2000000) throw new Error(`Invalid or oversized WebP for ${photo.place}`)
    await mkdir(dirname(destination), { recursive: true })
    const temporary = `${destination}.download`
    try {
      await writeFile(temporary, bytes)
      await rename(temporary, destination)
    } finally { await rm(temporary, { force: true }) }
    console.log(`Downloaded ${photo.image} (${bytes.length} bytes)`)
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1 })