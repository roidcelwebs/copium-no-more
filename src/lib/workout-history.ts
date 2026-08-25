import { supabase } from "@/integrations/supabase/client";
import type { Exercise } from "./coach-exercises";
import type { WeightUnit } from "./coach-weight-units";
import { getWeightUnit } from "./coach-weight-units";
import type { ProgramWorkout } from "./coach-workouts";
import type { SessionResultsMap } from "./coach-workout-preview";
import { computeSummary, resultKey } from "./coach-workout-preview";
import { emitLocalEvent, LOCAL_WORKOUT_HISTORY_CHANGED_EVENT } from "./local-events";

export type WorkoutSessionUnitSnapshot = {
  id: string;
  longForm: string;
  shortForm: string;
};

export type WorkoutSessionSetSnapshot = {
  setId: string;
  setNumber: number;
  setType: string;
  intensity?: string;
  suggestedWeightMin?: number;
  suggestedWeightMax?: number;
  suggestedWeightUnit: WorkoutSessionUnitSnapshot;
  targetReps?: number;
  repRangeMin?: number;
  repRangeMax?: number;
  timeRangeMin?: number;
  timeRangeMax?: number;
  targetSeconds?: number;
  restSeconds?: number;
  coachNotes?: string;
  completed: boolean;
  weightDone: number;
  weightDoneUnit: WorkoutSessionUnitSnapshot;
  repsDone: number;
  secondsDone: number;
  notesToCoach?: string;
};

export type WorkoutSessionExerciseSnapshot = {
  exerciseInstanceId: string;
  exerciseId: string;
  exerciseName: string;
  coachNotes?: string;
  sets: WorkoutSessionSetSnapshot[];
};

export type WorkoutSessionData = {
  version: 1;
  exercises: WorkoutSessionExerciseSnapshot[];
};

export type WorkoutHistorySession = {
  id: string;
  clientId: string;
  programId?: string;
  workoutId: string;
  workoutName: string;
  startedAt: string;
  completedAt: string;
  durationSeconds: number;
  completedSets: number;
  totalSets: number;
  totalReps: number;
  volumeByUnitId: Record<string, number>;
  data: WorkoutSessionData;
};

type CloudSessionRow = {
  id: string;
  client_id: string;
  program_id: string | null;
  workout_id: string;
  workout_name: string;
  started_at: string;
  completed_at: string;
  duration_seconds: number;
  completed_sets: number;
  total_sets: number;
  total_reps: number;
  volume_by_unit: Record<string, number>;
  session_data: WorkoutSessionData;
};

function mapSession(row: CloudSessionRow): WorkoutHistorySession {
  return {
    id: row.id,
    clientId: row.client_id,
    programId: row.program_id ?? undefined,
    workoutId: row.workout_id,
    workoutName: row.workout_name,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    durationSeconds: row.duration_seconds,
    completedSets: row.completed_sets,
    totalSets: row.total_sets,
    totalReps: row.total_reps,
    volumeByUnitId: row.volume_by_unit ?? {},
    data: row.session_data,
  };
}

export function createWorkoutSessionId(): string {
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

function unitSnapshot(unit: WeightUnit): WorkoutSessionUnitSnapshot {
  return { id: unit.id, longForm: unit.longForm, shortForm: unit.shortForm };
}

function nonNegativeInteger(value: unknown): number {
  const number = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return Math.max(0, Math.floor(number));
}

export function buildWorkoutSessionData({
  workout,
  exercises,
  weightUnits,
  results,
}: {
  workout: ProgramWorkout;
  exercises: Exercise[];
  weightUnits: WeightUnit[];
  results: SessionResultsMap;
}): WorkoutSessionData {
  const exercisesById = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  return {
    version: 1,
    exercises: workout.exercises.map((exercise) => {
      const definition = exercisesById.get(exercise.exerciseId);
      return {
        exerciseInstanceId: exercise.id,
        exerciseId: exercise.exerciseId,
        exerciseName: definition?.name ?? "Unknown exercise",
        coachNotes: exercise.notes,
        sets: exercise.sets.map((set, setIndex) => {
          const result = results[resultKey(exercise.id, set.id)];
          const suggestedUnit = getWeightUnit(weightUnits, set.weightUnitId);
          const doneUnit = getWeightUnit(
            weightUnits,
            result?.actualWeightUnitId ?? set.weightUnitId,
          );
          return {
            setId: set.id,
            setNumber: setIndex + 1,
            setType: set.setType,
            intensity: set.intensity,
            suggestedWeightMin: set.suggestedWeightMin,
            suggestedWeightMax: set.suggestedWeightMax,
            suggestedWeightUnit: unitSnapshot(suggestedUnit),
            targetReps: set.targetReps,
            repRangeMin: set.repRangeMin,
            repRangeMax: set.repRangeMax,
            timeRangeMin: set.timeRangeMin,
            timeRangeMax: set.timeRangeMax,
            targetSeconds: set.targetSeconds,
            restSeconds: set.restSeconds,
            coachNotes: set.coachNotes,
            completed: result?.completed ?? false,
            weightDone: result?.actualWeight ?? 0,
            weightDoneUnit: unitSnapshot(doneUnit),
            repsDone: result?.actualReps ?? 0,
            secondsDone: result?.actualSeconds ?? 0,
            notesToCoach: result?.notesToCoach,
          };
        }),
      };
    }),
  };
}

export async function saveWorkoutSession({
  sessionId = createWorkoutSessionId(),
  clientId,
  programId,
  workout,
  exercises,
  weightUnits,
  results,
  durationSeconds,
  completedAt = new Date(),
}: {
  sessionId?: string;
  clientId: string;
  programId?: string;
  workout: ProgramWorkout;
  exercises: Exercise[];
  weightUnits: WeightUnit[];
  results: SessionResultsMap;
  durationSeconds: number;
  completedAt?: Date;
}): Promise<WorkoutHistorySession> {
  const normalizedDuration = nonNegativeInteger(durationSeconds);
  const summary = computeSummary(workout, results);
  const totalSets = workout.exercises.reduce((total, exercise) => total + exercise.sets.length, 0);
  const completedAtIso = completedAt.toISOString();
  const startedAtIso = new Date(completedAt.getTime() - normalizedDuration * 1000).toISOString();
  const data = buildWorkoutSessionData({ workout, exercises, weightUnits, results });

  const { data: row, error } = await supabase
    .from("workout_sessions")
    .insert({
      id: sessionId,
      client_id: clientId,
      program_id: programId ?? null,
      workout_id: workout.id,
      workout_name: workout.name,
      started_at: startedAtIso,
      completed_at: completedAtIso,
      duration_seconds: normalizedDuration,
      completed_sets: summary.completedSets,
      total_sets: totalSets,
      total_reps: summary.totalReps,
      volume_by_unit: summary.volumeByUnitId,
      session_data: data,
    })
    .select()
    .maybeSingle();
  if (error || !row) {
    throw new Error("Workout history could not be saved to the cloud.");
  }
  emitLocalEvent(LOCAL_WORKOUT_HISTORY_CHANGED_EVENT);
  return mapSession(row as unknown as CloudSessionRow);
}

export async function fetchWorkoutSessions(clientId: string): Promise<WorkoutHistorySession[]> {
  const { data, error } = await supabase
    .from("workout_sessions")
    .select(
      "id, client_id, program_id, workout_id, workout_name, started_at, completed_at, duration_seconds, completed_sets, total_sets, total_reps, volume_by_unit, session_data",
    )
    .eq("client_id", clientId)
    .order("completed_at", { ascending: false });
  if (error) {
    console.error("Workout history could not be loaded", error);
    return [];
  }
  return (data ?? []).map((row) => mapSession(row as unknown as CloudSessionRow));
}

export type LastExerciseWeight = {
  weight: number;
  unitId: string;
  unitShortForm: string;
  at: string;
};

/**
 * For every exercise, the weight the client did the LAST time that exercise
 * was performed — computed from completed non-warm-up sets only.
 * Sessions are expected newest-first; the first session that contains a
 * qualifying set wins for each exercise.
 */
export function computeLastWeightsByExercise(
  sessions: WorkoutHistorySession[],
): Record<string, LastExerciseWeight> {
  const map: Record<string, LastExerciseWeight> = {};
  const ordered = [...sessions].sort((left, right) =>
    right.completedAt.localeCompare(left.completedAt),
  );
  for (const session of ordered) {
    for (const exercise of session.data.exercises) {
      if (map[exercise.exerciseId]) continue;
      let bestWeight = 0;
      let bestUnitId = "";
      let bestUnitShort = "";
      for (const set of exercise.sets) {
        if (!set.completed || set.setType === "warmup") continue;
        if (set.weightDone > 0 && set.weightDone > bestWeight) {
          bestWeight = set.weightDone;
          bestUnitId = set.weightDoneUnit.id;
          bestUnitShort = set.weightDoneUnit.shortForm;
        }
      }
      if (bestWeight > 0) {
        map[exercise.exerciseId] = {
          weight: bestWeight,
          unitId: bestUnitId,
          unitShortForm: bestUnitShort,
          at: session.completedAt,
        };
      }
    }
  }
  return map;
}

export async function fetchLastWeightsByExercise(
  clientId: string,
): Promise<Record<string, LastExerciseWeight>> {
  return computeLastWeightsByExercise(await fetchWorkoutSessions(clientId));
}

export async function updateWorkoutSession(
  clientId: string,
  sessionId: string,
  patch: {
    data?: WorkoutSessionData;
    durationSeconds?: number;
    completedAt?: string;
  },
): Promise<void> {
  const current = (await fetchWorkoutSessions(clientId)).find(
    (session) => session.id === sessionId,
  );
  if (!current) return;
  const data = patch.data ?? current.data;
  const summary = computeSnapshotSummary(data);
  const { error } = await supabase
    .from("workout_sessions")
    .update({
      session_data: data,
      duration_seconds: nonNegativeInteger(patch.durationSeconds ?? current.durationSeconds),
      completed_at: patch.completedAt ?? current.completedAt,
      completed_sets: summary.completedSets,
      total_sets: summary.totalSets,
      total_reps: summary.totalReps,
      volume_by_unit: summary.volumeByUnitId,
    })
    .eq("id", sessionId)
    .eq("client_id", clientId);
  if (error) throw new Error("Workout history could not be updated.");
  emitLocalEvent(LOCAL_WORKOUT_HISTORY_CHANGED_EVENT);
}

export async function deleteWorkoutSession(
  clientId: string,
  sessionId: string,
): Promise<void> {
  const { error } = await supabase
    .from("workout_sessions")
    .delete()
    .eq("id", sessionId)
    .eq("client_id", clientId);
  if (error) throw new Error("Workout history entry could not be deleted.");
  emitLocalEvent(LOCAL_WORKOUT_HISTORY_CHANGED_EVENT);
}

function computeSnapshotSummary(data: WorkoutSessionData): {
  completedSets: number;
  totalSets: number;
  totalReps: number;
  volumeByUnitId: Record<string, number>;
} {
  let completedSets = 0;
  let totalSets = 0;
  let totalReps = 0;
  const volumeByUnitId: Record<string, number> = {};
  for (const exercise of data.exercises) {
    for (const set of exercise.sets) {
      totalSets += 1;
      if (set.completed) {
        completedSets += 1;
        totalReps += set.repsDone || 0;
        const weight = set.weightDone || 0;
        const unitId = set.weightDoneUnit?.id;
        if (unitId && weight > 0) {
          volumeByUnitId[unitId] = (volumeByUnitId[unitId] ?? 0) + weight * (set.repsDone || 0);
        }
      }
    }
  }
  return { completedSets, totalSets, totalReps, volumeByUnitId };
}
