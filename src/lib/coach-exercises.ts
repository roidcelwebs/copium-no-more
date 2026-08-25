import { emitCloudDataChanged } from "./cloud-events";
import { getCloudCache, persistCloudAppStateField, setCloudCacheField } from "./cloud-cache";


export type Exercise = {
  id: string;
  name: string;
  tags: string[];
  description?: string;
  createdAt: string;
  updatedAt: string;
};

export const EXERCISES_STORAGE_KEY = "no-more-copium:coach-exercises:v1";
export const EXERCISE_NAME_MAX_LENGTH = 80;
export const EXERCISE_DESCRIPTION_MAX_LENGTH = 500;
export const EXERCISE_TAG_MAX_LENGTH = 32;

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

function normalizeTag(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toLowerCase();
}

export function parseTagsInput(raw: string): string[] {
  const parts = raw
    .split(/[,/\n]/)
    .map(normalizeTag)
    .filter((t) => t.length > 0 && t.length <= EXERCISE_TAG_MAX_LENGTH);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const t of parts) {
    if (seen.has(t)) continue;
    seen.add(t);
    result.push(t);
  }
  return result;
}

function normalizeExercise(value: unknown): Exercise | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (
    typeof v.id !== "string" ||
    v.id.length === 0 ||
    typeof v.name !== "string" ||
    v.name.length === 0 ||
    typeof v.createdAt !== "string" ||
    typeof v.updatedAt !== "string"
  ) {
    return null;
  }
  const tags = isStringArray(v.tags) ? v.tags.map(normalizeTag).filter(Boolean) : [];
  const description =
    typeof v.description === "string" && v.description.length > 0 ? v.description : undefined;
  return {
    id: v.id,
    name: v.name,
    tags,
    description,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
  };
}

export function loadExercises(): Exercise[] {
  if (typeof window === "undefined") return [];
  try {
    const cached = getCloudCache().exercises;
    if (!Array.isArray(cached)) return [];
    return cached.map(normalizeExercise).filter((e): e is Exercise => e !== null);
  } catch {
    return [];
  }
}

export function saveExercises(exercises: Exercise[]): void {
  if (typeof window === "undefined") return;
  try {
    setCloudCacheField("exercises", exercises);
    void persistCloudAppStateField("exercises");
    emitCloudDataChanged("exercises");
  } catch {
    // ignore
  }
}

export function createExerciseId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `e_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createExercise(input: {
  name: string;
  tags: string[];
  description?: string;
}): Exercise {
  const now = new Date().toISOString();
  return {
    id: createExerciseId(),
    name: input.name.trim(),
    tags: input.tags,
    description: input.description?.trim() ? input.description.trim() : undefined,
    createdAt: now,
    updatedAt: now,
  };
}

export function searchExercises(exercises: Exercise[], query: string): Exercise[] {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return exercises;
  return exercises.filter((e) => {
    if (e.name.toLowerCase().includes(q)) return true;
    if (e.tags.some((t) => t.includes(q))) return true;
    if (e.description && e.description.toLowerCase().includes(q)) return true;
    return false;
  });
}

export function sortExercisesByName(exercises: Exercise[]): Exercise[] {
  return [...exercises].sort((a, b) => a.name.localeCompare(b.name));
}
