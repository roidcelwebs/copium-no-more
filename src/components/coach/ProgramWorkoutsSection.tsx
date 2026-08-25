import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type ProgramSummary,
  loadPrograms,
  removeWorkoutFromAssignments,
  savePrograms,
} from "@/lib/coach-programs";
import {
  type ProgramWorkout,
  WORKOUT_NAME_MAX_LENGTH,
  createWorkout,
  isWorkoutNameAvailable,
  loadWorkouts,
  saveWorkouts,
  sortWorkouts,
} from "@/lib/coach-workouts";

export function ProgramWorkoutsSection({
  programId,
  showHeading = true,
}: {
  programId?: string;
  showHeading?: boolean;
}) {
  const [workouts, setWorkouts] = useState<ProgramWorkout[]>([]);
  const [programs, setPrograms] = useState<ProgramSummary[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ProgramWorkout | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    setWorkouts(loadWorkouts());
    setPrograms(loadPrograms());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveWorkouts(workouts);
    savePrograms(programs);
  }, [workouts, programs, hydrated]);

  const globalWorkouts = useMemo(() => sortWorkouts(workouts), [workouts]);

  const openWorkout = (workoutId: string) => {
    if (programId) {
      void navigate({
        to: "/coach/programs/$programId/workouts/$workoutId",
        params: { programId, workoutId },
      });
    } else {
      void navigate({
        to: "/coach/library/workouts/$workoutId",
        params: { workoutId },
      });
    }
  };

  const handleCreate = (name: string): string | null => {
    if (!isWorkoutNameAvailable(workouts, name)) {
      return "A workout with this name already exists.";
    }
    const workout = createWorkout({ name });
    const next = [...workouts, workout];
    saveWorkouts(next);
    setWorkouts(next);
    setDialogOpen(false);
    openWorkout(workout.id);
    return null;
  };

  const handleDelete = (id: string) => {
    const nextWorkouts = workouts.filter((workout) => workout.id !== id);
    const nextPrograms = removeWorkoutFromAssignments(programs, id);
    saveWorkouts(nextWorkouts);
    savePrograms(nextPrograms);
    setWorkouts(nextWorkouts);
    setPrograms(nextPrograms);
    setPendingDelete(null);
    window.dispatchEvent(new Event("no-more-copium:workout-library-updated"));
  };

  return (
    <section aria-labelledby={showHeading ? "workouts-heading" : undefined} className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        {showHeading && (
          <h2 id="workouts-heading" className="text-lg font-semibold text-foreground">
            Workouts
          </h2>
        )}
        {hydrated && globalWorkouts.length > 0 && (
          <Button
            size="sm"
            onClick={() => setDialogOpen(true)}
            className={!showHeading ? "ml-auto" : ""}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add
          </Button>
        )}
      </div>

      {!hydrated ? null : globalWorkouts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">No workouts in your library yet.</p>
          <Button className="mt-4" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Create workout
          </Button>
        </div>
      ) : (
        <ul role="list" className="divide-y divide-border rounded-lg border border-border">
          {globalWorkouts.map((workout) => (
            <li key={workout.id} className="flex items-center gap-1 pr-2">
              <button
                type="button"
                onClick={() => openWorkout(workout.id)}
                className="min-w-0 flex-1 truncate px-4 py-3 text-left text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                {workout.name}
              </button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setPendingDelete(workout)}
                aria-label={`Delete ${workout.name}`}
                className="shrink-0 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <CreateWorkoutDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreate={handleCreate} />

      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete workout globally?</DialogTitle>
            <DialogDescription>
              {pendingDelete
                ? `“${pendingDelete.name}” will be removed from the Workout Library and cleared from every program day that uses it.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => pendingDelete && handleDelete(pendingDelete.id)}
            >
              Delete globally
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function CreateWorkoutDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string) => string | null;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const errorId = useId();

  useEffect(() => {
    if (!open) {
      setValue("");
      setError(null);
    }
  }, [open]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) {
      setError("Please enter a workout name.");
      return;
    }
    if (trimmed.length > WORKOUT_NAME_MAX_LENGTH) {
      setError(`Keep the name to ${WORKOUT_NAME_MAX_LENGTH} characters or fewer.`);
      return;
    }
    setError(onCreate(trimmed));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-sm"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>Create workout</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="workout-name">Workout name</Label>
            <Input
              id="workout-name"
              ref={inputRef}
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                if (error) setError(null);
              }}
              maxLength={WORKOUT_NAME_MAX_LENGTH + 20}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              autoComplete="off"
            />
            {error && (
              <p id={errorId} role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!value.trim()}>
              Create workout
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
