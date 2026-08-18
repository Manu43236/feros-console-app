const MAX_BYTES = 2 * 1024 * 1024 // 2 MB
const MAX_PX    = 1600

export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file

  const bitmap = await createImageBitmap(file)
  const scale  = Math.min(1, MAX_PX / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width  * scale)
  const h = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width  = w
  canvas.height = h
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()

  // Try quality from 0.85 down until under 2 MB
  for (const q of [0.85, 0.75, 0.65, 0.5, 0.35]) {
    const blob = await toBlob(canvas, q)
    if (blob && blob.size <= MAX_BYTES) {
      return new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' })
    }
  }

  // Last resort — lowest quality
  const blob = await toBlob(canvas, 0.2)
  return blob
    ? new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' })
    : file
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality))
}
