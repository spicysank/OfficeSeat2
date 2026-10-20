import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BASE64_CHARS } from '@/types';

export interface OptimizedImage {
  imageBase64: string;
  imageMimeType: string;
  imageWidth: number;
  imageHeight: number;
  imageSizeBytes: number;
}

export interface RawImageInfo {
  mimeType: string;
  width: number;
  height: number;
  sizeBytes: number;
}

const MAX_DIMENSION = 1600;
const INITIAL_QUALITY = 0.8;
const MIN_QUALITY = 0.3;

function detectMimeType(file: File): string {
  // Use the actual file type from the browser, not the extension.
  if (file.type && ALLOWED_IMAGE_TYPES.includes(file.type)) return file.type;
  return file.type || 'application/octet-stream';
}

export function validateRawImage(file: File): string | null {
  const type = detectMimeType(file);
  if (!ALLOWED_IMAGE_TYPES.includes(type)) {
    return 'Only PNG and JPEG image files are allowed.';
  }
  if (file.size > 10 * 1024 * 1024) {
    return 'The selected file is too large (max 10 MB). Please choose a smaller image.';
  }
  return null;
}

export async function inspectImage(file: File): Promise<RawImageInfo> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    return {
      mimeType: detectMimeType(file),
      width: img.naturalWidth,
      height: img.naturalHeight,
      sizeBytes: file.size,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load the image file.'));
    img.src = src;
  });
}

function canvasToDataUrl(
  canvas: HTMLCanvasElement,
  mime: string,
  quality: number,
): string {
  return canvas.toDataURL(mime, quality);
}

/**
 * Optimize an image file: resize if larger than MAX_DIMENSION (preserving
 * aspect ratio) and compress iteratively until the Base64 data URL fits
 * under MAX_IMAGE_BASE64_CHARS. Returns null if it cannot fit.
 */
export async function optimizeImage(
  file: File,
  onProgress?: (msg: string) => void,
): Promise<OptimizedImage | null> {
  const type = detectMimeType(file);
  const outMime = type === 'image/png' ? 'image/jpeg' : 'image/jpeg';
  // We convert PNGs to JPEG for compression too (floor plans are fine as JPEG).

  onProgress?.('Loading image…');
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);

    let { naturalWidth: w, naturalHeight: h } = img;
    if (w > MAX_DIMENSION || h > MAX_DIMENSION) {
      onProgress?.('Resizing to fit limits…');
      const scale = Math.min(MAX_DIMENSION / w, MAX_DIMENSION / h);
      w = Math.round(w * scale);
      h = Math.round(h * scale);
    }

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);

    let quality = INITIAL_QUALITY;
    onProgress?.('Compressing image…');
    let dataUrl = canvasToDataUrl(canvas, outMime, quality);

    while (dataUrl.length > MAX_IMAGE_BASE64_CHARS && quality > MIN_QUALITY) {
      quality -= 0.1;
      onProgress?.(`Compressing further (${Math.round(quality * 100)}%)…`);
      dataUrl = canvasToDataUrl(canvas, outMime, quality);
    }

    if (dataUrl.length > MAX_IMAGE_BASE64_CHARS) {
      // Try shrinking dimensions further.
      let scale = 0.85;
      while (dataUrl.length > MAX_IMAGE_BASE64_CHARS && scale > 0.2) {
        onProgress?.(`Shrinking image (${Math.round(scale * 100)}%)…`);
        canvas.width = Math.round(w * scale);
        canvas.height = Math.round(h * scale);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        dataUrl = canvasToDataUrl(canvas, outMime, quality);
        scale -= 0.1;
      }
    }

    if (dataUrl.length > MAX_IMAGE_BASE64_CHARS) {
      return null;
    }

    return {
      imageBase64: dataUrl,
      imageMimeType: outMime,
      imageWidth: canvas.width,
      imageHeight: canvas.height,
      imageSizeBytes: dataUrl.length,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsDataURL(blob);
  });
}
