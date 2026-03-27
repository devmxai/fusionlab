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

  const readImageDimensions = async (): Promise<{ width: number; height: number; draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void; cleanup: () => void; }> => {
    if (typeof createImageBitmap === "function") {
      const bitmap = await createImageBitmap(file);
      return {
        width: bitmap.width,
        height: bitmap.height,
        draw: (ctx, w, h) => ctx.drawImage(bitmap, 0, 0, w, h),
        cleanup: () => bitmap.close(),
      };
    }

    const objectUrl = URL.createObjectURL(file);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Failed to load image"));
      image.src = objectUrl;
    });

    return {
      width: img.naturalWidth,
      height: img.naturalHeight,
      draw: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h),
      cleanup: () => URL.revokeObjectURL(objectUrl),
    };
  };

  const source = await readImageDimensions();
  let w = source.width;
  let h = source.height;

  // Scale down if needed
  if (w > maxWidth || h > maxHeight) {
    const ratio = Math.min(maxWidth / w, maxHeight / h);
    w = Math.round(w * ratio);
    h = Math.round(h * ratio);
  }

  const useOffscreen = typeof OffscreenCanvas !== "undefined";
  let blob: Blob;

  if (useOffscreen) {
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas context unavailable");
    source.draw(ctx, w, h);

    let currentQuality = quality;
    blob = await canvas.convertToBlob({ type: "image/webp", quality: currentQuality });

    for (let i = 0; i < 4 && blob.size > maxSizeKB * 1024; i++) {
      currentQuality = Math.max(0.5, currentQuality - 0.1);
      blob = await canvas.convertToBlob({ type: "image/webp", quality: currentQuality });
    }
  } else {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas context unavailable");
    source.draw(ctx, w, h);

    const toBlob = (q: number) =>
      new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((result) => {
          if (!result) {
            reject(new Error("Failed to encode image"));
            return;
          }
          resolve(result);
        }, "image/webp", q);
      });

    let currentQuality = quality;
    blob = await toBlob(currentQuality);
    for (let i = 0; i < 4 && blob.size > maxSizeKB * 1024; i++) {
      currentQuality = Math.max(0.5, currentQuality - 0.1);
      blob = await toBlob(currentQuality);
    }
  }

  source.cleanup();

  const ext = "webp";
  const name = file.name.replace(/\.[^.]+$/, `.${ext}`);
  return new File([blob], name, { type: blob.type });
}
