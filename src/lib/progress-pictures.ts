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

export type ConsistencyPoint = {
  date: string;
  level: number;
  uploaded: boolean;
};

export type ProgressConsistencyData = {
  hasUploadedAny: boolean;
  currentLevel: number;
  streakDays: number;
  isStreakMode: boolean;
  points: ConsistencyPoint[];
};

/**
 * Calculates consistency level (0-7) and streak metrics across the last 7 calendar days.
 * - Level starts at baseline 0.
 * - Each day with an upload climbs +1 level up to 7.
 * - Each missed day steps down -1 level down to 0.
 * - If currentLevel reaches 7, switches to Streak Mode with the red fire icon.
 */
export function calculateProgressPictureConsistency(
  batches: readonly ProgressPictureBatch[],
  referenceDate = new Date(),
): ProgressConsistencyData {
  const uniqueDates = new Set(
    batches
      .map((batch) => batch.captureDate)
      .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)),
  );

  const hasUploadedAny = uniqueDates.size > 0;
  if (!hasUploadedAny) {
    return {
      hasUploadedAny: false,
      currentLevel: 0,
      streakDays: 0,
      isStreakMode: false,
      points: [],
    };
  }

  // Generate date array for the last 7 calendar days (from referenceDate - 6 days to referenceDate)
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(referenceDate);
    d.setDate(d.getDate() - i);
    days.push(localProgressPictureDate(d));
  }

  // Calculate level curve across the 7 days
  let runningLevel = 0;
  const points: ConsistencyPoint[] = [];

  for (let i = 0; i < days.length; i++) {
    const dateStr = days[i];
    const uploaded = uniqueDates.has(dateStr);
    if (uploaded) {
      runningLevel = Math.min(7, runningLevel + 1);
    } else {
      runningLevel = Math.max(0, runningLevel - 1);
    }
    // On the very first upload day in history, guarantee level is at least 1
    if (i === days.length - 1 && hasUploadedAny && runningLevel === 0) {
      runningLevel = 1;
    }
    points.push({
      date: dateStr,
      level: runningLevel,
      uploaded,
    });
  }

  // Calculate consecutive streak days counting backwards from today/yesterday
  let streakDays = 0;
  const todayStr = localProgressPictureDate(referenceDate);
  const checkDate = new Date(referenceDate);

  // If today has no upload, start check from yesterday
  if (!uniqueDates.has(todayStr)) {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  for (let i = 0; i < 365; i++) {
    const dStr = localProgressPictureDate(checkDate);
    if (uniqueDates.has(dStr)) {
      streakDays++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  // Fallback: If has uploaded any, streak is at least 1 if uploaded recently
  if (streakDays === 0 && hasUploadedAny) {
    streakDays = Math.min(uniqueDates.size, 1);
  }

  const currentLevel = points[points.length - 1]?.level ?? (hasUploadedAny ? 1 : 0);
  const isStreakMode = currentLevel >= 7 || streakDays >= 7;

  return {
    hasUploadedAny,
    currentLevel,
    streakDays: Math.max(streakDays, currentLevel),
    isStreakMode,
    points,
  };
}
