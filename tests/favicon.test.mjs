import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const load = (file) => readFile(new URL(`../${file}`, import.meta.url), 'utf8')

test('homepage exposes the stable Chinar PNG and a real square ICO fallback', async () => {
  const html = await load('index.html')
  assert.match(html, /rel="icon"[^>]+sizes="192x192"[^>]+href="\/app-icon-192\.png\?v=chinar-1"/)
  assert.match(html, /rel="icon"[^>]+sizes="48x48"[^>]+href="\/favicon\.ico"/)
  const ico = await readFile(new URL('../public/favicon.ico', import.meta.url))
  assert.equal(ico.readUInt16LE(0), 0)
  assert.equal(ico.readUInt16LE(2), 1)
  assert.equal(ico.readUInt16LE(4), 1)
  assert.equal(ico[6], 48)
  assert.equal(ico[7], 48)
  assert.ok(ico.readUInt32LE(14) > 0)
  assert.ok(ico.readUInt32LE(18) + ico.readUInt32LE(14) <= ico.length)
})

test('crawler rules allow icons and leave private-route noindex headers discoverable', async () => {
  const robots = await load('public/robots.txt')
  assert.match(robots, /^User-agent: \*$/m)
  assert.match(robots, /^Allow: \/$/m)
  assert.doesNotMatch(robots, /^Disallow: \/$/m)
  assert.doesNotMatch(robots, /^Disallow: \/(?:app-icon|favicon|images)/m)
  const headers = (await load('public/_headers')).replaceAll('\r\n', '\n')
  for (const route of ['/admin/*', '/my-enquiries*', '/hotel-status*', '/driver-status*', '/business-status*']) {
    const section = headers.split(`${route}\n`)[1]?.split('\n\n')[0]
    assert.ok(section?.includes('X-Robots-Tag: noindex, nofollow'))
  }
})

test('active branding assets require revalidation rather than immutable caching', async () => {
  const headers = (await load('public/_headers')).replaceAll('\r\n', '\n')
  for (const file of ['favicon.ico', 'app-icon-192.png', 'app-icon-512.png', 'apple-touch-icon.png', 'robots.txt']) {
    const section = headers.split(`/${file}\n`)[1]?.split('\n\n')[0]
    assert.ok(section, `Missing headers for ${file}`)
    assert.ok(section.includes('Cache-Control: no-cache, must-revalidate'))
  }
})
