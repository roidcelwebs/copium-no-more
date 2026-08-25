import { PROGRAM_COVER_HEIGHT, PROGRAM_COVER_WIDTH } from "./coach-programs";

export const MAX_PROGRAM_COVER_SOURCE_BYTES = 25 * 1024 * 1024;
export const MAX_PROGRAM_COVER_OUTPUT_BYTES = 1024 * 1024;

export type ProcessedProgramCover = {
  blob: Blob;
  width: number;
  height: number;
  byteSize: number;
  previewUrl: string;
};

type DecodedImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  cleanup: () => void;
};

export async function processProgramCover(file: File): Promise<ProcessedProgramCover> {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file for the cover.");
  if (file.size <= 0) throw new Error("The selected cover image is empty.");
  if (file.size > MAX_PROGRAM_COVER_SOURCE_BYTES) {
    throw new Error("The source cover image must be 25 MB or smaller.");
  }

  const decoded = await decodeImage(file);
  try {
    if (decoded.width < 1 || decoded.height < 1)
      throw new Error("The image dimensions are invalid.");
    const canvas = document.createElement("canvas");
    canvas.width = PROGRAM_COVER_WIDTH;
    canvas.height = PROGRAM_COVER_HEIGHT;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("This browser cannot process cover images.");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";

    const targetRatio = PROGRAM_COVER_WIDTH / PROGRAM_COVER_HEIGHT;
    const sourceRatio = decoded.width / decoded.height;
    let sourceX = 0;
    let sourceY = 0;
    let sourceWidth = decoded.width;
    let sourceHeight = decoded.height;
    if (sourceRatio > targetRatio) {
      sourceWidth = decoded.height * targetRatio;
      sourceX = (decoded.width - sourceWidth) / 2;
    } else if (sourceRatio < targetRatio) {
      sourceHeight = decoded.width / targetRatio;
      sourceY = (decoded.height - sourceHeight) / 2;
    }

    context.drawImage(
      decoded.source,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      PROGRAM_COVER_WIDTH,
      PROGRAM_COVER_HEIGHT,
    );

    let quality = 0.84;
    let blob: Blob | null = null;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      blob = await canvasToWebP(canvas, quality);
      if (blob.size <= MAX_PROGRAM_COVER_OUTPUT_BYTES) break;
      quality = Math.max(0.56, quality - 0.04);
    }
    canvas.width = 1;
    canvas.height = 1;
    if (!blob || blob.size > MAX_PROGRAM_COVER_OUTPUT_BYTES) {
      throw new Error(
        "The cover could not be compressed below 1 MB without excessive quality loss.",
      );
    }
    return {
      blob,
      width: PROGRAM_COVER_WIDTH,
      height: PROGRAM_COVER_HEIGHT,
      byteSize: blob.size,
      previewUrl: URL.createObjectURL(blob),
    };
  } finally {
    decoded.cleanup();
  }
}

export function releaseProgramCover(cover: ProcessedProgramCover | null | undefined): void {
  if (cover) URL.revokeObjectURL(cover.previewUrl);
}

function canvasToWebP(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob || blob.type !== "image/webp") {
          reject(new Error("This browser cannot create optimized WebP cover images."));
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
      // Use the browser image decoder below.
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
    throw new Error("The selected cover image could not be decoded.");
  }
  return {
    source: image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    cleanup: () => URL.revokeObjectURL(objectUrl),
  };
}
