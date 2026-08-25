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
export const DEFAULT_MONTHLY_REVIVES = 4;
export const STREAK_REVIVES_STORAGE_KEY = "no-more-copium:streak-revives:v1";
export const STREAK_DISMISSED_STORAGE_KEY = "no-more-copium:streak-dismissed:v1";

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

  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(referenceDate);
    d.setDate(d.getDate() - i);
    days.push(localProgressPictureDate(d));
  }

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
    if (i === days.length - 1 && hasUploadedAny && runningLevel === 0) {
      runningLevel = 1;
    }
    points.push({
      date: dateStr,
      level: runningLevel,
      uploaded,
    });
  }

  let streakDays = 0;
  const todayStr = localProgressPictureDate(referenceDate);
  const checkDate = new Date(referenceDate);

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

export type MonthlyRevivesState = {
  monthKey: string;
  revivesLeft: number;
};

export function readStreakRevives(clientId: string): number {
  if (typeof window === "undefined") return DEFAULT_MONTHLY_REVIVES;
  const currentMonth = localProgressPictureDate().slice(0, 7);
  try {
    const raw = window.localStorage.getItem(`${STREAK_REVIVES_STORAGE_KEY}:${clientId}`);
    if (!raw) return DEFAULT_MONTHLY_REVIVES;
    const parsed = JSON.parse(raw) as MonthlyRevivesState;
    if (parsed.monthKey !== currentMonth) {
      storeStreakRevives(clientId, DEFAULT_MONTHLY_REVIVES);
      return DEFAULT_MONTHLY_REVIVES;
    }
    return typeof parsed.revivesLeft === "number" ? parsed.revivesLeft : DEFAULT_MONTHLY_REVIVES;
  } catch {
    return DEFAULT_MONTHLY_REVIVES;
  }
}

export function storeStreakRevives(clientId: string, count: number): void {
  if (typeof window === "undefined") return;
  const currentMonth = localProgressPictureDate().slice(0, 7);
  try {
    const state: MonthlyRevivesState = {
      monthKey: currentMonth,
      revivesLeft: Math.max(0, count),
    };
    window.localStorage.setItem(`${STREAK_REVIVES_STORAGE_KEY}:${clientId}`, JSON.stringify(state));
  } catch (err) {
    console.error("Could not store streak revives", err);
  }
}

export function decrementStreakRevives(clientId: string): number {
  const current = readStreakRevives(clientId);
  const next = Math.max(0, current - 1);
  storeStreakRevives(clientId, next);
  return next;
}

export function isBrokenStreakDismissed(clientId: string, eventId: string): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(`${STREAK_DISMISSED_STORAGE_KEY}:${clientId}:${eventId}`) === "dismissed";
}

export function dismissBrokenStreakNotice(clientId: string, eventId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(`${STREAK_DISMISSED_STORAGE_KEY}:${clientId}:${eventId}`, "dismissed");
}

export type BrokenStreakCheck = {
  isBroken: boolean;
  previousStreak: number;
  eventId: string;
};

/**
 * Detects if a client had an established streak, missed the daily window, and opens the app today.
 */
export function checkBrokenStreak(
  batches: readonly ProgressPictureBatch[],
  clientId: string,
  referenceDate = new Date(),
): BrokenStreakCheck {
  const uniqueDates = new Set(
    batches
      .map((batch) => batch.captureDate)
      .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)),
  );

  const todayStr = localProgressPictureDate(referenceDate);
  const yesterday = new Date(referenceDate);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = localProgressPictureDate(yesterday);

  if (uniqueDates.has(yesterdayStr) || uniqueDates.has(todayStr)) {
    return { isBroken: false, previousStreak: 0, eventId: "" };
  }

  const dayBeforeYesterday = new Date(yesterday);
  dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 1);

  let prevStreak = 0;
  const cursor = new Date(dayBeforeYesterday);
  for (let i = 0; i < 365; i++) {
    const dStr = localProgressPictureDate(cursor);
    if (uniqueDates.has(dStr)) {
      prevStreak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }

  if (prevStreak >= 1) {
    const eventId = `broken-${yesterdayStr}-${prevStreak}`;
    const dismissed = isBrokenStreakDismissed(clientId, eventId);
    if (!dismissed) {
      return { isBroken: true, previousStreak: prevStreak, eventId };
    }
  }

  return { isBroken: false, previousStreak: 0, eventId: "" };
}
