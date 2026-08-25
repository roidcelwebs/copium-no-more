import { emitLocalEvent, LOCAL_PROGRESS_PICTURES_CHANGED_EVENT } from "./local-events";
import { getLocalBlob, putLocalBlob } from "./local-media";
import {
  createProgressBatchId,
  type ProcessedProgressPicture,
  progressPictureStoragePath,
} from "./progress-picture-processing";
import type { ProgressPicture, ProgressPictureBatch } from "./progress-pictures";
import { sortProgressPictureBatches } from "./progress-pictures";

const METADATA_KEY = "no-more-copium:progress-picture-batches:v2";

type StoredPicture = Omit<ProgressPicture, "imageUrl">;
type StoredBatch = Omit<ProgressPictureBatch, "pictures"> & { pictures: StoredPicture[] };

export async function fetchProgressPictureBatches(
  clientId: string,
): Promise<ProgressPictureBatch[]> {
  const batches = readBatches().filter((batch) => batch.clientId === clientId);
  const hydrated = await Promise.all(
    batches.map(async (batch) => ({
      ...batch,
      pictures: await Promise.all(
        batch.pictures.map(async (picture) => {
          const blob = await getLocalBlob(`progress:${picture.storagePath}`);
          return { ...picture, imageUrl: blob ? URL.createObjectURL(blob) : "" };
        }),
      ),
    })),
  );
  return sortProgressPictureBatches(hydrated);
}

export async function uploadProgressPictureBatch({
  clientId,
  captureDate,
  timezone,
  pictures,
  existingBatch,
  onProgress,
}: {
  clientId: string;
  captureDate: string;
  timezone: string;
  pictures: ProcessedProgressPicture[];
  existingBatch?: ProgressPictureBatch;
  onProgress?: (uploaded: number, total: number) => void;
}): Promise<string> {
  const batches = readBatches();
  const storedExisting = existingBatch
    ? batches.find((batch) => batch.id === existingBatch.id && batch.clientId === clientId)
    : undefined;
  const existingCount = storedExisting?.pictures.length ?? 0;
  if (pictures.length < 1 || existingCount + pictures.length > 6) {
    throw new Error(`Select between 1 and ${Math.max(0, 6 - existingCount)} progress pictures.`);
  }

  const batchId = storedExisting?.id ?? createProgressBatchId();
  const createdAt = storedExisting?.createdAt ?? new Date().toISOString();
  const storedPictures: StoredPicture[] = [];
  for (let index = 0; index < pictures.length; index += 1) {
    const picture = pictures[index];
    const storagePath = progressPictureStoragePath({ clientId, batchId, pictureId: picture.id });
    await putLocalBlob(`progress:${storagePath}`, picture.blob);
    storedPictures.push({
      id: picture.id,
      storagePath,
      width: picture.width,
      height: picture.height,
      byteSize: picture.byteSize,
      displayOrder: existingCount + index,
      createdAt: new Date().toISOString(),
    });
    onProgress?.(index + 1, pictures.length);
  }

  const previewPictureId =
    storedExisting?.previewPictureId ??
    storedPictures[Math.floor(Math.random() * storedPictures.length)].id;
  const nextBatch: StoredBatch = {
    id: batchId,
    clientId,
    captureDate,
    timezone,
    previewPictureId,
    pictures: [...(storedExisting?.pictures ?? []), ...storedPictures],
    createdAt,
  };
  const next = batches.filter((batch) => batch.id !== batchId);
  next.push(nextBatch);
  writeBatches(next);
  return batchId;
}

export async function setProgressPicturePreview({
  clientId,
  batchId,
  pictureId,
}: {
  clientId: string;
  batchId: string;
  pictureId: string;
}): Promise<void> {
  const batches = readBatches();
  const batch = batches.find(
    (candidate) => candidate.id === batchId && candidate.clientId === clientId,
  );
  if (!batch || !batch.pictures.some((picture) => picture.id === pictureId)) {
    throw new Error("Progress picture was not found on this device.");
  }
  writeBatches(
    batches.map((candidate) =>
      candidate.id === batchId ? { ...candidate, previewPictureId: pictureId } : candidate,
    ),
  );
}

function readBatches(): StoredBatch[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(METADATA_KEY) ?? "[]");
    return Array.isArray(parsed) ? (parsed as StoredBatch[]) : [];
  } catch {
    return [];
  }
}

function writeBatches(batches: StoredBatch[]): void {
  window.localStorage.setItem(METADATA_KEY, JSON.stringify(batches));
  emitLocalEvent(LOCAL_PROGRESS_PICTURES_CHANGED_EVENT);
}
