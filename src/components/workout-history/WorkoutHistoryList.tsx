import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Dumbbell,
  Pencil,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { formatElapsed } from "@/lib/coach-workout-preview";
import { LOCAL_WORKOUT_HISTORY_CHANGED_EVENT } from "@/lib/local-events";
import {
  type WorkoutHistorySession,
  type WorkoutSessionData,
  type WorkoutSessionSetSnapshot,
  deleteWorkoutSession,
  fetchWorkoutSessions,
  updateWorkoutSession,
} from "@/lib/workout-history";

type ViewMode = "list" | "calendar";

export function WorkoutHistoryList({ clientId }: { clientId: string }) {
  const [sessions, setSessions] = useState<WorkoutHistorySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const load = useCallback(async () => {
    setError(null);
    try {
      setSessions(await fetchWorkoutSessions(clientId));
    } catch (nextError) {
      console.error(nextError);
      setError("Workout history could not be loaded because local storage is unavailable. Check device storage and try again.");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void load();
    const onChange = () => void load();
    window.addEventListener(LOCAL_WORKOUT_HISTORY_CHANGED_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(LOCAL_WORKOUT_HISTORY_CHANGED_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [load]);

  const sessionsByDate = useMemo(() => {
    const map = new Map<string, WorkoutHistorySession[]>();
    sessions.forEach((s) => {
      const d = new Date(s.completedAt);
      if (Number.isNaN(d.getTime())) return;
      const key = dateKey(d);
      const list = map.get(key) || [];
      list.push(s);
      map.set(key, list);
    });
    return map;
  }, [sessions]);

  const selectedKey = dateKey(selectedDate);
  const selectedSessions = sessionsByDate.get(selectedKey) || [];

  const calendarDays = useMemo(() => buildCalendarDays(currentMonth), [currentMonth]);

  if (loading) {
    return (
      <div className="space-y-3.5">
        <div className="h-12 w-full rounded-xl bg-muted/60 skeleton-shimmer" />
        <div className="h-24 w-full rounded-xl bg-muted/60 skeleton-shimmer" />
        <div className="h-24 w-full rounded-xl bg-muted/60 skeleton-shimmer" />
        <div className="h-24 w-full rounded-xl bg-muted/60 skeleton-shimmer" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4">
        <p className="break-words text-[1rem] leading-5 text-destructive">{error}</p>
        <Button
          type="button"
          variant="outline"
          className="mt-3 min-h-11 rounded-xl text-[1rem]"
          onClick={() => void load()}
        >
          Try again
        </Button>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center">
        <Dumbbell className="mx-auto h-7 w-7 text-muted-foreground" aria-hidden="true" />
        <h3 className="mt-3 text-[1.125rem] font-medium leading-tight text-foreground">No completed workouts yet</h3>
        <p className="mx-auto mt-1.5 max-w-sm text-[1rem] leading-6 text-muted-foreground">
          Finished workouts will appear here automatically after you complete a workout in Classic or Guided mode.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* View toggle */}
      <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/20 p-1">
        <button
          type="button"
          onClick={() => setViewMode("list")}
          aria-pressed={viewMode === "list"}
          className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[1rem] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            viewMode === "list" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          List
        </button>
        <button
          type="button"
          onClick={() => setViewMode("calendar")}
          aria-pressed={viewMode === "calendar"}
          className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[1rem] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            viewMode === "calendar" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <CalendarDays className="h-5 w-5" aria-hidden="true" />
          Calendar
        </button>
      </div>

      {viewMode === "list" ? (
        <ol className="space-y-3.5">
          {sessions.map((session) => {
            const expanded = session.id === expandedId;
            const detailsId = `workout-session-${session.id}`;
            return (
              <li key={session.id} className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : session.id)}
                  aria-expanded={expanded}
                  aria-controls={detailsId}
                  className="flex min-h-[72px] w-full items-start justify-between gap-3 p-5 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-[1.125rem] font-semibold leading-tight tracking-tight text-card-foreground">
                      {session.workoutName}
                    </h3>
                    <p className="mt-1 flex items-center gap-1.5 text-[0.875rem] leading-5 text-muted-foreground">
                      <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
                      {formatCompletedAt(session.completedAt)}
                    </p>
                    <p className="mt-1.5 text-[1rem] leading-5 text-muted-foreground">
                      {formatElapsed(session.durationSeconds)} · {session.completedSets}/
                      {session.totalSets} sets · {session.totalReps} reps
                    </p>
                  </div>
                  {expanded ? (
                    <ChevronUp className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  )}
                </button>
                {expanded && <WorkoutSessionDetails id={detailsId} session={session} />}
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="space-y-5">
          {/* Calendar header */}
          <div className="flex items-center justify-between">
            <h3 className="text-[1.125rem] font-semibold tracking-tight text-foreground">
              {new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(currentMonth)}
            </h3>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="min-h-11 min-w-11 rounded-xl"
                aria-label="Previous month"
                onClick={() => setCurrentMonth((d) => addMonths(d, -1))}
              >
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="min-h-11 min-w-11 rounded-xl"
                aria-label="Next month"
                onClick={() => setCurrentMonth((d) => addMonths(d, 1))}
              >
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </Button>
            </div>
          </div>

          {/* Weekday labels */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((wd) => (
              <div key={wd} className="py-1 text-[0.8125rem] font-medium uppercase tracking-wide text-muted-foreground">
                {wd}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-1.5">
            {calendarDays.map((day, idx) => {
              if (!day) {
                return <div key={`empty-${idx}`} className="aspect-square" />;
              }
              const key = dateKey(day.date);
              const daySessions = sessionsByDate.get(key) || [];
              const isSelected = key === selectedKey;
              const isToday = key === dateKey(new Date());
              const hasSessions = daySessions.length > 0;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedDate(day.date)}
                  aria-pressed={isSelected}
                  aria-label={`${day.date.toDateString()}${hasSessions ? `, ${daySessions.length} workout${daySessions.length === 1 ? "" : "s"}` : ""}`}
                  className={`relative flex aspect-square flex-col items-center justify-start rounded-lg border p-1 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    isSelected
                      ? "border-primary bg-primary/10 text-foreground"
                      : isToday
                      ? "border-primary/40 bg-card text-foreground"
                      : "border-border bg-card text-foreground hover:bg-accent"
                  }`}
                >
                  <span className="text-[1rem] font-medium leading-5">{day.date.getDate()}</span>
                  {hasSessions && (
                    <span className="mt-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-md bg-primary px-1 py-0.5 text-[0.75rem] font-bold leading-none text-primary-foreground">
                      {daySessions.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Selected day sessions */}
          <div className="space-y-3">
            <h4 className="text-[1rem] font-semibold tracking-tight text-foreground">
              {new Intl.DateTimeFormat(undefined, { weekday: "long", month: "short", day: "numeric" }).format(selectedDate)} —{" "}
              {selectedSessions.length} workout{selectedSessions.length === 1 ? "" : "s"}
            </h4>
            {selectedSessions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-6 text-center">
                <p className="text-[1rem] leading-6 text-muted-foreground">No workouts completed on this day.</p>
              </div>
            ) : (
              <ol className="space-y-3.5">
                {selectedSessions.map((session) => {
                  const expanded = session.id === expandedId;
                  const detailsId = `workout-session-cal-${session.id}`;
                  return (
                    <li key={session.id} className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                      <button
                        type="button"
                        onClick={() => setExpandedId(expanded ? null : session.id)}
                        aria-expanded={expanded}
                        aria-controls={detailsId}
                        className="flex min-h-[72px] w-full items-start justify-between gap-3 p-5 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                      >
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate text-[1.125rem] font-semibold leading-tight tracking-tight text-card-foreground">
                            {session.workoutName}
                          </h3>
                          <p className="mt-1.5 text-[1rem] leading-5 text-muted-foreground">
                            {formatElapsed(session.durationSeconds)} · {session.completedSets}/
                            {session.totalSets} sets · {session.totalReps} reps
                          </p>
                        </div>
                        {expanded ? (
                          <ChevronUp className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                        ) : (
                          <ChevronDown className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                        )}
                      </button>
                      {expanded && <WorkoutSessionDetails id={detailsId} session={session} />}
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function WorkoutSessionDetails({ id, session }: { id: string; session: WorkoutHistorySession }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<WorkoutSessionData | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const volume = formatVolume(session);

  const startEditing = () => {
    setDraft(JSON.parse(JSON.stringify(session.data)) as WorkoutSessionData);
    setEditing(true);
  };

  const cancelEditing = () => {
    setDraft(null);
    setEditing(false);
  };

  const saveEdits = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await updateWorkoutSession(session.clientId, session.id, { data: draft });
      setDraft(null);
      setEditing(false);
      setActionError(null);
    } catch {
      setActionError("Workout history could not be updated on the cloud. What happened: save failed. Why: the cloud may be unreachable. What to do: try again.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    try {
      await deleteWorkoutSession(session.clientId, session.id);
      setDeleteOpen(false);
      setActionError(null);
    } catch {
      setActionError("Workout history entry could not be deleted. What happened: delete failed. Why: the cloud may be unreachable. What to do: try again.");
    }
  };

  return (
    <div id={id} className="space-y-5 border-t border-border p-5">
      {actionError && (
        <p className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-[1rem] leading-5 text-destructive">
          {actionError}
        </p>
      )}
      <div className="flex items-center justify-between gap-2">
        <dl className="grid grid-cols-2 gap-2.5">
          <HistoryStat label="Duration" value={formatElapsed(session.durationSeconds)} />
          <HistoryStat label="Completed sets" value={`${session.completedSets}/${session.totalSets}`} />
          <HistoryStat label="Total reps" value={`${session.totalReps}`} />
          <HistoryStat label="Total volume" value={volume || "0"} />
        </dl>
        <div className="flex shrink-0 flex-col gap-2">
          {editing ? (
            <>
              <Button
                type="button"
                variant="default"
                className="min-h-11 rounded-xl text-[1rem]"
                onClick={() => void saveEdits()}
                disabled={saving}
              >
                <Save className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Save changes
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-11 rounded-xl text-[1rem]"
                onClick={cancelEditing}
                disabled={saving}
              >
                <X className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                className="min-h-11 rounded-xl text-[1rem]"
                onClick={startEditing}
              >
                <Pencil className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Edit workout
              </Button>
              <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="outline" className="min-h-11 rounded-xl text-[1rem] text-destructive hover:text-destructive">
                    <Trash2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
                    Delete workout
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this workout?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently remove “{session.workoutName}” from your workout
                      history. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="min-h-11 rounded-xl text-[1rem]">Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="min-h-11 rounded-xl text-[1rem] bg-destructive text-white hover:bg-destructive/90"
                      onClick={confirmDelete}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </div>

      {editing && draft ? (
        <div className="space-y-5">
          {draft.exercises.map((exercise, exerciseIndex) => (
            <section key={exercise.exerciseInstanceId} className="space-y-2.5">
              <div>
                <h4 className="text-[1rem] font-semibold leading-5 text-foreground">
                  <span className="text-muted-foreground">{exerciseIndex + 1}.</span> {exercise.exerciseName}
                </h4>
                {exercise.coachNotes && <HistoryNote label="Notes from coach" value={exercise.coachNotes} />}
              </div>
              <ol className="space-y-2.5">
                {exercise.sets.map((set, setIndex) => (
                  <li
                    key={set.setId}
                    className="rounded-xl border border-border bg-background p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[1rem] font-medium leading-5 text-muted-foreground">
                        Set {set.setNumber}
                      </span>
                      <span
                        className={`rounded-md border px-2.5 py-1 text-[0.75rem] font-medium uppercase tracking-wide ${
                          set.completed
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "border-border bg-muted text-muted-foreground"
                        }`}
                      >
                        {set.completed ? "Completed" : "Not completed"}
                      </span>
                    </div>
                    <p className="mt-2.5 text-[0.875rem] leading-5 text-muted-foreground">
                      {formatPrescription(set)}
                    </p>
                    <div className="mt-3.5 grid grid-cols-2 gap-2.5">
                      <label className="rounded-lg bg-muted/40 p-3.5">
                        <span className="text-[0.8125rem] font-medium uppercase tracking-wide text-muted-foreground">
                          Weight done
                        </span>
                        <span className="mt-1 flex items-center gap-2">
                          <input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            step="any"
                            value={Number.isFinite(set.weightDone) ? set.weightDone : 0}
                            onChange={(event) => {
                              const value = event.target.value;
                              const parsed = value === "" ? 0 : Number(value);
                              setDraft((current) => {
                                if (!current) return current;
                                const next = structuredCloneDeep(current);
                                next.exercises[exerciseIndex].sets[setIndex] = {
                                  ...set,
                                  weightDone: Number.isFinite(parsed) ? parsed : 0,
                                };
                                return next;
                              });
                            }}
                            className="w-full min-w-0 flex-1 rounded-md border border-border bg-background px-2.5 py-2 text-[1rem] leading-5 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            aria-label={`Weight done for set ${set.setNumber}`}
                          />
                          <span className="shrink-0 text-[0.875rem] text-muted-foreground">
                            {set.weightDoneUnit.shortForm}
                          </span>
                        </span>
                      </label>
                      <div className="rounded-lg bg-muted/40 p-3.5">
                        <span className="text-[0.8125rem] font-medium uppercase tracking-wide text-muted-foreground">
                          {set.setType === "warmup"
                            ? "Prescribed reps"
                            : set.setType === "static_stretch"
                              ? "Prescribed time"
                              : set.setType === "static_strength"
                                ? "Time done (sec)"
                                : "Reps done"}
                        </span>
                        {set.setType === "warmup" ? (
                          <p className="mt-1 text-[1rem] font-medium leading-5">
                            {set.targetReps ?? set.repsDone}
                          </p>
                        ) : set.setType === "static_stretch" ? (
                          <p className="mt-1 text-[1rem] font-medium leading-5">
                            {set.targetSeconds ?? set.secondsDone}s
                          </p>
                        ) : (
                          <input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            step={1}
                            value={
                              set.setType === "static_strength"
                                ? Number.isInteger(set.secondsDone)
                                  ? set.secondsDone
                                  : 0
                                : Number.isInteger(set.repsDone)
                                  ? set.repsDone
                                  : 0
                            }
                            onChange={(event) => {
                              const value = event.target.value;
                              const parsed = value === "" ? 0 : Number(value);
                              setDraft((current) => {
                                if (!current) return current;
                                const next = structuredCloneDeep(current);
                                next.exercises[exerciseIndex].sets[setIndex] = {
                                  ...set,
                                  ...(set.setType === "static_strength"
                                    ? {
                                        secondsDone:
                                          Number.isInteger(parsed) && parsed >= 0 ? parsed : 0,
                                      }
                                    : {
                                        repsDone:
                                          Number.isInteger(parsed) && parsed >= 0 ? parsed : 0,
                                      }),
                                };
                                return next;
                              });
                            }}
                            className="mt-1 w-full rounded-md border border-border bg-background px-2.5 py-2 text-[1rem] leading-5 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            aria-label={
                              set.setType === "static_strength"
                                ? `Time done for set ${set.setNumber}`
                                : `Reps done for set ${set.setNumber}`
                            }
                          />
                        )}
                      </div>
                    </div>
                    <div className="mt-2.5">
                      <span className="text-[0.8125rem] font-medium uppercase tracking-wide text-muted-foreground">
                        Notes to coach
                      </span>
                      <textarea
                        value={set.notesToCoach ?? ""}
                        onChange={(event) => {
                          const value = event.target.value;
                          setDraft((current) => {
                            if (!current) return current;
                            const next = structuredCloneDeep(current);
                            next.exercises[exerciseIndex].sets[setIndex] = {
                              ...set,
                              notesToCoach: value === "" ? undefined : value,
                            };
                            return next;
                          });
                        }}
                        rows={2}
                        className="mt-1 w-full rounded-md border border-border bg-background px-2.5 py-2 text-[1rem] leading-5 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label={`Notes to coach for set ${set.setNumber}`}
                      />
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          {session.data.exercises.map((exercise, exerciseIndex) => (
            <section key={exercise.exerciseInstanceId} className="space-y-2.5">
              <div>
                <h4 className="text-[1rem] font-semibold leading-5 text-foreground">
                  <span className="text-muted-foreground">{exerciseIndex + 1}.</span> {exercise.exerciseName}
                </h4>
                {exercise.coachNotes && <HistoryNote label="Notes from coach" value={exercise.coachNotes} />}
              </div>
              <ol className="space-y-2.5">
                {exercise.sets.map((set) => (
                  <li key={set.setId} className="rounded-xl border border-border bg-background p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[1rem] font-medium leading-5 text-muted-foreground">Set {set.setNumber}</span>
                      <span className={`rounded-md border px-2.5 py-1 text-[0.75rem] font-medium uppercase tracking-wide ${set.completed ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-muted text-muted-foreground"}`}>
                        {set.completed ? "Completed" : "Not completed"}
                      </span>
                    </div>
                    <p className="mt-2.5 text-[0.875rem] leading-5 text-muted-foreground">{formatPrescription(set)}</p>
                    <dl className="mt-3.5 grid grid-cols-2 gap-2.5">
                      <HistoryStat label="Weight done" value={`${formatNumber(set.weightDone)} ${set.weightDoneUnit.shortForm}`} compact />
                      {set.setType === "static_strength" || set.setType === "static_stretch" ? (
                        <HistoryStat label="Time done" value={`${set.secondsDone}s`} compact />
                      ) : (
                        <HistoryStat label="Reps done" value={`${set.repsDone}`} compact />
                      )}
                    </dl>
                    {set.coachNotes && <HistoryNote label="Notes from coach" value={set.coachNotes} />}
                    {set.notesToCoach && <HistoryNote label="Notes to coach" value={set.notesToCoach} emphasized />}
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function structuredCloneDeep<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function HistoryStat({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div className="rounded-lg bg-muted/40 p-3.5">
      <dt className="text-[0.8125rem] font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={compact ? "mt-1 text-[1rem] font-medium leading-5" : "mt-1.5 text-[1.125rem] font-semibold leading-tight tracking-tight"}>
        {value}
      </dd>
    </div>
  );
}

function HistoryNote({
  label,
  value,
  emphasized = false,
}: {
  label: string;
  value: string;
  emphasized?: boolean;
}) {
  return (
    <div className={`mt-2.5 rounded-lg px-3.5 py-2.5 ${emphasized ? "bg-primary/10" : "bg-muted/40"}`}>
      <p className="text-[0.8125rem] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1.5 whitespace-pre-line text-[1rem] leading-5 text-foreground">{value}</p>
    </div>
  );
}

function dateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildCalendarDays(currentMonth: Date): Array<{ date: Date } | null> {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startWeekday = firstDay.getDay(); // 0 Sun

  const days: Array<{ date: Date } | null> = [];
  for (let i = 0; i < startWeekday; i++) {
    days.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    date.setHours(0, 0, 0, 0);
    days.push({ date });
  }
  return days;
}

function addMonths(date: Date, delta: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + delta);
  return d;
}

function formatCompletedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatPrescription(set: WorkoutSessionSetSnapshot): string {
  const parts: string[] = [];
  parts.push(set.setType.replaceAll("_", " "));
  if (set.intensity) parts.push(set.intensity.toUpperCase());
  if (set.suggestedWeightMin !== undefined && set.suggestedWeightMax !== undefined) {
    parts.push(
      `suggested ${formatNumber(set.suggestedWeightMin)}–${formatNumber(set.suggestedWeightMax)} ${set.suggestedWeightUnit.shortForm}`,
    );
  }
  if (set.targetSeconds !== undefined) parts.push(`${set.targetSeconds}s hold`);
  else if (set.timeRangeMin !== undefined && set.timeRangeMax !== undefined) {
    parts.push(`${set.timeRangeMin}–${set.timeRangeMax}s`);
  } else if (set.targetReps !== undefined) parts.push(`${set.targetReps} reps`);
  else if (set.repRangeMin !== undefined && set.repRangeMax !== undefined) {
    parts.push(`${set.repRangeMin}–${set.repRangeMax} reps`);
  }
  return parts.join(" · ");
}

function formatVolume(session: WorkoutHistorySession): string {
  const unitLabels = new Map<string, string>();
  for (const exercise of session.data.exercises) {
    for (const set of exercise.sets) {
      unitLabels.set(set.weightDoneUnit.id, set.weightDoneUnit.shortForm);
    }
  }
  return Object.entries(session.volumeByUnitId)
    .map(([unitId, value]) => `${formatNumber(value)} ${unitLabels.get(unitId) ?? unitId}`)
    .join(" · ");
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? `${value}` : `${Number(value.toFixed(2))}`;
}
