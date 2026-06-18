/** Maximum image file size: 5 MB */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * Read an image File as base64 data URL.
 * Rejects files larger than 5 MB.
 */
export function readImageAsDataUrl(file: File): Promise<string> {
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error('图片不能超过 5MB，请压缩后再上传');
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('图片读取失败，请重试'));
    reader.readAsDataURL(file);
  });
}

/**
 * Safely read a possibly-undefined image File.
 * Returns undefined when no file is selected.
 */
export function readOptionalImage(file?: File): Promise<string | undefined> {
  if (!file) return Promise.resolve(undefined);
  return readImageAsDataUrl(file);
}
