export function pdfFile(blob: Blob, filename: string) {
  return new File([blob], filename, { type: 'application/pdf' })
}
export function canSharePdf(file: File) {
  return typeof navigator.share === 'function' && (typeof navigator.canShare !== 'function' || navigator.canShare({ files: [file] }))
}
export async function sharePdf(file: File): Promise<boolean> {
  if (!canSharePdf(file)) throw new Error('This browser cannot share PDF files directly. The VS Code integrated browser does not provide a native share menu. Open this page in a supported browser, such as Chrome on Android or Safari on iPhone, then tap Share. No download is required there. Download remains available here.')
  try {
    await navigator.share({ files: [file], title: file.name })
    return true
  } catch (failure) {
    if (failure instanceof DOMException && failure.name === 'AbortError') return false
    throw failure
  }
}
export function downloadPdf(file: File) {
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url; link.download = file.name
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 60000)
}
