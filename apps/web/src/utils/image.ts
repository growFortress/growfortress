/**
 * Image utility functions
 */

/**
 * Convert a File to base64 data URL
 * @param file - The file to convert
 * @param maxSizeMB - Maximum file size in MB (default: 2)
 * @returns Promise resolving to base64 data URL string
 */
export async function convertFileToBase64(
  file: File,
  maxSizeMB: number = 2
): Promise<string> {
  // Check file size
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    throw new Error(`File size exceeds ${maxSizeMB}MB limit`);
  }

  // Check file type
  const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Only PNG and JPEG images are allowed');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        resolve(result);
      } else {
        reject(new Error('Failed to read file'));
      }
    };

    reader.onerror = () => {
      reject(new Error('Error reading file'));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Validate image dimensions (optional - can be used for client-side validation)
 * @param file - The image file
 * @param maxWidth - Maximum width in pixels (default: 256)
 * @param maxHeight - Maximum height in pixels (default: 256)
 * @returns Promise resolving to true if dimensions are valid
 */
export async function validateImageDimensions(
  file: File,
  maxWidth: number = 256,
  maxHeight: number = 256
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      if (img.width > maxWidth || img.height > maxHeight) {
        reject(new Error(`Image dimensions must be at most ${maxWidth}x${maxHeight}px`));
      } else {
        resolve(true);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Invalid image file'));
    };

    img.src = url;
  });
}

/**
 * Resize image to fit within max dimensions (optional helper)
 * @param file - The image file
 * @param maxWidth - Maximum width in pixels (default: 256)
 * @param maxHeight - Maximum height in pixels (default: 256)
 * @param quality - JPEG quality 0-1 (default: 0.9)
 * @returns Promise resolving to base64 data URL of resized image
 */
export async function resizeImageToBase64(
  file: File,
  maxWidth: number = 256,
  maxHeight: number = 256,
  quality: number = 0.9
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      // Calculate new dimensions
      let { width, height } = img;
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.floor(width * ratio);
        height = Math.floor(height * ratio);
      }

      // Create canvas and resize
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      // Convert to base64
      const mimeType = file.type || 'image/png';
      const dataUrl = canvas.toDataURL(mimeType, quality);
      resolve(dataUrl);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Invalid image file'));
    };

    img.src = url;
  });
}
