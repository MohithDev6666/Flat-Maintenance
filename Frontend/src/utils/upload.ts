/** File picker filter: photos and PDF only. */
export const photoOrPdf: Record<string, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg', '.jpe', '.jfif'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/gif': ['.gif'],
  'image/bmp': ['.bmp'],
  'image/tiff': ['.tif', '.tiff'],
  'image/avif': ['.avif'],
  'image/heic': ['.heic'],
  'image/heif': ['.heif'],
  'application/pdf': ['.pdf'],
}

export const uploadRejectMessage = 'Choose a photo (JPG, PNG, or another photo format) or a PDF under 8 MB.'

export function chosenFileKind(file: File): 'image' | 'pdf' {
  const name = file.name.toLowerCase()
  if (file.type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf'
  return 'image'
}
