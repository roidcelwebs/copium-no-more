import { DEFAULT_WEIGHT_UNIT_ID, getWeightIncrement } from "./coach-weight-units";
import { getCloudCache, persistCloudAppStateField, setCloudCacheField } from "./cloud-cache";

import { emitCloudDataChanged } from "./cloud-events";

export type SetType =
  | "warmup"
  | "normal"
  | "superset"
  | "alternating"
  | "static_strength"
  | "static_stretch";
export type Intensity = "2rir" | "1rir" | "failure";

export type WorkoutSetPrescription = {
  id: string;
  suggestedWeightMin?: number;
  suggestedWeightMax?: number;
  weightUnitId: string;
  targetReps?: number;
  repRangeMin?: number;
  repRangeMax?: number;
  timeRangeMin?: number;
  timeRangeMax?: number;
  targetSeconds?: number;
  intensity?: Intensity;
  setType: SetType;
  restSeconds?: number;
  coachNotes?: string;
};

export type WorkoutExercisePrescription = {
  id: string;
  exerciseId: string;
  notes?: string;
  sets: WorkoutSetPrescription[];
};

export type ProgramWorkout = {
  id: string;
  name: string;
  exercises: WorkoutExercisePrescription[];
  createdAt: string;
  updatedAt: string;
};

export const WORKOUTS_STORAGE_KEY = "no-more-copium:coach-workouts:v1";
export const WORKOUT_NAME_MAX_LENGTH = 80;
export const EXERCISE_NOTES_MAX_LENGTH = 300;
export const SET_NOTES_MAX_LENGTH = 300;
export const DEFAULT_REST_SECONDS = 90;

export const SET_TYPES: readonly SetType[] = [
  "warmup",
  "normal",
  "superset",
  "alternating",
  "static_strength",
  "static_stretch",
] as const;

export const INTENSITIES: readonly Intensity[] = ["2rir", "1rir", "failure"] as const;

export const SET_TYPE_LABELS: Record<SetType, string> = {
  warmup: "Warm-up",
  normal: "Normal",
  superset: "Super Set",
  alternating: "Alt. Super Set",
  static_strength: "Static Strength",
  static_stretch: "Static Stretch",
};

export const INTENSITY_LABELS: Record<Intensity, string> = {
  "2rir": "2 RIR",
  "1rir": "1 RIR",
  failure: "Failure",
};

function isSetType(value: unknown): value is SetType {
  return typeof value === "string" && (SET_TYPES as readonly string[]).includes(value);
}

function isIntensity(value: unknown): value is Intensity {
  return typeof value === "string" && (INTENSITIES as readonly string[]).includes(value);
}

function nonNegativeNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function positiveInteger(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const integer = Math.floor(value);
  return integer >= 1 ? integer : undefined;
}

function nonNegativeInteger(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.max(0, Math.floor(value));
}

function optionalNotes(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function normalizeSet(value: unknown): WorkoutSetPrescription | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== "string" || raw.id.length === 0) return null;

  const legacySetType = typeof raw.setType === "string" ? raw.setType : "normal";
  const setType: SetType =
    raw.intensity === "warmup" ? "warmup" : isSetType(legacySetType) ? legacySetType : "normal";
  const weightUnitId =
    typeof raw.weightUnitId === "string" && raw.weightUnitId.length > 0
      ? raw.weightUnitId
      : DEFAULT_WEIGHT_UNIT_ID;

  let suggestedWeightMin = nonNegativeNumber(raw.suggestedWeightMin);
  let suggestedWeightMax = nonNegativeNumber(raw.suggestedWeightMax);
  const legacyTargetWeight = nonNegativeNumber(raw.targetWeight);
  const increment = getWeightIncrement(weightUnitId);
  if (suggestedWeightMin === undefined && legacyTargetWeight !== undefined) {
    suggestedWeightMin = legacyTargetWeight;
  }
  if (suggestedWeightMax === undefined && suggestedWeightMin !== undefined) {
    suggestedWeightMax = Number((suggestedWeightMin + increment).toFixed(8));
  }
  if (
    suggestedWeightMin !== undefined &&
    suggestedWeightMax !== undefined &&
    suggestedWeightMax <= suggestedWeightMin
  ) {
    suggestedWeightMax = Number((suggestedWeightMin + increment).toFixed(8));
  }

  const legacyExactReps = positiveInteger(raw.targetReps);
  let repRangeMin = positiveInteger(raw.repRangeMin);
  let repRangeMax = positiveInteger(raw.repRangeMax);

  if (setType !== "warmup") {
    if (repRangeMin === undefined && legacyExactReps !== undefined) {
      repRangeMin = legacyExactReps;
    }
    if (repRangeMax === undefined && legacyExactReps !== undefined) {
      repRangeMax = legacyExactReps + 2;
    }
    if (repRangeMin !== undefined && repRangeMax !== undefined && repRangeMax <= repRangeMin) {
      repRangeMax = repRangeMin + 1;
    }
  }

  let timeRangeMin = positiveInteger(raw.timeRangeMin);
  let timeRangeMax = positiveInteger(raw.timeRangeMax);
  if (timeRangeMin !== undefined && timeRangeMax !== undefined && timeRangeMax <= timeRangeMin) {
    timeRangeMax = timeRangeMin + 5;
  }
  const targetSeconds = positiveInteger(raw.targetSeconds);

  const isStaticStrength = setType === "static_strength";
  const isStaticStretch = setType === "static_stretch";

  return {
    id: raw.id,
    setType,
    suggestedWeightMin,
    suggestedWeightMax,
    weightUnitId,
    targetReps: setType === "warmup" ? (legacyExactReps ?? repRangeMin) : undefined,
    repRangeMin: setType === "warmup" ? undefined : isStaticStrength || isStaticStretch ? undefined : repRangeMin,
    repRangeMax: setType === "warmup" ? undefined : isStaticStrength || isStaticStretch ? undefined : repRangeMax,
    timeRangeMin: isStaticStrength ? timeRangeMin : undefined,
    timeRangeMax: isStaticStrength ? timeRangeMax : undefined,
    targetSeconds: isStaticStretch ? targetSeconds : undefined,
    intensity: isIntensity(raw.intensity) ? raw.intensity : undefined,
    restSeconds: nonNegativeInteger(raw.restSeconds),
    coachNotes: optionalNotes(raw.coachNotes),
  };
}

function normalizeExercise(value: unknown): WorkoutExercisePrescription | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (
    typeof raw.id !== "string" ||
    raw.id.length === 0 ||
    typeof raw.exerciseId !== "string" ||
    raw.exerciseId.length === 0
  ) {
    return null;
  }
  const sets = Array.isArray(raw.sets)
    ? raw.sets.map(normalizeSet).filter((set): set is WorkoutSetPrescription => set !== null)
    : [];
  return {
    id: raw.id,
    exerciseId: raw.exerciseId,
    notes: optionalNotes(raw.notes),
    sets,
  };
}

function normalizeWorkout(value: unknown): ProgramWorkout | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (
    typeof raw.id !== "string" ||
    raw.id.length === 0 ||
    typeof raw.name !== "string" ||
    raw.name.length === 0 ||
    typeof raw.createdAt !== "string" ||
    typeof raw.updatedAt !== "string"
  ) {
    return null;
  }
  const exercises = Array.isArray(raw.exercises)
    ? raw.exercises
        .map(normalizeExercise)
        .filter((exercise): exercise is WorkoutExercisePrescription => exercise !== null)
    : [];
  return {
    id: raw.id,
    name: raw.name,
    exercises,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

export function loadWorkouts(): ProgramWorkout[] {
  if (typeof window === "undefined") return [];
  try {
    const cached = getCloudCache().workouts;
    if (!Array.isArray(cached)) return [];
    const normalized = cached
      .map(normalizeWorkout)
      .filter((workout): workout is ProgramWorkout => workout !== null);
    return makeWorkoutNamesUnique(normalized);
  } catch {
    return [];
  }
}

export function saveWorkouts(workouts: ProgramWorkout[]): void {
  if (typeof window === "undefined") return;
  try {
    setCloudCacheField("workouts", workouts);
    void persistCloudAppStateField("workouts");
    emitCloudDataChanged("workouts");
  } catch {
    // Storage can be unavailable or full; the in-memory editor remains usable.
  }
}

function randomId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createWorkoutId(): string {
  return randomId("w");
}

export function createExerciseInstanceId(): string {
  return randomId("we");
}

export function createSetId(): string {
  return randomId("s");
}

export function createDefaultSet(previous?: WorkoutSetPrescription): WorkoutSetPrescription {
  if (previous) {
    return {
      ...previous,
      id: createSetId(),
    };
  }
  return {
    id: createSetId(),
    setType: "normal",
    intensity: "2rir",
    suggestedWeightMin: 0,
    suggestedWeightMax: getWeightIncrement(DEFAULT_WEIGHT_UNIT_ID),
    weightUnitId: DEFAULT_WEIGHT_UNIT_ID,
    restSeconds: DEFAULT_REST_SECONDS,
  };
}

export function createExerciseInstance(exerciseId: string): WorkoutExercisePrescription {
  return {
    id: createExerciseInstanceId(),
    exerciseId,
    sets: [createDefaultSet()],
  };
}

export function createWorkout(input: { name: string }): ProgramWorkout {
  const now = new Date().toISOString();
  return {
    id: createWorkoutId(),
    name: input.name.trim(),
    exercises: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function sortWorkouts(workouts: ProgramWorkout[]): ProgramWorkout[] {
  return [...workouts].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function isWorkoutNameAvailable(
  workouts: ProgramWorkout[],
  name: string,
  excludedWorkoutId?: string,
): boolean {
  const normalized = name.trim().toLocaleLowerCase();
  return !workouts.some(
    (workout) =>
      workout.id !== excludedWorkoutId && workout.name.trim().toLocaleLowerCase() === normalized,
  );
}

function makeWorkoutNamesUnique(workouts: ProgramWorkout[]): ProgramWorkout[] {
  const used = new Set<string>();
  return workouts.map((workout) => {
    const baseName = workout.name.trim() || "Untitled Workout";
    let candidate = baseName;
    let suffix = 2;
    while (used.has(candidate.toLocaleLowerCase())) {
      candidate = `${baseName} (${suffix})`;
      suffix += 1;
    }
    used.add(candidate.toLocaleLowerCase());
    return candidate === workout.name ? workout : { ...workout, name: candidate };
  });
}

export function touchWorkout(workout: ProgramWorkout): ProgramWorkout {
  return { ...workout, updatedAt: new Date().toISOString() };
}

export function isValidRepPrescription(set: WorkoutSetPrescription): boolean {
  if (set.setType === "warmup") return positiveInteger(set.targetReps) !== undefined;
  const minimum = positiveInteger(set.repRangeMin);
  const maximum = positiveInteger(set.repRangeMax);
  return minimum !== undefined && maximum !== undefined && maximum > minimum;
}

export function isValidTimePrescription(set: WorkoutSetPrescription): boolean {
  if (set.setType === "static_strength") {
    const minimum = positiveInteger(set.timeRangeMin);
    const maximum = positiveInteger(set.timeRangeMax);
    return minimum !== undefined && maximum !== undefined && maximum > minimum;
  }
  if (set.setType === "static_stretch") {
    return positiveInteger(set.targetSeconds) !== undefined;
  }
  return false;
}

export function isValidSetPrescription(set: WorkoutSetPrescription): boolean {
  if (set.setType === "static_strength" || set.setType === "static_stretch") {
    return isValidTimePrescription(set);
  }
  return isValidRepPrescription(set);
}

export function isValidSuggestedWeightRange(set: WorkoutSetPrescription): boolean {
  const minimum = nonNegativeNumber(set.suggestedWeightMin);
  const maximum = nonNegativeNumber(set.suggestedWeightMax);
  return minimum !== undefined && maximum !== undefined && maximum > minimum;
}

export function formatRepPrescription(set: WorkoutSetPrescription): string | undefined {
  if (set.setType === "warmup") {
    return set.targetReps === undefined ? undefined : `${set.targetReps} reps`;
  }
  if (set.repRangeMin === undefined || set.repRangeMax === undefined) return undefined;
  return `${set.repRangeMin}–${set.repRangeMax} reps`;
}

export function formatTimePrescription(set: WorkoutSetPrescription): string | undefined {
  if (set.setType === "static_strength") {
    if (set.timeRangeMin === undefined || set.timeRangeMax === undefined) return undefined;
    return `${set.timeRangeMin}–${set.timeRangeMax}s`;
  }
  if (set.setType === "static_stretch") {
    return set.targetSeconds === undefined ? undefined : `${set.targetSeconds}s hold`;
  }
  return undefined;
}

export function formatSetPrescription(set: WorkoutSetPrescription): string | undefined {
  if (set.setType === "static_strength" || set.setType === "static_stretch") {
    return formatTimePrescription(set);
  }
  return formatRepPrescription(set);
}

export function formatSuggestedWeightRange(
  set: WorkoutSetPrescription,
  unitShortForm: string,
): string | undefined {
  if (set.suggestedWeightMin === undefined || set.suggestedWeightMax === undefined) {
    return undefined;
  }
  return `${set.suggestedWeightMin}–${set.suggestedWeightMax} ${unitShortForm}`;
}
