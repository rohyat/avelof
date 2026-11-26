export async function readReceiptScreenshot(file: File): Promise<string> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Choose a PNG, JPEG or WebP payment screenshot.')
  if (file.size > 5 * 1024 * 1024) throw new Error('Choose a screenshot smaller than 5 MB.')
  const bitmap = await createImageBitmap(file)
  try {
    if (!bitmap.width || !bitmap.height) throw new Error('The screenshot could not be read.')
    const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('This browser cannot prepare screenshot images.')
    context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.9)
  } finally { bitmap.close() }
}
