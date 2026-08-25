import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import type { ProgramWorkout } from "./coach-workouts";
import type { SessionResultsMap } from "./coach-workout-preview";
import {
  hasWorkingProgressInResults,
  isPreviousDayPaused,
  type PausedWorkoutSession,
} from "./paused-workouts";
import {
  computeLastWeightsByExercise,
  type WorkoutHistorySession,
} from "./workout-history";

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

function sampleWorkout(): ProgramWorkout {
  return {
    id: "w1",
    name: "Push Day",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    exercises: [
      {
        id: "e1",
        exerciseId: "ex1",
        sets: [
          { id: "s1", setType: "warmup", weightUnitId: "kg", targetReps: 10 },
          { id: "s2", setType: "normal", weightUnitId: "kg", repRangeMin: 8, repRangeMax: 12 },
          { id: "s3", setType: "static_strength", weightUnitId: "kg", timeRangeMin: 30, timeRangeMax: 60 },
        ],
      },
    ],
  };
}

const basePaused: PausedWorkoutSession = {
  id: "p1",
  clientId: "c1",
  workoutId: "w1",
  workoutName: "Push Day",
  pausedAt: "2026-08-06T20:00:00.000Z",
  elapsedSeconds: 600,
  results: {},
  hasWorkingProgress: false,
};

describe("paused workouts — expiry", () => {
  test("same-day pause is not expired", () => {
    expect(isPreviousDayPaused(basePaused, new Date("2026-08-06T23:00:00"))).toBe(false);
  });

  test("previous-day pause is expired", () => {
    expect(isPreviousDayPaused(basePaused, new Date("2026-08-07T00:00:01"))).toBe(true);
    expect(isPreviousDayPaused(basePaused, new Date("2026-08-08T12:00:00"))).toBe(true);
  });
});

describe("paused workouts — working progress", () => {
  test("only warm-up sets completed → no working progress", () => {
    const workout = sampleWorkout();
    const results: SessionResultsMap = {
      "e1::s1": {
        exerciseInstanceId: "e1",
        setId: "s1",
        actualWeight: 20,
        actualWeightUnitId: "kg",
        actualReps: 10,
        actualSeconds: 0,
        completed: true,
      },
    };
    expect(hasWorkingProgressInResults(workout, results)).toBe(false);
  });

  test("a completed working set with weight → working progress", () => {
    const workout = sampleWorkout();
    const results: SessionResultsMap = {
      "e1::s2": {
        exerciseInstanceId: "e1",
        setId: "s2",
        actualWeight: 60,
        actualWeightUnitId: "kg",
        actualReps: 10,
        actualSeconds: 0,
        completed: true,
      },
    };
    expect(hasWorkingProgressInResults(workout, results)).toBe(true);
  });

  test("static strength time counts as progress", () => {
    const workout = sampleWorkout();
    const results: SessionResultsMap = {
      "e1::s3": {
        exerciseInstanceId: "e1",
        setId: "s3",
        actualWeight: 0,
        actualWeightUnitId: "kg",
        actualReps: 0,
        actualSeconds: 40,
        completed: true,
      },
    };
    expect(hasWorkingProgressInResults(workout, results)).toBe(true);
  });
});

describe("last-time weights", () => {
  function session(
    id: string,
    at: string,
    sets: Array<{ setId: string; completed: boolean; setType: string; weight: number; unit: string }>,
  ): WorkoutHistorySession {
    return {
      id,
      clientId: "c1",
      workoutId: "w1",
      workoutName: "Push Day",
      startedAt: at,
      completedAt: at,
      durationSeconds: 600,
      completedSets: sets.filter((s) => s.completed).length,
      totalSets: sets.length,
      totalReps: 0,
      volumeByUnitId: {},
      data: {
        version: 1,
        exercises: [
          {
            exerciseInstanceId: "e1",
            exerciseId: "ex1",
            exerciseName: "Bench Press",
            sets: sets.map((s) => ({
              setId: s.setId,
              setNumber: 1,
              setType: s.setType,
              suggestedWeightUnit: { id: "kg", longForm: "Kilograms", shortForm: "kg" },
              weightDoneUnit: { id: s.unit, longForm: "Kilograms", shortForm: s.unit },
              completed: s.completed,
              weightDone: s.weight,
              repsDone: 0,
              secondsDone: 0,
            })),
          },
        ],
      },
    };
  }

  test("uses the latest session that has a non-warm-up set", () => {
    const sessions = [
      session("old", "2026-08-01T00:00:00.000Z", [
        { setId: "a", completed: true, setType: "normal", weight: 60, unit: "kg" },
      ]),
      session("new", "2026-08-05T00:00:00.000Z", [
        { setId: "b", completed: true, setType: "normal", weight: 65, unit: "kg" },
      ]),
    ];
    const weights = computeLastWeightsByExercise(sessions);
    expect(weights["ex1"]?.weight).toBe(65);
    expect(weights["ex1"]?.unitShortForm).toBe("kg");
  });

  test("warm-up sets are excluded entirely", () => {
    const sessions = [
      session("only-warmup", "2026-08-05T00:00:00.000Z", [
        { setId: "a", completed: true, setType: "warmup", weight: 100, unit: "kg" },
      ]),
    ];
    const weights = computeLastWeightsByExercise(sessions);
    expect(weights["ex1"]).toBeUndefined();
  });

  test("incomplete sets are ignored", () => {
    const sessions = [
      session("incomplete", "2026-08-05T00:00:00.000Z", [
        { setId: "a", completed: false, setType: "normal", weight: 80, unit: "kg" },
      ]),
    ];
    const weights = computeLastWeightsByExercise(sessions);
    expect(weights["ex1"]).toBeUndefined();
  });

  test("takes the heaviest set within the chosen session", () => {
    const sessions = [
      session("s", "2026-08-05T00:00:00.000Z", [
        { setId: "a", completed: true, setType: "normal", weight: 60, unit: "kg" },
        { setId: "b", completed: true, setType: "normal", weight: 70, unit: "kg" },
      ]),
    ];
    const weights = computeLastWeightsByExercise(sessions);
    expect(weights["ex1"]?.weight).toBe(70);
  });
});

describe("pause + last-time UI", () => {
  test("workout preview has Pause button and Last time display", () => {
    const preview = read("../components/coach/WorkoutPreview.tsx");
    expect(preview).toMatch(/Pause workout\?/);
    expect(preview).toMatch(/Pause\s*<\/Button>/);
    expect(preview).toMatch(/Last time:/);
    expect(preview).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  test("client shell finalizes expired paused workouts", () => {
    const shell = read("../components/client/ClientShell.tsx");
    expect(shell).toMatch(/finalizeExpiredPausedWorkouts/);
  });

  test("no colored gradients in preview", () => {
    const preview = read("../components/coach/WorkoutPreview.tsx");
    const grads = preview
      .split(/\s+/)
      .map((t) => t.replace(/^[^a-z]+|[^\w/\[\].%-]+$/g, ""))
      .filter((t) => /^(?:from|via|to)-/.test(t));
    expect(grads.filter((t) => !t.includes("black") && !t.startsWith("from-transparent"))).toEqual([]);
  });
});
