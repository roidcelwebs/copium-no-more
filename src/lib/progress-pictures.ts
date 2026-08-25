export type ProgressPicture = {
  id: string;
  imageUrl: string;
  storagePath: string;
  width: number;
  height: number;
  byteSize: number;
  displayOrder: number;
  createdAt: string;
};

export type ProgressPictureBatch = {
  id: string;
  clientId: string;
  captureDate: string;
  timezone: string;
  previewPictureId?: string;
  pictures: ProgressPicture[];
  createdAt: string;
};

export type ProgressPictureMonthGroup = {
  monthKey: string;
  batches: ProgressPictureBatch[];
};

export const PROGRESS_PICTURE_VIEW_STORAGE_KEY = "no-more-copium:client-progress-picture-view:v1";
export const PROGRESS_PICTURE_HABIT_DAYS = 7;
export const EMPTY_PROGRESS_PICTURE_BATCHES: ProgressPictureBatch[] = [];

export function sortProgressPictureBatches(
  batches: readonly ProgressPictureBatch[],
): ProgressPictureBatch[] {
  return [...batches].sort((left, right) => {
    const byDate = right.captureDate.localeCompare(left.captureDate);
    return byDate !== 0 ? byDate : right.createdAt.localeCompare(left.createdAt);
  });
}

export function groupProgressPictureBatchesByMonth(
  batches: readonly ProgressPictureBatch[],
): ProgressPictureMonthGroup[] {
  const groups = new Map<string, ProgressPictureBatch[]>();
  for (const batch of sortProgressPictureBatches(batches)) {
    const monthKey = /^\d{4}-\d{2}-\d{2}$/.test(batch.captureDate)
      ? batch.captureDate.slice(0, 7)
      : "unknown";
    const existing = groups.get(monthKey);
    if (existing) existing.push(batch);
    else groups.set(monthKey, [batch]);
  }
  return [...groups].map(([monthKey, groupedBatches]) => ({
    monthKey,
    batches: groupedBatches,
  }));
}

export function latestProgressPictureBatches(
  batches: readonly ProgressPictureBatch[],
  count: number,
): ProgressPictureBatch[] {
  return sortProgressPictureBatches(batches).slice(0, Math.max(0, Math.floor(count)));
}

export function progressPictureHabitDays(batches: readonly ProgressPictureBatch[]): number {
  const uniqueDates = new Set(
    batches
      .map((batch) => batch.captureDate)
      .filter((captureDate) => /^\d{4}-\d{2}-\d{2}$/.test(captureDate)),
  );
  return Math.min(PROGRESS_PICTURE_HABIT_DAYS, uniqueDates.size);
}

export function localProgressPictureDate(date = new Date()): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getProgressPicturePreview(
  batch: ProgressPictureBatch,
): ProgressPicture | undefined {
  return (
    batch.pictures.find((picture) => picture.id === batch.previewPictureId) ?? batch.pictures[0]
  );
}

export function formatProgressPictureMonth(monthKey: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) return "Unknown month";
  const date = new Date(Number(match[1]), Number(match[2]) - 1, 1, 12);
  return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(date);
}

export function formatProgressPictureDate(captureDate: string, format: "long" | "short"): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(captureDate);
  if (!match) return "Unknown date";
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  return new Intl.DateTimeFormat(
    undefined,
    format === "long"
      ? { weekday: "long", month: "long", day: "numeric", year: "numeric" }
      : { month: "short", day: "numeric", year: "2-digit" },
  ).format(date);
}
