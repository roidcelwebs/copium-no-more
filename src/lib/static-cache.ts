/**
 * Static UI cache - caches text and UI elements that never change
 * to eliminate delay when navigating between sections.
 * Uses in-memory Map + localStorage for persistence, but avoids overflow.
 * Only caches truly static strings (labels, headings, etc.), not user data.
 */

const STATIC_TEXT_KEYS = [
  "appName",
  "coachMode",
  "clientPreview",
  "dashboard",
  "programManager",
  "library",
  "messaging",
  "yourProgram",
  "workoutHistory",
  "todayWorkout",
  "progressPictures",
  "swipeDown",
] as const;

type StaticCache = Record<(typeof STATIC_TEXT_KEYS)[number], string>;

const DEFAULT_STATIC: StaticCache = {
  appName: "No More Copium",
  coachMode: "Coach Mode",
  clientPreview: "Client Preview",
  dashboard: "Dashboard",
  programManager: "Program Manager",
  library: "Library",
  messaging: "Messaging",
  yourProgram: "Your Program",
  workoutHistory: "Workout History",
  todayWorkout: "Today's workout",
  progressPictures: "Progress Pictures",
  swipeDown: "Swipe down",
};

const MEMORY_CACHE = new Map<string, string>();
const STORAGE_KEY = "no-more-copium:static-cache:v1";

function loadFromStorage() {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<StaticCache>;
    Object.entries(parsed).forEach(([k, v]) => {
      if (typeof v === "string") MEMORY_CACHE.set(k, v);
    });
  } catch {
    // ignore
  }
}

function saveToStorage() {
  if (typeof window === "undefined") return;
  try {
    const obj: Record<string, string> = {};
    MEMORY_CACHE.forEach((v, k) => {
      obj[k] = v;
    });
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch {
    // ignore quota
  }
}

let initialized = false;

export function cacheStaticUI() {
  if (initialized) return;
  initialized = true;
  loadFromStorage();
  // Populate with defaults if missing
  (Object.keys(DEFAULT_STATIC) as Array<keyof StaticCache>).forEach((key) => {
    if (!MEMORY_CACHE.has(key)) {
      MEMORY_CACHE.set(key, DEFAULT_STATIC[key]);
    }
  });
  // Keep cache small - only static keys, not user data, so no overflow
  // Save once, not on every navigation
  saveToStorage();
  if (typeof window !== "undefined") {
    // Warm up - ensure frequently used labels are in memory
    const warmKeys = ["appName", "dashboard", "programManager", "library", "messaging"];
    warmKeys.forEach((k) => MEMORY_CACHE.get(k));
  }
}

export function getStaticText(key: keyof StaticCache): string {
  if (!initialized) cacheStaticUI();
  return MEMORY_CACHE.get(key) ?? DEFAULT_STATIC[key] ?? key;
}

export function clearStaticCache() {
  MEMORY_CACHE.clear();
  initialized = false;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }
}
