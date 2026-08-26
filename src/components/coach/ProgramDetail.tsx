import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Dumbbell, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type DayAssignment,
  type ProgramSummary,
  type Weekday,
  MAX_WORKOUTS_PER_DAY,
  getAssignedWorkoutIds,
  getOrderedWeekdays,
  getWeekdayLabel,
  isRestDay,
  loadPrograms,
  savePrograms,
} from "@/lib/coach-programs";
import { type ProgramWorkout, loadWorkouts, sortWorkouts } from "@/lib/coach-workouts";
import { ProgramDetailsEditor } from "./ProgramDetailsEditor";
import { ProgramWorkoutsSection } from "./ProgramWorkoutsSection";

const WEEKDAYS: Weekday[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

export function ProgramDetail({ programId }: { programId: string }) {
  const [programs, setPrograms] = useState<ProgramSummary[]>([]);
  const [workouts, setWorkouts] = useState<ProgramWorkout[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const reload = () => {
      setPrograms(loadPrograms());
      setWorkouts(loadWorkouts());
    };
    reload();
    setHydrated(true);
    window.addEventListener("no-more-copium:workout-library-updated", reload);
    window.addEventListener("no-more-copium:cloud-cache-refreshed", reload);
    return () => {
      window.removeEventListener("no-more-copium:workout-library-updated", reload);
      window.removeEventListener("no-more-copium:cloud-cache-refreshed", reload);
    };
  }, []);

  const program = programs.find((p) => p.id === programId);

  if (!hydrated) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 rounded-lg bg-muted/60 skeleton-shimmer" />
        <div className="h-64 rounded-xl bg-muted/60 skeleton-shimmer" />
      </div>
    );
  }

  if (!program) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-destructive">This program could not be found.</p>
        <Button asChild variant="outline">
          <Link to="/coach/programs">
            <ArrowLeft className="h-4 w-4" />
            Back to programs
          </Link>
        </Button>
      </div>
    );
  }

  const handleUpdate = (updated: ProgramSummary) => {
    const next = programs.map((p) => (p.id === updated.id ? updated : p));
    setPrograms(next);
    savePrograms(next);
  };

  const handleAssignDay = (weekday: Weekday, assignment: DayAssignment) => {
    const nextAssignments = { ...program.dayAssignments, [weekday]: assignment };
    handleUpdate({ ...program, dayAssignments: nextAssignments });
  };

  const handleClearDay = (weekday: Weekday) => {
    const nextAssignments = { ...program.dayAssignments };
    delete nextAssignments[weekday];
    handleUpdate({ ...program, dayAssignments: nextAssignments });
  };

  return (
    <div className="space-y-8">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link to="/coach/programs">
            <ArrowLeft className="h-4 w-4" />
            Program Manager
          </Link>
        </Button>
        <h1 className="truncate text-2xl font-bold tracking-tight text-foreground">
          {program.name}
        </h1>
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
          {program.shortDescription || "Manage schedule, workouts, and details."}
        </p>
      </div>

      <ProgramDetailsEditor program={program} onSave={handleUpdate} />

      <section aria-labelledby="schedule-heading" className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="schedule-heading" className="text-lg font-semibold text-foreground">
              Weekly Schedule
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Assign up to 3 workouts per day, or set rest days.
            </p>
          </div>
          <FirstDaySelector
            value={program.firstDayOfWeek}
            onChange={(firstDayOfWeek) => handleUpdate({ ...program, firstDayOfWeek })}
          />
        </div>

        <DayRow
          program={program}
          workouts={workouts}
          onAssign={handleAssignDay}
          onClear={handleClearDay}
        />
      </section>

      <ProgramWorkoutsSection
        programId={program.id}
        workouts={workouts}
        onWorkoutsChange={setWorkouts}
      />
    </div>
  );
}

function FirstDaySelector({
  value,
  onChange,
}: {
  value: Weekday;
  onChange: (weekday: Weekday) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor="first-day-of-week" className="text-sm font-medium text-foreground">
        First day of the week
      </label>
      <Select value={value} onValueChange={(v) => onChange(v as Weekday)}>
        <SelectTrigger id="first-day-of-week" aria-label="First day of the week" className="h-10 w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {WEEKDAYS.map((weekday) => (
            <SelectItem key={weekday} value={weekday}>
              {getWeekdayLabel(weekday).full}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function DayRow({
  program,
  workouts,
  onAssign,
  onClear,
}: {
  program: ProgramSummary;
  workouts: ProgramWorkout[];
  onAssign: (weekday: Weekday, assignment: DayAssignment) => void;
  onClear: (weekday: Weekday) => void;
}) {
  const orderedDays = getOrderedWeekdays(program.firstDayOfWeek);

  return (
    <div role="group" aria-label="Weekly schedule" className="grid grid-cols-7 gap-1.5">
      {orderedDays.map((weekday) => (
        <DayItem
          key={weekday}
          weekday={weekday}
          assignment={program.dayAssignments[weekday]}
          workouts={workouts}
          onAssign={onAssign}
          onClear={onClear}
        />
      ))}
    </div>
  );
}

function DayItem({
  weekday,
  assignment,
  workouts,
  onAssign,
  onClear,
}: {
  weekday: Weekday;
  assignment: DayAssignment | undefined;
  workouts: ProgramWorkout[];
  onAssign: (weekday: Weekday, assignment: DayAssignment) => void;
  onClear: (weekday: Weekday) => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [choosingWorkout, setChoosingWorkout] = useState(false);

  const label = getWeekdayLabel(weekday);
  const restAssigned = assignment?.type === "rest";
  const assignedWorkoutIds = getAssignedWorkoutIds(assignment);
  const assignedWorkouts = assignedWorkoutIds
    .map((id) => workouts.find((w) => w.id === id))
    .filter((w): w is ProgramWorkout => w !== undefined);
  const assigned = assignment !== undefined;

  const close = () => {
    setDialogOpen(false);
    setChoosingWorkout(false);
  };

  const handleAddWorkout = (workoutId: string) => {
    const existing = getAssignedWorkoutIds(assignment);
    if (!existing.includes(workoutId) && existing.length < MAX_WORKOUTS_PER_DAY) {
      const nextIds = [...existing, workoutId];
      onAssign(weekday, {
        type: "workout",
        workoutId: nextIds[0],
        workoutIds: nextIds,
      });
    }
    setChoosingWorkout(false);
  };

  const handleRemoveWorkout = (workoutId: string) => {
    const existing = getAssignedWorkoutIds(assignment);
    const nextIds = existing.filter((id) => id !== workoutId);
    if (nextIds.length === 0) {
      onClear(weekday);
    } else {
      onAssign(weekday, {
        type: "workout",
        workoutId: nextIds[0],
        workoutIds: nextIds,
      });
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setDialogOpen(true)}
        aria-label={
          restAssigned
            ? `${label.full}, rest day. Change assignment`
            : assignedWorkouts.length > 0
              ? `${label.full}, ${assignedWorkouts.map((w) => w.name).join(", ")}. Change assignment`
              : `Assign ${label.full}`
        }
        className={
          "flex h-24 min-w-0 flex-col items-center justify-between overflow-hidden rounded-lg border px-1 py-2 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98] " +
          (assigned
            ? "border-primary/50 bg-primary/10 text-foreground"
            : "border-border bg-card text-card-foreground hover:bg-accent hover:text-accent-foreground")
        }
      >
        <span className="text-xs font-medium">{label.short}</span>
        {restAssigned ? (
          <span className="text-xs font-medium text-muted-foreground">Rest</span>
        ) : assignedWorkouts.length === 1 ? (
          <span className="flex min-w-0 flex-col items-center gap-0.5">
            <Dumbbell className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
            <span className="max-w-full truncate text-[9px] leading-tight font-medium">
              {assignedWorkouts[0].name}
            </span>
          </span>
        ) : assignedWorkouts.length > 1 ? (
          <span className="flex min-w-0 flex-col items-center gap-0.5">
            <Dumbbell className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
            <span className="max-w-full truncate text-[9px] leading-tight font-semibold text-primary">
              {assignedWorkouts.length} workouts
            </span>
          </span>
        ) : assigned ? (
          <span className="text-[9px] leading-tight text-destructive">Unavailable</span>
        ) : (
          <Plus className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        )}
        <div className="h-1" />
      </button>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) close();
          else setDialogOpen(true);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          {choosingWorkout ? (
            <>
              <DialogHeader>
                <DialogTitle>Add workout for {label.full}</DialogTitle>
                <DialogDescription>
                  Choose a workout to add ({assignedWorkouts.length}/{MAX_WORKOUTS_PER_DAY} assigned).
                </DialogDescription>
              </DialogHeader>
              {workouts.length === 0 ? (
                <p className="rounded-md border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
                  Create a workout in this program first.
                </p>
              ) : (
                <div className="max-h-72 space-y-1 overflow-y-auto">
                  {workouts.map((workout) => {
                    const alreadyAssigned = assignedWorkoutIds.includes(workout.id);
                    return (
                      <button
                        key={workout.id}
                        type="button"
                        disabled={alreadyAssigned}
                        onClick={() => handleAddWorkout(workout.id)}
                        className={
                          "w-full truncate rounded-md border border-border px-3 py-2.5 text-left text-sm font-medium transition-colors " +
                          (alreadyAssigned
                            ? "opacity-50 cursor-not-allowed bg-muted/40"
                            : "hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")
                        }
                      >
                        {workout.name} {alreadyAssigned && "(Already added)"}
                      </button>
                    );
                  })}
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setChoosingWorkout(false)}>
                  Back
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>{label.full} Schedule</DialogTitle>
                <DialogDescription>
                  Assign up to {MAX_WORKOUTS_PER_DAY} workouts or mark as a rest day.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                {/* List of assigned workouts */}
                {assignedWorkouts.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Assigned Workouts ({assignedWorkouts.length}/{MAX_WORKOUTS_PER_DAY})
                    </p>
                    <div className="space-y-1.5">
                      {assignedWorkouts.map((w, index) => (
                        <div
                          key={w.id}
                          className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                              {index + 1}
                            </span>
                            <span className="truncate text-sm font-medium text-foreground">
                              {w.name}
                            </span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveWorkout(w.id)}
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            aria-label={`Remove ${w.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="grid gap-2">
                  {assignedWorkouts.length < MAX_WORKOUTS_PER_DAY && (
                    <Button
                      variant="outline"
                      onClick={() => setChoosingWorkout(true)}
                      className="min-h-10 justify-center"
                    >
                      <Plus className="mr-1.5 h-4 w-4" />
                      {assignedWorkouts.length === 0 ? "Add workout" : "Add another workout"}
                    </Button>
                  )}

                  <Button
                    variant={restAssigned ? "default" : "secondary"}
                    onClick={() => {
                      onAssign(weekday, { type: "rest" });
                      close();
                    }}
                    className="min-h-10 justify-center"
                  >
                    Set as Rest Day
                  </Button>
                </div>
              </div>

              <DialogFooter className="flex-row justify-between sm:justify-between">
                {assigned ? (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      onClear(weekday);
                      close();
                    }}
                    className="text-xs text-destructive hover:bg-destructive/10"
                  >
                    Clear assignment
                  </Button>
                ) : <div />}
                <Button variant="secondary" onClick={close}>
                  Done
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
