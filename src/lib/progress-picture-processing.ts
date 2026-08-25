export const MAX_PROGRESS_PICTURES_PER_BATCH = 6;
export const MAX_PROGRESS_PICTURE_SOURCE_BYTES = 25 * 1024 * 1024;
export const MAX_PROGRESS_PICTURE_OUTPUT_BYTES = Math.floor(2.5 * 1024 * 1024);
export const MAX_PROGRESS_PICTURE_EDGE = 1920;
export const PROGRESS_PICTURE_WEBP_QUALITY = 0.84;

export type ProcessedProgressPicture = {
  id: string;
  blob: Blob;
  width: number;
  height: number;
  byteSize: number;
  originalName: string;
};

type DecodedImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  cleanup: () => void;
};

export async function processProgressPicture(file: File): Promise<ProcessedProgressPicture> {
  if (!file.type.startsWith("image/")) {
    throw new Error(`${file.name || "This file"} is not an image.`);
  }
  if (file.size <= 0) throw new Error(`${file.name || "This image"} is empty.`);
  if (file.size > MAX_PROGRESS_PICTURE_SOURCE_BYTES) {
    throw new Error(`${file.name || "This image"} is larger than 25 MB.`);
  }

  const decoded = await decodeImage(file);
  try {
    if (decoded.width < 1 || decoded.height < 1) {
      throw new Error(`${file.name || "This image"} has invalid dimensions.`);
    }
    const processed = await encodeEfficientWebP(decoded);
    return {
      id: createPictureId(),
      blob: processed.blob,
      width: processed.width,
      height: processed.height,
      byteSize: processed.blob.size,
      originalName: file.name || "Progress picture",
    };
  } finally {
    decoded.cleanup();
  }
}

export async function processProgressPictures(
  files: readonly File[],
  remainingSlots: number,
  onProgress?: (completed: number, total: number) => void,
): Promise<ProcessedProgressPicture[]> {
  const accepted = files.slice(0, Math.max(0, remainingSlots));
  const processed: ProcessedProgressPicture[] = [];
  for (let index = 0; index < accepted.length; index += 1) {
    processed.push(await processProgressPicture(accepted[index]));
    onProgress?.(index + 1, accepted.length);
  }
  return processed;
}

export function createProgressBatchId(): string {
  return createUuid();
}

export function progressPictureStoragePath({
  clientId,
  batchId,
  pictureId,
}: {
  clientId: string;
  batchId: string;
  pictureId: string;
}): string {
  return `${clientId}/${batchId}/${pictureId}.webp`;
}

export function formatProgressPictureBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function encodeEfficientWebP(
  decoded: DecodedImage,
): Promise<{ blob: Blob; width: number; height: number }> {
  const initialScale = Math.min(
    1,
    MAX_PROGRESS_PICTURE_EDGE / Math.max(decoded.width, decoded.height),
  );
  let width = Math.max(1, Math.round(decoded.width * initialScale));
  let height = Math.max(1, Math.round(decoded.height * initialScale));
  let quality = PROGRESS_PICTURE_WEBP_QUALITY;

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("This browser cannot process images.");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(decoded.source, 0, 0, width, height);

    const blob = await canvasToWebP(canvas, quality);
    canvas.width = 1;
    canvas.height = 1;
    if (blob.size <= MAX_PROGRESS_PICTURE_OUTPUT_BYTES) return { blob, width, height };

    if (quality > 0.72) {
      quality = Number(Math.max(0.72, quality - 0.04).toFixed(2));
    } else {
      width = Math.max(1, Math.round(width * 0.86));
      height = Math.max(1, Math.round(height * 0.86));
      quality = 0.8;
    }
  }

  throw new Error(
    "This image could not be compressed below 2.5 MB without excessive quality loss.",
  );
}

function canvasToWebP(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob || blob.type !== "image/webp") {
          reject(new Error("This browser cannot create optimized WebP images."));
          return;
        }
        resolve(blob);
      },
      "image/webp",
      quality,
    );
  });
}

async function decodeImage(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => bitmap.close(),
      };
    } catch {
      // Fall back to the browser image decoder below.
    }
  }

  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = "async";
  image.src = objectUrl;
  try {
    await image.decode();
  } catch {
    URL.revokeObjectURL(objectUrl);
    throw new Error(`${file.name || "This image"} could not be decoded.`);
  }
  return {
    source: image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    cleanup: () => URL.revokeObjectURL(objectUrl),
  };
}

function createPictureId(): string {
  return createUuid();
}

function createUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const hex = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16));
  hex[12] = "4";
  hex[16] = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8).join("")}-${hex.slice(8, 12).join("")}-${hex
    .slice(12, 16)
    .join("")}-${hex.slice(16, 20).join("")}-${hex.slice(20).join("")}`;
}
