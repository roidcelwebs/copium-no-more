import { supabase } from "@/integrations/supabase/client";
import type { ProgramWorkout } from "./coach-workouts";
import { loadWorkouts } from "./coach-workouts";
import { loadExercises } from "./coach-exercises";
import { getAllWeightUnits, loadCustomWeightUnits } from "./coach-weight-units";
import { resultKey, type SessionResultsMap } from "./coach-workout-preview";
import { emitLocalEvent } from "./local-events";
import { supabaseLoose } from "./supabase-loose-client";
import { saveWorkoutSession } from "./workout-history";

export type PausedWorkoutSession = {
  id: string;
  clientId: string;
  programId?: string;
  workoutId: string;
  workoutName: string;
  pausedAt: string;
  elapsedSeconds: number;
  results: SessionResultsMap;
  hasWorkingProgress: boolean;
};

export const LOCAL_PAUSED_WORKOUTS_CHANGED_EVENT =
  "no-more-copium:local-paused-workouts-changed";

type CloudPausedRow = {
  id: string;
  client_id: string;
  program_id: string | null;
  workout_id: string;
  workout_name: string;
  paused_at: string;
  elapsed_seconds: number;
  results: SessionResultsMap;
  has_working_progress: boolean;
};

function mapRow(row: CloudPausedRow): PausedWorkoutSession {
  return {
    id: row.id,
    clientId: row.client_id,
    programId: row.program_id ?? undefined,
    workoutId: row.workout_id,
    workoutName: row.workout_name,
    pausedAt: row.paused_at,
    elapsedSeconds: row.elapsed_seconds,
    results: row.results ?? {},
    hasWorkingProgress: row.has_working_progress,
  };
}

/** A paused session is "expired" (auto-finalizes) once the pause happened on a previous calendar day. */
export function isPreviousDayPaused(session: PausedWorkoutSession, now: Date): boolean {
  const paused = new Date(session.pausedAt);
  if (Number.isNaN(paused.getTime())) return true;
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return paused < todayStart;
}

/**
 * True if the client completed at least one non-warm-up set with actual
 * weight/reps/time logged. Warm-up-only progress never creates a history entry.
 */
export function hasWorkingProgressInResults(
  workout: ProgramWorkout,
  results: SessionResultsMap,
): boolean {
  for (const exercise of workout.exercises) {
    for (const set of exercise.sets) {
      if (set.setType === "warmup") continue;
      const result = results[resultKey(exercise.id, set.id)];
      if (!result?.completed) continue;
      if (result.actualWeight > 0 || result.actualReps > 0 || result.actualSeconds > 0) {
        return true;
      }
    }
  }
  return false;
}

export async function savePausedWorkout(session: PausedWorkoutSession): Promise<void> {
  // One paused session per workout — remove any previous one first.
  await supabaseLoose
    .from("paused_workouts")
    .delete()
    .eq("client_id", session.clientId)
    .eq("workout_id", session.workoutId);
  const { error } = await supabaseLoose.from("paused_workouts").insert({
    id: session.id,
    client_id: session.clientId,
    program_id: session.programId ?? null,
    workout_id: session.workoutId,
    workout_name: session.workoutName,
    paused_at: session.pausedAt,
    elapsed_seconds: session.elapsedSeconds,
    results: session.results,
    has_working_progress: session.hasWorkingProgress,
  });
  if (error) throw new Error("The workout could not be paused on the cloud.");
  emitLocalEvent(LOCAL_PAUSED_WORKOUTS_CHANGED_EVENT);
}

export async function fetchPausedWorkouts(clientId: string): Promise<PausedWorkoutSession[]> {
  const { data, error } = await supabaseLoose
    .from("paused_workouts")
    .select(
      "id, client_id, program_id, workout_id, workout_name, paused_at, elapsed_seconds, results, has_working_progress",
    )
    .eq("client_id", clientId)
    .order("paused_at", { ascending: false });
  if (error) {
    console.error("Paused workouts could not be loaded", error);
    return [];
  }
  return (data ?? []).map((row) => mapRow(row as unknown as CloudPausedRow));
}

export async function fetchPausedWorkout(
  clientId: string,
  workoutId: string,
): Promise<PausedWorkoutSession | null> {
  const { data, error } = await supabaseLoose
    .from("paused_workouts")
    .select(
      "id, client_id, program_id, workout_id, workout_name, paused_at, elapsed_seconds, results, has_working_progress",
    )
    .eq("client_id", clientId)
    .eq("workout_id", workoutId)
    .maybeSingle();
  if (error || !data) return null;
  return mapRow(data as unknown as CloudPausedRow);
}

export async function clearPausedWorkout(clientId: string, workoutId: string): Promise<void> {
  await supabaseLoose
    .from("paused_workouts")
    .delete()
    .eq("client_id", clientId)
    .eq("workout_id", workoutId);
  emitLocalEvent(LOCAL_PAUSED_WORKOUTS_CHANGED_EVENT);
}

export function clearAllPausedWorkouts(clientId: string): void {
  void supabaseLoose
    .from("paused_workouts")
    .delete()
    .eq("client_id", clientId)
    .then(() => emitLocalEvent(LOCAL_PAUSED_WORKOUTS_CHANGED_EVENT));
}

/**
 * Finalize expired paused sessions (paused on a previous day):
 * - If working progress exists → save a history entry containing only the completed sets.
 * - Otherwise → discard silently.
 * Returns the number of sessions finalized (logged to history).
 */
export async function finalizeExpiredPausedWorkouts(clientId: string): Promise<number> {
  const sessions = await fetchPausedWorkouts(clientId);
  const expired = sessions.filter((session) => isPreviousDayPaused(session, new Date()));
  if (expired.length === 0) return 0;

  let logged = 0;
  for (const session of expired) {
    try {
      if (session.hasWorkingProgress) {
        const workout = loadWorkouts().find((candidate) => candidate.id === session.workoutId);
        if (workout) {
          const completedOnly: ProgramWorkout = {
            ...workout,
            exercises: workout.exercises
              .map((exercise) => ({
                ...exercise,
                sets: exercise.sets.filter(
                  (set) => session.results[resultKey(exercise.id, set.id)]?.completed,
                ),
              }))
              .filter((exercise) => exercise.sets.length > 0),
          };
          if (completedOnly.exercises.length > 0) {
            await saveWorkoutSession({
              clientId,
              programId: session.programId,
              workout: completedOnly,
              exercises: loadExercises(),
              weightUnits: getAllWeightUnits(loadCustomWeightUnits()),
              results: session.results,
              durationSeconds: session.elapsedSeconds,
              completedAt: new Date(session.pausedAt),
            });
            logged += 1;
          }
        }
      }
    } catch (error) {
      console.error("Failed to finalize paused workout", error);
    }
  }

  const ids = expired.map((session) => session.id);
  await supabaseLoose.from("paused_workouts").delete().in("id", ids).eq("client_id", clientId);
  emitLocalEvent(LOCAL_PAUSED_WORKOUTS_CHANGED_EVENT);
  return logged;
}
