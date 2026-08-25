import type {
  ProgramWorkout,
  WorkoutExercisePrescription,
  WorkoutSetPrescription,
} from "./coach-workouts";
import {
  DEFAULT_REST_SECONDS,
  isValidSetPrescription,
  isValidSuggestedWeightRange,
} from "./coach-workouts";

export type PreviewSetResult = {
  exerciseInstanceId: string;
  setId: string;
  actualWeight: number;
  actualWeightUnitId: string;
  actualReps: number;
  actualSeconds: number;
  notesToCoach?: string;
  completed: boolean;
};

export type FlatSetRef = {
  exerciseInstanceId: string;
  setId: string;
  exerciseIndex: number;
  setIndex: number;
  totalSetsInExercise: number;
  exercise: WorkoutExercisePrescription;
  set: WorkoutSetPrescription;
};

export type SessionResultsMap = Record<string, PreviewSetResult>;

export function resultKey(exerciseInstanceId: string, setId: string): string {
  return `${exerciseInstanceId}::${setId}`;
}

export function clampNonNegative(number: number): number {
  if (!Number.isFinite(number) || number < 0) return 0;
  return number;
}

export function initSessionResults(workout: ProgramWorkout): SessionResultsMap {
  const map: SessionResultsMap = {};
  for (const exercise of workout.exercises) {
    for (const set of exercise.sets) {
      map[resultKey(exercise.id, set.id)] = {
        exerciseInstanceId: exercise.id,
        setId: set.id,
        actualWeight: 0,
        actualWeightUnitId: set.weightUnitId,
        actualReps: 0,
        actualSeconds: set.setType === "static_stretch" ? (set.targetSeconds ?? 0) : 0,
        completed: false,
      };
    }
  }
  return map;
}

export function flattenSets(workout: ProgramWorkout): FlatSetRef[] {
  const flat: FlatSetRef[] = [];
  workout.exercises.forEach((exercise, exerciseIndex) => {
    exercise.sets.forEach((set, setIndex) => {
      flat.push({
        exerciseInstanceId: exercise.id,
        setId: set.id,
        exerciseIndex,
        setIndex,
        totalSetsInExercise: exercise.sets.length,
        exercise,
        set,
      });
    });
  });
  return flat;
}

export function hasAnyValidSet(workout: ProgramWorkout): boolean {
  return workout.exercises.some((exercise) =>
    exercise.sets.some((set) => isValidSetPrescription(set) && isValidSuggestedWeightRange(set)),
  );
}

export function restSecondsFor(set: WorkoutSetPrescription): number {
  return clampNonNegative(set.restSeconds ?? DEFAULT_REST_SECONDS);
}

export function formatElapsed(seconds: number): string {
  const normalized = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(normalized / 3600);
  const minutes = Math.floor((normalized % 3600) / 60);
  const remainingSeconds = normalized % 60;
  const pad = (number: number) => number.toString().padStart(2, "0");
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(remainingSeconds)}`
    : `${minutes}:${pad(remainingSeconds)}`;
}

export function computeSummary(
  workout: ProgramWorkout,
  results: SessionResultsMap,
): { completedSets: number; totalReps: number; volumeByUnitId: Record<string, number> } {
  let completedSets = 0;
  let totalReps = 0;
  const volumeByUnitId: Record<string, number> = {};
  for (const exercise of workout.exercises) {
    for (const set of exercise.sets) {
      const result = results[resultKey(exercise.id, set.id)];
      if (result?.completed) {
        completedSets += 1;
        totalReps += result.actualReps;
        volumeByUnitId[result.actualWeightUnitId] =
          (volumeByUnitId[result.actualWeightUnitId] ?? 0) +
          result.actualWeight * result.actualReps;
      }
    }
  }
  return { completedSets, totalReps, volumeByUnitId };
}

export function hasAnyProgress(workout: ProgramWorkout, results: SessionResultsMap): boolean {
  for (const exercise of workout.exercises) {
    for (const set of exercise.sets) {
      const result = results[resultKey(exercise.id, set.id)];
      if (!result) continue;
      if (result.completed || result.actualReps !== 0 || result.actualWeight !== 0) return true;
      if (result.actualSeconds !== 0) return true;
      if (result.actualWeightUnitId !== set.weightUnitId) return true;
      if (result.notesToCoach?.trim()) return true;
    }
  }
  return false;
}

export function firstIncompleteIndex(flat: FlatSetRef[], results: SessionResultsMap): number {
  for (let index = 0; index < flat.length; index += 1) {
    const result = results[resultKey(flat[index].exerciseInstanceId, flat[index].setId)];
    if (!result?.completed) return index;
  }
  return flat.length;
}
