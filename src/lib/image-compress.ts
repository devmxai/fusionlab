/**
 * Compress an image file client-side before uploading.
 * Returns a compressed Blob (JPEG or WebP) ≤ maxSizeKB.
 */
export async function compressImage(
  file: File,
  options: { maxWidth?: number; maxHeight?: number; quality?: number; maxSizeKB?: number } = {}
): Promise<File> {
  const { maxWidth = 1200, maxHeight = 1200, quality = 0.82, maxSizeKB = 300 } = options;

  // Skip if already small enough
  if (file.size <= maxSizeKB * 1024) return file;

  const bitmap = await createImageBitmap(file);
  let w = bitmap.width;
  let h = bitmap.height;

  // Scale down if needed
  if (w > maxWidth || h > maxHeight) {
    const ratio = Math.min(maxWidth / w, maxHeight / h);
    w = Math.round(w * ratio);
    h = Math.round(h * ratio);
  }

  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  // Try WebP first, fall back to JPEG
  let blob = await canvas.convertToBlob({ type: "image/webp", quality });
  if (blob.size > maxSizeKB * 1024) {
    blob = await canvas.convertToBlob({ type: "image/webp", quality: quality * 0.7 });
  }

  const ext = "webp";
  const name = file.name.replace(/\.[^.]+$/, `.${ext}`);
  return new File([blob], name, { type: blob.type });
}
