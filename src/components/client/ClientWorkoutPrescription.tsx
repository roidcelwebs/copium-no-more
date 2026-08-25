import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useAccount } from "@/components/account/AccountProvider";
import { type Exercise, loadExercises } from "@/lib/coach-exercises";
import { getAssignedWorkoutIds, loadPrograms } from "@/lib/coach-programs";
import {
  type WeightUnit,
  getAllWeightUnits,
  getWeightUnit,
  loadCustomWeightUnits,
} from "@/lib/coach-weight-units";
import { formatElapsed } from "@/lib/coach-workout-preview";
import {
  INTENSITY_LABELS,
  type ProgramWorkout,
  SET_TYPE_LABELS,
  formatSetPrescription,
  formatSuggestedWeightRange,
  loadWorkouts,
} from "@/lib/coach-workouts";

export function ClientWorkoutPrescription({ workoutId }: { workoutId: string }) {
  const { account } = useAccount();
  const [workout, setWorkout] = useState<ProgramWorkout | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [weightUnits, setWeightUnits] = useState<WeightUnit[]>([]);
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = () => {
      const programs = loadPrograms();
      const assignedProgram = programs.find((program) => program.id === account?.assignedProgramId);
      setAllowed(
        assignedProgram ? getAssignedWorkoutIds(assignedProgram).includes(workoutId) : false,
      );
      setWorkout(loadWorkouts().find((candidate) => candidate.id === workoutId) ?? null);
      setExercises(loadExercises());
      setWeightUnits(getAllWeightUnits(loadCustomWeightUnits()));
      setLoading(false);
    };
    load();
    window.addEventListener("no-more-copium:cloud-cache-refreshed", load);
    return () => window.removeEventListener("no-more-copium:cloud-cache-refreshed", load);
  }, [account?.assignedProgramId, workoutId]);

  const exercisesById = useMemo(
    () => new Map(exercises.map((exercise) => [exercise.id, exercise])),
    [exercises],
  );
  const weightUnitsById = useMemo(
    () => new Map(weightUnits.map((unit) => [unit.id, unit])),
    [weightUnits],
  );

  if (!account || account.role !== "client") return null;

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <div className="h-6 w-48 rounded-lg bg-muted/60 skeleton-shimmer" />
        <div className="h-4 w-full rounded-lg bg-muted/60 skeleton-shimmer" />
        <div className="space-y-3">
          <div className="h-20 w-full rounded-xl bg-muted/60 skeleton-shimmer" />
          <div className="h-20 w-full rounded-xl bg-muted/60 skeleton-shimmer" />
        </div>
      </div>
    );
  }

  if (!workout || !allowed) {
    return (
      <section className="space-y-6">
        <BackToProgram />
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <h1 className="text-xl font-semibold text-foreground">Workout unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This workout is not currently assigned in your weekly schedule.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <BackToProgram />
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Read-only workout
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
          {workout.name}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review your coach&apos;s exercise and set prescriptions.
        </p>
      </div>

      <ol className="space-y-4">
        {workout.exercises.map((exercise, exerciseIndex) => {
          const definition = exercisesById.get(exercise.exerciseId);
          return (
            <li key={exercise.id} className="rounded-lg border border-border bg-card p-4">
              <h2 className="text-base font-semibold text-card-foreground">
                <span className="text-muted-foreground">{exerciseIndex + 1}.</span>{" "}
                {definition?.name ?? "Unknown exercise"}
              </h2>
              {exercise.notes && <CoachNote value={exercise.notes} className="mt-3" />}
              <ol className="mt-3 space-y-2">
                {exercise.sets.map((set, setIndex) => {
                  const unit =
                    weightUnitsById.get(set.weightUnitId) ?? getWeightUnit([], set.weightUnitId);
                  const suggestedWeight = formatSuggestedWeightRange(set, unit.shortForm);
                  const reps = formatSetPrescription(set);
                  return (
                    <li key={set.id} className="rounded-md border border-border bg-background p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-muted-foreground">
                          Set {setIndex + 1}
                        </span>
                        <span className="text-xs font-medium text-foreground">
                          {SET_TYPE_LABELS[set.setType]}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {set.intensity && (
                          <PrescriptionChip value={INTENSITY_LABELS[set.intensity]} />
                        )}
                        {reps && <PrescriptionChip value={reps} />}
                        {set.restSeconds !== undefined && (
                          <PrescriptionChip value={`Rest ${formatElapsed(set.restSeconds)}`} />
                        )}
                      </div>
                      {suggestedWeight && (
                        <div className="mt-3 rounded-md bg-muted/50 px-3 py-2">
                          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            Suggested weight range
                          </p>
                          <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
                            {suggestedWeight}
                          </p>
                        </div>
                      )}
                      {set.coachNotes && <CoachNote value={set.coachNotes} className="mt-3" />}
                    </li>
                  );
                })}
              </ol>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function BackToProgram() {
  return (
    <Link
      to="/client/program"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      Back to Your Program
    </Link>
  );
}

function PrescriptionChip({ value }: { value: string }) {
  return (
    <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
      {value}
    </span>
  );
}

function CoachNote({ value, className }: { value: string; className?: string }) {
  return (
    <div className={`rounded-md bg-muted/50 px-3 py-2 ${className ?? ""}`}>
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Notes from coach
      </p>
      <p className="mt-1 whitespace-pre-line text-xs text-foreground">{value}</p>
    </div>
  );
}
