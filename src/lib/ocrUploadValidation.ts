// Multipart overhead must also fit inside the hosting platform's request limit.
export const OCR_MAX_BYTES = 4 * 1024 * 1024;
export const OCR_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function validateOcrUpload(file: { size: number; type: string }) {
  if (!Number.isFinite(file.size) || file.size <= 0) return 'empty' as const;
  if (file.size > OCR_MAX_BYTES) return 'too_large' as const;
  if (!OCR_IMAGE_TYPES.has(file.type)) return 'bad_type' as const;
  return null;
}
