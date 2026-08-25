import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Dumbbell, Plus } from "lucide-react";
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
  getOrderedWeekdays,
  getWeekdayLabel,
  getWorkoutAssignment,
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
    return () => window.removeEventListener("no-more-copium:workout-library-updated", reload);
  }, []);

  useEffect(() => {
    if (hydrated) savePrograms(programs);
  }, [programs, hydrated]);

  const program = programs.find((p) => p.id === programId);

  if (!hydrated) {
    return null;
  }

  if (!program) {
    return <ProgramNotFound />;
  }

  const updateProgram = (updates: Partial<ProgramSummary>) => {
    setPrograms((prev) => prev.map((p) => (p.id === programId ? { ...p, ...updates } : p)));
  };

  const setFirstDayOfWeek = (firstDayOfWeek: Weekday) => {
    updateProgram({ firstDayOfWeek });
  };

  const assignDay = (weekday: Weekday, assignment: DayAssignment) => {
    updateProgram({
      dayAssignments: { ...program.dayAssignments, [weekday]: assignment },
    });
  };

  const clearDay = (weekday: Weekday) => {
    const nextAssignments = { ...program.dayAssignments };
    delete nextAssignments[weekday];
    updateProgram({ dayAssignments: nextAssignments });
  };

  const programWorkouts = sortWorkouts(workouts);

  return (
    <div className="space-y-6">
      <BackLink />
      <ProgramDetailsEditor program={program} onChange={updateProgram} />
      <div className="max-w-md space-y-4">
        <FirstDaySelector value={program.firstDayOfWeek} onChange={setFirstDayOfWeek} />
        <DayRow
          program={program}
          workouts={programWorkouts}
          onAssign={assignDay}
          onClear={clearDay}
        />
      </div>
      <ProgramWorkoutsSection programId={programId} />
    </div>
  );
}

function ProgramNotFound() {
  return (
    <div className="space-y-6">
      <BackLink />
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Program not found</h1>
        <p className="text-sm text-muted-foreground">
          This program is not available in this browser.
        </p>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/coach/programs"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      Back to Program Manager
    </Link>
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
        <SelectTrigger
          id="first-day-of-week"
          aria-label="First day of the week"
          className="h-10 w-36"
        >
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
          restAssigned={isRestDay(program.dayAssignments, weekday)}
          workoutId={getWorkoutAssignment(program.dayAssignments, weekday)}
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
  restAssigned,
  workoutId,
  workouts,
  onAssign,
  onClear,
}: {
  weekday: Weekday;
  restAssigned: boolean;
  workoutId: string | undefined;
  workouts: ProgramWorkout[];
  onAssign: (weekday: Weekday, assignment: DayAssignment) => void;
  onClear: (weekday: Weekday) => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [choosingWorkout, setChoosingWorkout] = useState(false);
  const label = getWeekdayLabel(weekday);
  const assignedWorkout = workouts.find((workout) => workout.id === workoutId);
  const assigned = restAssigned || workoutId !== undefined;

  const close = () => {
    setDialogOpen(false);
    setChoosingWorkout(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setDialogOpen(true)}
        aria-label={
          restAssigned
            ? `${label.full}, rest day. Change assignment`
            : assignedWorkout
              ? `${label.full}, ${assignedWorkout.name}. Change assignment`
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
          <span className="text-xs font-medium">Rest</span>
        ) : assignedWorkout ? (
          <span className="flex min-w-0 flex-col items-center gap-1">
            <Dumbbell className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="max-w-full truncate text-[9px] leading-tight">
              {assignedWorkout.name}
            </span>
          </span>
        ) : workoutId ? (
          <span className="text-[9px] leading-tight text-destructive">Unavailable</span>
        ) : (
          <Plus className="h-5 w-5" aria-hidden="true" />
        )}
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
                <DialogTitle>Select workout for {label.full}</DialogTitle>
                <DialogDescription>Choose a workout from this training program.</DialogDescription>
              </DialogHeader>
              {workouts.length === 0 ? (
                <p className="rounded-md border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
                  Create a workout in this program first.
                </p>
              ) : (
                <div className="max-h-72 space-y-1 overflow-y-auto">
                  {workouts.map((workout) => (
                    <button
                      key={workout.id}
                      type="button"
                      onClick={() => {
                        onAssign(weekday, { type: "workout", workoutId: workout.id });
                        close();
                      }}
                      className="w-full truncate rounded-md border border-border px-3 py-2.5 text-left text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {workout.name}
                    </button>
                  ))}
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
                <DialogTitle>{label.full}</DialogTitle>
                <DialogDescription>Choose what to assign to this day.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-3">
                <Button variant="outline" onClick={() => setChoosingWorkout(true)}>
                  Choose workout
                </Button>
                <Button
                  onClick={() => {
                    onAssign(weekday, { type: "rest" });
                    close();
                  }}
                >
                  Rest day
                </Button>
              </div>
              <DialogFooter>
                {assigned && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      onClear(weekday);
                      close();
                    }}
                  >
                    Clear assignment
                  </Button>
                )}
                <Button variant="secondary" onClick={close}>
                  Cancel
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
