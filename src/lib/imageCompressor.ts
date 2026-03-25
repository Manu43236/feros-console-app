const MAX_SIZE_BYTES = 1 * 1024 * 1024 // 1 MB
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

/**
 * Compresses an image file to stay under 1 MB.
 *
 * - Non-image files (PDF etc.) are returned as-is with a size check.
 * - Images under 1 MB are returned as-is.
 * - Images over 1 MB are compressed using canvas, starting at quality 0.85
 *   and stepping down to 0.5. If quality alone isn't enough, dimensions are
 *   scaled down proportionally until the file fits.
 *
 * @throws Error if the file exceeds 1 MB and cannot be compressed (e.g. not an image).
 */
export async function compressIfNeeded(file: File): Promise<File> {
  // Non-image — just validate size
  if (!IMAGE_TYPES.includes(file.type)) {
    if (file.size > MAX_SIZE_BYTES) {
      throw new Error(`File size must be under 1 MB. Current size: ${(file.size / 1024 / 1024).toFixed(2)} MB`)
    }
    return file
  }

  // Image already within limit
  if (file.size <= MAX_SIZE_BYTES) return file

  // Compress
  return await compressImage(file)
}

async function compressImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file)
  let { width, height } = bitmap

  // Try descending quality levels first (no dimension change)
  for (const quality of [0.85, 0.75, 0.65, 0.5]) {
    const result = await drawAndExport(bitmap, width, height, file.type, quality, file.name)
    if (result.size <= MAX_SIZE_BYTES) return result
  }

  // If quality alone wasn't enough, scale down dimensions
  let scale = 0.9
  while (scale >= 0.3) {
    const w = Math.round(width * scale)
    const h = Math.round(height * scale)
    const result = await drawAndExport(bitmap, w, h, file.type, 0.7, file.name)
    if (result.size <= MAX_SIZE_BYTES) return result
    scale -= 0.1
  }

  throw new Error('Unable to compress image below 1 MB')
}

function drawAndExport(
  bitmap: ImageBitmap,
  width: number,
  height: number,
  mimeType: string,
  quality: number,
  fileName: string,
): Promise<File> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return reject(new Error('Canvas not supported'))
    ctx.drawImage(bitmap, 0, 0, width, height)

    // PNG doesn't support quality — convert to JPEG for compression
    const outputType = mimeType === 'image/png' ? 'image/jpeg' : mimeType
    const outputName = mimeType === 'image/png'
      ? fileName.replace(/\.png$/i, '.jpg')
      : fileName

    canvas.toBlob(
      blob => {
        if (!blob) return reject(new Error('Canvas toBlob failed'))
        resolve(new File([blob], outputName, { type: outputType }))
      },
      outputType,
      quality,
    )
  })
}
