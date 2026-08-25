import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Flag,
  Minus,
  Pause,
  Plus,
  RotateCcw,
  SkipForward,
  X,
} from "lucide-react";
import { useAccount } from "@/components/account/AccountProvider";
import { SettingsMenu } from "@/components/account/SettingsMenu";
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
import { Textarea } from "@/components/ui/textarea";
import { type Exercise, loadExercises } from "@/lib/coach-exercises";
import {
  type WeightUnit,
  getAllWeightUnits,
  getWeightUnit,
  loadCustomWeightUnits,
  saveCustomWeightUnits,
  stepWeight,
} from "@/lib/coach-weight-units";
import {
  INTENSITY_LABELS,
  type ProgramWorkout,
  SET_NOTES_MAX_LENGTH,
  SET_TYPE_LABELS,
  formatSetPrescription,
  formatSuggestedWeightRange,
  loadWorkouts,
} from "@/lib/coach-workouts";
import {
  type FlatSetRef,
  type PreviewSetResult,
  type SessionResultsMap,
  clampNonNegative,
  computeSummary,
  firstIncompleteIndex,
  flattenSets,
  formatElapsed,
  hasAnyProgress,
  hasAnyValidSet,
  initSessionResults,
  restSecondsFor,
  resultKey,
} from "@/lib/coach-workout-preview";
import { cn } from "@/lib/utils";
import {
  createWorkoutSessionId,
  type LastExerciseWeight,
  fetchLastWeightsByExercise,
  saveWorkoutSession,
} from "@/lib/workout-history";
import {
  clearPausedWorkout,
  fetchPausedWorkout,
  hasWorkingProgressInResults,
  savePausedWorkout,
} from "@/lib/paused-workouts";
import { WeightUnitSelector } from "./WeightUnitSelector";

type Mode = "chooser" | "classic" | "guided" | "summary";

type Action =
  | { type: "set-result"; key: string; patch: Partial<PreviewSetResult> }
  | { type: "toggle-complete"; key: string }
  | {
      type: "mark-complete";
      key: string;
      actualReps?: number;
      actualWeight?: number;
      actualSeconds?: number;
    }
  | { type: "reset"; results: SessionResultsMap };

function resultsReducer(state: SessionResultsMap, action: Action): SessionResultsMap {
  switch (action.type) {
    case "set-result": {
      const existing = state[action.key];
      if (!existing) return state;
      return { ...state, [action.key]: { ...existing, ...action.patch } };
    }
    case "toggle-complete": {
      const existing = state[action.key];
      if (!existing) return state;
      return {
        ...state,
        [action.key]: { ...existing, completed: !existing.completed },
      };
    }
    case "mark-complete": {
      const existing = state[action.key];
      if (!existing) return state;
      return {
        ...state,
        [action.key]: {
          ...existing,
          actualReps: action.actualReps ?? existing.actualReps,
          actualWeight: action.actualWeight ?? existing.actualWeight,
          actualSeconds: action.actualSeconds ?? existing.actualSeconds,
          completed: true,
        },
      };
    }
    case "reset":
      return action.results;
  }
}

export function WorkoutPreview({
  programId,
  workoutId,
  audience = "coach",
}: {
  programId?: string;
  workoutId: string;
  audience?: "coach" | "client";
}) {
  const navigate = useNavigate();
  const { account } = useAccount();
  const [workout, setWorkout] = useState<ProgramWorkout | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [weightUnits, setWeightUnits] = useState<WeightUnit[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const all = loadWorkouts();
    const found = all.find((candidate) => candidate.id === workoutId) ?? null;
    setWorkout(found);
    setExercises(loadExercises());
    setWeightUnits(getAllWeightUnits(loadCustomWeightUnits()));
    setHydrated(true);
  }, [programId, workoutId]);

  const createWeightUnit = useCallback((unit: WeightUnit) => {
    setWeightUnits((previous) => {
      const customUnits = [...previous.filter((candidate) => candidate.isCustom), unit];
      saveCustomWeightUnits(customUnits);
      return getAllWeightUnits(customUnits);
    });
  }, []);

  const goBack = useCallback(() => {
    if (audience === "client") {
      void navigate({ to: "/client/dashboard" });
      return;
    }
    if (programId) {
      void navigate({
        to: "/coach/programs/$programId/workouts/$workoutId",
        params: { programId, workoutId },
      });
      return;
    }
    void navigate({
      to: "/coach/library/workouts/$workoutId",
      params: { workoutId },
    });
  }, [audience, navigate, programId, workoutId]);

  if (!hydrated) {
    return <FullscreenSurface>{null}</FullscreenSurface>;
  }

  if (!workout || !hasAnyValidSet(workout)) {
    return (
      <FullscreenSurface>
        <div className="mx-auto flex min-h-full max-w-md flex-col items-start justify-center gap-4 p-6">
          <h1 className="text-2xl font-semibold tracking-tight">
            {audience === "client" ? "Workout unavailable" : "Nothing to preview"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {workout
              ? "This workout has no prescribed sets yet."
              : "This workout is not available in this browser."}
          </p>
          <Button onClick={goBack} variant="outline">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {audience === "client"
              ? "Back to dashboard"
              : programId
                ? "Back to builder"
                : "Back to Workout Library"}
          </Button>
        </div>
      </FullscreenSurface>
    );
  }

  return (
    <PreviewSession
      workout={workout}
      exercises={exercises}
      weightUnits={weightUnits}
      audience={audience}
      clientId={audience === "client" && account?.role === "client" ? account.id : undefined}
      programId={programId}
      onCreateWeightUnit={createWeightUnit}
      onExit={goBack}
    />
  );
}

function PreviewSession({
  workout,
  exercises,
  weightUnits,
  audience,
  clientId,
  programId,
  onCreateWeightUnit,
  onExit,
}: {
  workout: ProgramWorkout;
  exercises: Exercise[];
  weightUnits: WeightUnit[];
  audience: "coach" | "client";
  clientId?: string;
  programId?: string;
  onCreateWeightUnit: (unit: WeightUnit) => void;
  onExit: () => void;
}) {
  const initialResults = useMemo(() => initSessionResults(workout), [workout]);
  const [results, dispatch] = useReducer(resultsReducer, initialResults);
  const [mode, setMode] = useState<Mode>("chooser");
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [guidedIndex, setGuidedIndex] = useState(0);
  const [inRest, setInRest] = useState(false);
  const [selectingGuidedSet, setSelectingGuidedSet] = useState(false);
  const [selectedGuidedSetKey, setSelectedGuidedSetKey] = useState<string | null>(null);
  const [exitOpen, setExitOpen] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [resumedNotice, setResumedNotice] = useState(false);
  const [lastWeights, setLastWeights] = useState<Record<string, LastExerciseWeight>>({});
  const [historySaveStatus, setHistorySaveStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const historyAttemptRef = useRef(0);
  const historySessionIdRef = useRef<string | null>(null);
  const savedHistoryAttemptRef = useRef<number | null>(null);

  const flat = useMemo(() => flattenSets(workout), [workout]);
  const exercisesById = useMemo(() => {
    const m = new Map<string, Exercise>();
    for (const e of exercises) m.set(e.id, e);
    return m;
  }, [exercises]);
  const weightUnitsById = useMemo(
    () => new Map(weightUnits.map((unit) => [unit.id, unit])),
    [weightUnits],
  );

  // shared elapsed timer
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [running]);

  // Last-time weights from history (client only, non-warm-up sets)
  useEffect(() => {
    if (audience !== "client" || !clientId) return;
    let cancelled = false;
    void fetchLastWeightsByExercise(clientId).then((weights) => {
      if (!cancelled) setLastWeights(weights);
    });
    return () => {
      cancelled = true;
    };
  }, [audience, clientId]);

  // Resume a paused session of this same workout (client only)
  useEffect(() => {
    if (audience !== "client" || !clientId) return;
    let cancelled = false;
    void fetchPausedWorkout(clientId, workout.id).then((paused) => {
      if (cancelled || !paused) return;
      const hasCompleted = Object.values(paused.results).some((result) => result.completed);
      if (!hasCompleted) return;
      dispatch({ type: "reset", results: paused.results });
      setElapsed(paused.elapsedSeconds);
      const nextIndex = findNextIncomplete(flat, paused.results, 0);
      setGuidedIndex(nextIndex >= flat.length ? 0 : nextIndex);
      setResumedNotice(true);
      void clearPausedWorkout(clientId, workout.id);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audience, clientId, workout.id, flat]);

  const dirty = hasAnyProgress(workout, results);

  const requestExit = useCallback(() => {
    if (!dirty) {
      onExit();
      return;
    }
    setExitOpen(true);
  }, [dirty, onExit]);

  const requestPause = useCallback(() => {
    if (audience !== "client") return;
    if (!dirty) {
      onExit();
      return;
    }
    setPauseOpen(true);
  }, [audience, dirty, onExit]);

  const confirmPause = async () => {
    if (audience !== "client" || !clientId) return;
    setPauseOpen(false);
    try {
      await savePausedWorkout({
        id: createWorkoutSessionId(),
        clientId,
        programId,
        workoutId: workout.id,
        workoutName: workout.name,
        pausedAt: new Date().toISOString(),
        elapsedSeconds: elapsed,
        results,
        hasWorkingProgress: hasWorkingProgressInResults(workout, results),
      });
    } catch (error) {
      console.error("Failed to pause workout", error);
    }
    onExit();
  };

  const startMode = (next: "classic" | "guided") => {
    setRunning(true);
    if (next === "guided") {
      setGuidedIndex(firstIncompleteIndex(flat, results));
      setInRest(false);
    }
    setMode(next);
  };

  const beginGuidedSetSelection = () => {
    setSelectingGuidedSet(true);
    setSelectedGuidedSetKey(null);
  };

  const cancelGuidedSetSelection = () => {
    setSelectingGuidedSet(false);
    setSelectedGuidedSetKey(null);
  };

  const confirmGuidedSetSelection = () => {
    if (!selectedGuidedSetKey) return;
    const selectedIndex = flat.findIndex(
      (setRef) => resultKey(setRef.exerciseInstanceId, setRef.setId) === selectedGuidedSetKey,
    );
    if (selectedIndex < 0) return;
    setGuidedIndex(selectedIndex);
    setInRest(false);
    setSelectingGuidedSet(false);
    setSelectedGuidedSetKey(null);
    setMode("guided");
  };

  const switchToClassic = () => {
    setSelectingGuidedSet(false);
    setSelectedGuidedSetKey(null);
    setInRest(false);
    setMode("classic");
  };

  const persistWorkoutHistory = useCallback(async () => {
    if (audience !== "client") return;
    if (!clientId) {
      setHistorySaveStatus("error");
      return;
    }
    const attempt = historyAttemptRef.current;
    if (savedHistoryAttemptRef.current === attempt) return;
    savedHistoryAttemptRef.current = attempt;
    const sessionId = historySessionIdRef.current ?? createWorkoutSessionId();
    historySessionIdRef.current = sessionId;
    setHistorySaveStatus("saving");
    try {
      await saveWorkoutSession({
        sessionId,
        clientId,
        programId,
        workout,
        exercises,
        weightUnits,
        results,
        durationSeconds: elapsed,
      });
      setHistorySaveStatus("saved");
    } catch (error) {
      console.error("Failed to save workout history", error);
      savedHistoryAttemptRef.current = null;
      setHistorySaveStatus("error");
    }
  }, [audience, clientId, elapsed, exercises, programId, results, weightUnits, workout]);

  const openSummary = () => {
    setRunning(false);
    setMode("summary");
  };

  useEffect(() => {
    if (mode === "summary") void persistWorkoutHistory();
  }, [mode, persistWorkoutHistory]);

  const retryHistorySave = () => {
    savedHistoryAttemptRef.current = null;
    void persistWorkoutHistory();
  };

  const restart = () => {
    historyAttemptRef.current += 1;
    historySessionIdRef.current = null;
    savedHistoryAttemptRef.current = null;
    setHistorySaveStatus("idle");
    dispatch({ type: "reset", results: initSessionResults(workout) });
    setElapsed(0);
    setRunning(false);
    setGuidedIndex(0);
    setInRest(false);
    setSelectingGuidedSet(false);
    setSelectedGuidedSetKey(null);
    setMode("chooser");
  };

  return (
    <FullscreenSurface>
      {resumedNotice && (
        <div className="mx-auto w-full max-w-md px-4 pt-4">
          <div
            className="rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 text-[1rem] leading-5 text-primary"
            role="status"
          >
            Resumed your paused workout — your completed sets are restored.
          </div>
        </div>
      )}
      {mode === "chooser" && (
        <ModeChooser
          workoutName={workout.name}
          audience={audience}
          onPickClassic={() => startMode("classic")}
          onPickGuided={() => startMode("guided")}
          onBack={requestExit}
        />
      )}
      {mode === "classic" && (
        <ClassicMode
          workout={workout}
          exercisesById={exercisesById}
          weightUnits={weightUnits}
          weightUnitsById={weightUnitsById}
          results={results}
          dispatch={dispatch}
          audience={audience}
          elapsed={elapsed}
          lastWeights={lastWeights}
          selectingGuidedSet={selectingGuidedSet}
          selectedGuidedSetKey={selectedGuidedSetKey}
          onSelectGuidedSet={setSelectedGuidedSetKey}
          onSwitchGuided={beginGuidedSetSelection}
          onConfirmGuidedSet={confirmGuidedSetSelection}
          onCancelGuidedSet={cancelGuidedSetSelection}
          onCreateWeightUnit={onCreateWeightUnit}
          onFinish={openSummary}
          onExit={requestExit}
          onPause={requestPause}
        />
      )}
      {mode === "guided" && (
        <GuidedMode
          workout={workout}
          flat={flat}
          exercisesById={exercisesById}
          weightUnits={weightUnits}
          weightUnitsById={weightUnitsById}
          results={results}
          dispatch={dispatch}
          elapsed={elapsed}
          lastWeights={lastWeights}
          audience={audience}
          index={guidedIndex}
          setIndex={setGuidedIndex}
          inRest={inRest}
          setInRest={setInRest}
          onCreateWeightUnit={onCreateWeightUnit}
          onSwitchClassic={switchToClassic}
          onPause={requestPause}
          onFinish={openSummary}
          onExit={requestExit}
        />
      )}
      {mode === "summary" && (
        <SummaryScreen
          workout={workout}
          weightUnits={weightUnits}
          audience={audience}
          results={results}
          elapsed={elapsed}
          historySaveStatus={historySaveStatus}
          onRetryHistorySave={retryHistorySave}
          onAgain={restart}
          onBack={onExit}
        />
      )}

      <Dialog open={exitOpen} onOpenChange={setExitOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{audience === "client" ? "Exit workout?" : "Exit preview?"}</DialogTitle>
            <DialogDescription>
              {audience === "client"
                ? "Workout results will be discarded."
                : "Preview results will be discarded."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExitOpen(false)}>
              {audience === "client" ? "Continue workout" : "Continue preview"}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setExitOpen(false);
                onExit();
              }}
            >
              Exit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pauseOpen} onOpenChange={setPauseOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Pause workout?</DialogTitle>
            <DialogDescription>
              Your completed sets will be saved where you left off. If you don&apos;t resume
              today, this workout will be logged to your history tomorrow with only the sets you
              completed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPauseOpen(false)}>
              Keep training
            </Button>
            <Button onClick={() => void confirmPause()}>Pause workout</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FullscreenSurface>
  );
}

function FullscreenSurface({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-background text-foreground motion-reduce:transition-none"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
      role="region"
      aria-label="Workout preview"
    >
      {children}
    </div>
  );
}

function ModeChooser({
  workoutName,
  audience,
  onPickClassic,
  onPickGuided,
  onBack,
}: {
  workoutName: string;
  audience: "coach" | "client";
  onPickClassic: () => void;
  onPickGuided: () => void;
  onBack: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col justify-between gap-8 p-6">
      <div>
        <p className="text-[0.8125rem] font-medium uppercase tracking-wide text-muted-foreground">
          {audience === "client" ? "Today’s workout" : "Previewing"}
        </p>
        <h1 className="mt-1 text-[clamp(1.5rem,6vw,2rem)] font-semibold leading-tight tracking-tight text-foreground">{workoutName}</h1>
        <p className="mt-6 text-[1rem] leading-6 text-foreground">
          {audience === "client"
            ? "How do you want to train?"
            : "How do you want to preview this workout?"}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={onPickGuided}
          className="group min-h-16 rounded-xl border border-border bg-card p-5 text-left shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors hover:border-primary/60 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[1.125rem] font-semibold leading-tight tracking-tight">Guided Mode</span>
            <ChevronRight
              className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </div>
          <p className="mt-1.5 text-[1rem] leading-5 text-muted-foreground">
            Move through one set at a time with rest timers.
          </p>
        </button>
        <button
          type="button"
          onClick={onPickClassic}
          className="group min-h-16 rounded-xl border border-border bg-card p-5 text-left shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors hover:border-primary/60 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[1.125rem] font-semibold leading-tight tracking-tight">Classic Mode</span>
            <ChevronRight
              className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </div>
          <p className="mt-1.5 text-[1rem] leading-5 text-muted-foreground">
            See every exercise and log sets freely.
          </p>
        </button>

        <Button variant="ghost" onClick={onBack} className="mt-2 min-h-11 self-start rounded-xl text-[1rem]">
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          {audience === "client" ? "Back to dashboard" : "Back to builder"}
        </Button>
      </div>
    </div>
  );
}

function PreviewHeader({
  title,
  subtitle,
  elapsed,
  right,
  onExit,
}: {
  title: string;
  subtitle?: string;
  elapsed: number;
  right: React.ReactNode;
  onExit: () => void;
}) {
  return (
    <header
      className="sticky top-0 z-10 border-b border-border bg-background/95 px-4 py-3.5 backdrop-blur"
      style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[1.125rem] font-semibold leading-tight tracking-tight text-foreground">{title}</h1>
          {subtitle && <p className="truncate text-[1rem] leading-5 text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          <span
            className="rounded-md border border-border bg-muted px-2.5 py-1 text-[0.875rem] font-medium tabular-nums leading-5 text-foreground"
            aria-label={`Elapsed ${formatElapsed(elapsed)}`}
          >
            {formatElapsed(elapsed)}
          </span>
          {right}
          <SettingsMenu />
          <Button variant="ghost" size="icon" onClick={onExit} aria-label="Exit preview" className="min-h-11 min-w-11 rounded-xl">
            <X className="h-5 w-5" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </header>
  );
}

function ClassicMode({
  workout,
  exercisesById,
  weightUnits,
  weightUnitsById,
  results,
  dispatch,
  audience,
  elapsed,
  lastWeights,
  selectingGuidedSet,
  selectedGuidedSetKey,
  onSelectGuidedSet,
  onSwitchGuided,
  onConfirmGuidedSet,
  onCancelGuidedSet,
  onCreateWeightUnit,
  onFinish,
  onExit,
  onPause,
}: {
  workout: ProgramWorkout;
  exercisesById: Map<string, Exercise>;
  weightUnits: WeightUnit[];
  weightUnitsById: Map<string, WeightUnit>;
  results: SessionResultsMap;
  dispatch: React.Dispatch<Action>;
  audience: "coach" | "client";
  elapsed: number;
  lastWeights: Record<string, LastExerciseWeight>;
  selectingGuidedSet: boolean;
  selectedGuidedSetKey: string | null;
  onSelectGuidedSet: (key: string) => void;
  onSwitchGuided: () => void;
  onConfirmGuidedSet: () => void;
  onCancelGuidedSet: () => void;
  onCreateWeightUnit: (unit: WeightUnit) => void;
  onFinish: () => void;
  onExit: () => void;
  onPause: () => void;
}) {
  return (
    <>
      <PreviewHeader
        title={workout.name}
        subtitle={audience === "client" ? "Classic workout" : "Classic preview"}
        elapsed={elapsed}
        right={
          <>
            {audience === "client" && (
              <Button
                variant="outline"
                onClick={onPause}
                disabled={selectingGuidedSet}
                className="min-h-10 rounded-lg text-[1rem]"
              >
                <Pause className="h-4 w-4" aria-hidden="true" />
                Pause
              </Button>
            )}
            <Button
              variant="outline"
              onClick={onSwitchGuided}
              disabled={selectingGuidedSet}
              className="min-h-10 rounded-lg text-[1rem]"
            >
              Guided
            </Button>
          </>
        }
        onExit={onExit}
      />
      <div className="mx-auto w-full max-w-md space-y-6 p-4">
        {selectingGuidedSet && (
          <p className="rounded-xl border border-primary/40 bg-primary/5 px-4 py-3 text-[1rem] leading-5 text-foreground">
            Select the set where Guided Mode should begin.
          </p>
        )}
        {workout.exercises.map((ex, exIdx) => {
          const def = exercisesById.get(ex.exerciseId);
          return (
            <section
              key={ex.id}
              aria-labelledby={`ex-${ex.id}-h`}
              className="rounded-xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
            >
              <div className="flex items-baseline justify-between gap-2">
                <h2 id={`ex-${ex.id}-h`} className="text-[1.125rem] font-semibold leading-tight tracking-tight text-foreground">
                  <span className="text-muted-foreground">{exIdx + 1}.</span>{" "}
                  {def ? def.name : "Unknown exercise"}
                </h2>
              </div>
              {ex.notes && (
                <div className="mt-3 rounded-lg bg-muted/40 px-3.5 py-2.5">
                  <p className="text-[0.8125rem] font-medium uppercase tracking-wide text-muted-foreground">
                    Notes from coach
                  </p>
                  <p className="mt-1.5 whitespace-pre-line text-[1rem] leading-5 text-foreground">{ex.notes}</p>
                </div>
              )}
              <ul role="list" className="mt-4 space-y-3">
                {ex.sets.map((set, setIdx) => {
                  const key = resultKey(ex.id, set.id);
                  const result = results[key];
                  if (!result) return null;
                  return (
                    <li key={set.id}>
                      <ClassicSetRow
                        setIndex={setIdx}
                        set={set}
                        suggestedWeightUnit={
                          weightUnitsById.get(set.weightUnitId) ??
                          getWeightUnit([], set.weightUnitId)
                        }
                        weightUnits={weightUnits}
                        result={result}
                        lastWeight={lastWeights[ex.exerciseId]}
                        selecting={selectingGuidedSet}
                        selected={selectedGuidedSetKey === key}
                        onSelect={() => onSelectGuidedSet(key)}
                        onWeight={(value) =>
                          dispatch({
                            type: "set-result",
                            key,
                            patch: { actualWeight: clampNonNegative(value) },
                          })
                        }
                        onWeightUnit={(actualWeightUnitId) =>
                          dispatch({
                            type: "set-result",
                            key,
                            patch: { actualWeightUnitId },
                          })
                        }
                        onReps={(value) =>
                          dispatch({
                            type: "set-result",
                            key,
                            patch: { actualReps: clampNonNegative(value) },
                          })
                        }
                        onSeconds={(value) =>
                          dispatch({
                            type: "set-result",
                            key,
                            patch: { actualSeconds: clampNonNegative(value) },
                          })
                        }
                        onNotes={(notesToCoach) =>
                          dispatch({
                            type: "set-result",
                            key,
                            patch: { notesToCoach },
                          })
                        }
                        onCreateWeightUnit={onCreateWeightUnit}
                        onToggle={() => dispatch({ type: "toggle-complete", key })}
                      />
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}

        {selectingGuidedSet ? (
          <div className="grid grid-cols-2 gap-2.5">
            <Button onClick={onConfirmGuidedSet} disabled={!selectedGuidedSetKey} className="min-h-12 rounded-xl text-[1rem] font-semibold">
              Select set
            </Button>
            <Button variant="outline" onClick={onCancelGuidedSet} className="min-h-12 rounded-xl text-[1rem] font-semibold">
              Cancel
            </Button>
          </div>
        ) : (
          <Button className="min-h-12 w-full rounded-xl text-[1rem] font-semibold" onClick={onFinish}>
            <Flag className="h-5 w-5" aria-hidden="true" />
            {audience === "client" ? "Finish workout" : "Finish preview"}
          </Button>
        )}
      </div>
    </>
  );
}

function ClassicSetRow({
  setIndex,
  set,
  suggestedWeightUnit,
  weightUnits,
  result,
  lastWeight,
  selecting,
  selected,
  onSelect,
  onWeight,
  onWeightUnit,
  onReps,
  onSeconds,
  onNotes,
  onCreateWeightUnit,
  onToggle,
}: {
  setIndex: number;
  set: import("@/lib/coach-workouts").WorkoutSetPrescription;
  suggestedWeightUnit: WeightUnit;
  weightUnits: WeightUnit[];
  result: PreviewSetResult;
  lastWeight?: LastExerciseWeight;
  selecting: boolean;
  selected: boolean;
  onSelect: () => void;
  onWeight: (number: number) => void;
  onWeightUnit: (unitId: string) => void;
  onReps: (number: number) => void;
  onSeconds: (number: number) => void;
  onNotes: (notes: string | undefined) => void;
  onCreateWeightUnit: (unit: WeightUnit) => void;
  onToggle: () => void;
}) {
  const chips: string[] = [SET_TYPE_LABELS[set.setType]];
  if (set.intensity) chips.push(INTENSITY_LABELS[set.intensity]);
  const repPrescription = formatSetPrescription(set);
  if (repPrescription) chips.push(repPrescription);
  const suggestedWeight = formatSuggestedWeightRange(set, suggestedWeightUnit.shortForm);
  if (set.restSeconds !== undefined) chips.push(`rest ${set.restSeconds}s`);

  return (
    <div
      role={selecting ? "radio" : undefined}
      aria-checked={selecting ? selected : undefined}
      tabIndex={selecting ? 0 : undefined}
      onClick={selecting ? onSelect : undefined}
      onKeyDown={
        selecting
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect();
              }
            }
          : undefined
      }
      className={cn(
        "rounded-xl border p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-[border-color,box-shadow,background-color]",
        result.completed ? "border-primary/60 bg-primary/5" : "border-border bg-card",
        selecting && "cursor-pointer",
        selecting && selected && "border-primary bg-primary/10 ring-2 ring-primary/30",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-[1rem] font-medium leading-5 text-muted-foreground">Set {setIndex + 1}</span>
        <Button
          type="button"
          size="sm"
          variant={result.completed ? "default" : "outline"}
          onClick={(event) => {
            if (selecting) return;
            event.stopPropagation();
            onToggle();
          }}
          disabled={selecting}
          aria-pressed={result.completed}
          aria-label={
            result.completed
              ? `Mark set ${setIndex + 1} incomplete`
              : `Complete set ${setIndex + 1}`
          }
          className="min-h-10 rounded-lg px-3 py-1.5 text-[1rem]"
        >
          <Check className="h-4 w-4" aria-hidden="true" />
          {result.completed ? "Completed" : "Complete"}
        </Button>
      </div>
      <ul className="mt-2.5 flex flex-wrap gap-1.5" aria-label="Prescription">
        {chips.map((chip) => (
          <li
            key={chip}
            className="rounded-md border border-border bg-muted px-2.5 py-1 text-[0.75rem] font-medium uppercase tracking-wide text-muted-foreground"
          >
            {chip}
          </li>
        ))}
      </ul>
      {suggestedWeight && (
        <div className="mt-3 rounded-lg border border-border bg-muted/30 px-3.5 py-2.5">
          <p className="text-[0.8125rem] font-medium uppercase tracking-wide text-muted-foreground">
            Suggested weight range
          </p>
          <p className="mt-1 text-[1rem] font-semibold leading-5 tabular-nums text-foreground">
            {suggestedWeight}
          </p>
        </div>
      )}
      {set.coachNotes && (
        <div className="mt-3 rounded-lg bg-muted/40 px-3.5 py-2.5">
          <p className="text-[0.8125rem] font-medium uppercase tracking-wide text-muted-foreground">
            Notes from coach
          </p>
          <p className="mt-1.5 whitespace-pre-line text-[1rem] leading-5 text-foreground">{set.coachNotes}</p>
        </div>
      )}
      <div className="mt-4 space-y-4">
        <div className="space-y-1.5">
          <Label
            htmlFor={`w-${result.setId}`}
            className="text-[1rem] font-medium leading-5 text-muted-foreground"
          >
            Weight done
          </Label>
          {lastWeight && (
            <p className="text-[0.8125rem] leading-5 text-muted-foreground">
              Last time: {formatWeightNumber(lastWeight.weight)} {lastWeight.unitShortForm}
            </p>
          )}
          <WeightDoneInput
            id={`w-${result.setId}`}
            value={result.actualWeight}
            unitId={result.actualWeightUnitId}
            units={weightUnits}
            disabled={selecting}
            large
            onValueChange={onWeight}
            onUnitChange={onWeightUnit}
            onCreateUnit={onCreateWeightUnit}
          />
        </div>
        <div className="space-y-1.5">
          <Label
            htmlFor={`r-${result.setId}`}
            className="text-[1rem] font-medium leading-5 text-muted-foreground"
          >
            {set.setType === "static_stretch"
              ? "Prescribed time"
              : set.setType === "static_strength"
                ? "Time done (sec)"
                : "Reps done"}
          </Label>
          {set.setType === "static_stretch" ? (
            <p
              id={`r-${result.setId}`}
              className="min-h-12 rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-[1rem] leading-6 tabular-nums text-foreground"
            >
              {set.targetSeconds !== undefined ? `${set.targetSeconds}s` : "—"}
            </p>
          ) : (
            <DefaultZeroNumberInput
              id={`r-${result.setId}`}
              value={set.setType === "static_strength" ? result.actualSeconds : result.actualReps}
              onChange={set.setType === "static_strength" ? onSeconds : onReps}
              integer
              disabled={selecting}
              className="min-h-12 rounded-xl text-[1rem]"
            />
          )}
        </div>
        <div className="space-y-1.5">
          <Label
            htmlFor={`client-notes-${result.setId}`}
            className="text-[1rem] font-medium leading-5 text-muted-foreground"
          >
            Notes to your coach
          </Label>
          <Textarea
            id={`client-notes-${result.setId}`}
            value={result.notesToCoach ?? ""}
            onChange={(event) =>
              onNotes(event.target.value.trim().length > 0 ? event.target.value : undefined)
            }
            placeholder="Add a note for your coach"
            rows={1}
            maxLength={SET_NOTES_MAX_LENGTH}
            disabled={selecting}
            className="min-h-12 resize-y rounded-xl py-3 text-[1rem] leading-6"
          />
        </div>
      </div>
    </div>
  );
}

function GuidedMode({
  workout,
  flat,
  exercisesById,
  weightUnits,
  weightUnitsById,
  results,
  dispatch,
  elapsed,
  lastWeights,
  audience,
  index,
  setIndex,
  inRest,
  setInRest,
  onCreateWeightUnit,
  onSwitchClassic,
  onPause,
  onFinish,
  onExit,
}: {
  workout: ProgramWorkout;
  flat: FlatSetRef[];
  exercisesById: Map<string, Exercise>;
  weightUnits: WeightUnit[];
  weightUnitsById: Map<string, WeightUnit>;
  results: SessionResultsMap;
  dispatch: React.Dispatch<Action>;
  elapsed: number;
  lastWeights: Record<string, LastExerciseWeight>;
  audience: "coach" | "client";
  index: number;
  setIndex: (index: number) => void;
  inRest: boolean;
  setInRest: (inRest: boolean) => void;
  onCreateWeightUnit: (unit: WeightUnit) => void;
  onSwitchClassic: () => void;
  onPause: () => void;
  onFinish: () => void;
  onExit: () => void;
}) {
  useEffect(() => {
    if (index >= flat.length) onFinish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  if (index >= flat.length) return null;

  const currentRef = flat[index];
  const key = resultKey(currentRef.exerciseInstanceId, currentRef.setId);
  const currentResult = results[key];
  const definition = exercisesById.get(currentRef.exercise.exerciseId);

  const advance = () => {
    const nextIndex = findNextIncomplete(flat, results, index + 1);
    if (nextIndex >= flat.length) {
      onFinish();
      return;
    }
    setIndex(nextIndex);
    setInRest(false);
  };

  const upcomingSupersets = (() => {
    const upcoming: typeof flat = [];
    let i = index + 1;
    while (i < flat.length) {
      const prev = flat[i - 1];
      const curr = flat[i];
      const prevRest = restSecondsFor(prev.set);
      const isPrevSuperset = prev.set.setType === "superset" || prev.set.setType === "alternating" || prevRest === 0;
      if (!isPrevSuperset) break;
      upcoming.push(curr);
      i++;
    }
    return upcoming;
  })();

  return (
    <>
      <PreviewHeader
        title={workout.name}
        subtitle={`Set ${index + 1} of ${flat.length}`}
        elapsed={elapsed}
        right={
          <>
            {audience === "client" && (
              <Button
                variant="outline"
                onClick={onPause}
                className="min-h-10 rounded-lg text-[1rem]"
              >
                <Pause className="h-4 w-4" aria-hidden="true" />
                Pause
              </Button>
            )}
            <Button variant="outline" onClick={onSwitchClassic} className="min-h-10 rounded-lg text-[1rem]">
              Classic
            </Button>
          </>
        }
        onExit={onExit}
      />
      {inRest ? (
        <RestPanel
          restSeconds={restSecondsFor(currentRef.set)}
          nextInfo={describeNext(flat, results, index, exercisesById)}
          onDone={advance}
          onSkip={advance}
        />
      ) : (
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 p-4 overflow-y-auto overscroll-contain">
          <PerformPanel
            ref_={currentRef}
            def={definition}
            suggestedWeightUnit={
              weightUnitsById.get(currentRef.set.weightUnitId) ??
              getWeightUnit([], currentRef.set.weightUnitId)
            }
            weightUnits={weightUnits}
            result={currentResult}
            lastWeight={lastWeights[currentRef.exercise.exerciseId]}
            onWeight={(value) =>
              dispatch({
                type: "set-result",
                key,
                patch: { actualWeight: clampNonNegative(value) },
              })
            }
            onWeightUnit={(actualWeightUnitId) =>
              dispatch({
                type: "set-result",
                key,
                patch: { actualWeightUnitId },
              })
            }
            onReps={(value) =>
              dispatch({
                type: "set-result",
                key,
                patch: { actualReps: clampNonNegative(value) },
              })
            }
            onSeconds={(value) =>
              dispatch({
                type: "set-result",
                key,
                patch: { actualSeconds: clampNonNegative(value) },
              })
            }
            onNotes={(notesToCoach) =>
              dispatch({
                type: "set-result",
                key,
                patch: { notesToCoach },
              })
            }
            onCreateWeightUnit={onCreateWeightUnit}
            hasUpcomingSupersets={upcomingSupersets.length > 0}
            onComplete={() => {
              dispatch({
                type: "mark-complete",
                key,
                actualSeconds:
                  currentRef.set.setType === "static_stretch"
                    ? (currentRef.set.targetSeconds ?? 0)
                    : undefined,
              });
              const nextIndex = findNextIncomplete(flat, results, index + 1);
              if (nextIndex >= flat.length) {
                onFinish();
                return;
              }
              if (restSecondsFor(currentRef.set) > 0) setInRest(true);
              else setIndex(nextIndex);
            }}
            onSkip={() => {
              const nextIndex = findNextIncomplete(flat, results, index + 1);
              if (nextIndex >= flat.length) {
                onFinish();
                return;
              }
              setIndex(nextIndex);
              setInRest(false);
            }}
          />
          {upcomingSupersets.length > 0 && (
            <div className="space-y-3 border-t border-border pt-4">
              <p className="text-[0.8125rem] font-medium uppercase tracking-wide text-muted-foreground">
                Up next — supersets (no rest)
              </p>
              <div className="space-y-3">
                {upcomingSupersets.map((upRef) => {
                  const upDef = exercisesById.get(upRef.exercise.exerciseId);
                  const upKey = resultKey(upRef.exerciseInstanceId, upRef.setId);
                  const upResult = results[upKey];
                  return (
                    <div key={upKey} className="rounded-xl border border-border/60 bg-muted/20 p-4 opacity-90">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[0.875rem] font-medium text-muted-foreground">
                          {upDef ? upDef.name : "Unknown exercise"} · Set {upRef.setIndex + 1}
                        </p>
                        <span className="rounded-md bg-[#E50910]/15 px-2 py-0.5 text-[0.75rem] font-medium uppercase tracking-wide text-[#E50910]">
                          Superset
                        </span>
                      </div>
                      <p className="mt-1 text-[0.875rem] leading-5 text-muted-foreground">
                        {formatSetPrescription(upRef.set) || SET_TYPE_LABELS[upRef.set.setType]}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function formatWeightNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function findNextIncomplete(flat: FlatSetRef[], results: SessionResultsMap, from: number): number {
  for (let i = from; i < flat.length; i += 1) {
    const r = results[resultKey(flat[i].exerciseInstanceId, flat[i].setId)];
    if (!r?.completed) return i;
  }
  return flat.length;
}

function describeNext(
  flat: FlatSetRef[],
  results: SessionResultsMap,
  fromIndex: number,
  exercisesById: Map<string, Exercise>,
): string {
  const nextIdx = findNextIncomplete(flat, results, fromIndex + 1);
  if (nextIdx >= flat.length) return "Last set complete";
  const ref = flat[nextIdx];
  const def = exercisesById.get(ref.exercise.exerciseId);
  return `Next: ${def?.name ?? "Exercise"} · Set ${ref.setIndex + 1}`;
}

function PerformPanel({
  ref_,
  def,
  suggestedWeightUnit,
  weightUnits,
  result,
  lastWeight,
  onWeight,
  onWeightUnit,
  onReps,
  onSeconds,
  onNotes,
  onCreateWeightUnit,
  hasUpcomingSupersets,
  onComplete,
  onSkip,
}: {
  ref_: FlatSetRef;
  def: Exercise | undefined;
  suggestedWeightUnit: WeightUnit;
  weightUnits: WeightUnit[];
  result: PreviewSetResult | undefined;
  lastWeight?: LastExerciseWeight;
  onWeight: (number: number) => void;
  onWeightUnit: (unitId: string) => void;
  onReps: (number: number) => void;
  onSeconds: (number: number) => void;
  onNotes: (notes: string | undefined) => void;
  onCreateWeightUnit: (unit: WeightUnit) => void;
  hasUpcomingSupersets: boolean;
  onComplete: () => void;
  onSkip: () => void;
}) {
  if (!result) return null;

  const { exercise, set, exerciseIndex, setIndex, totalSetsInExercise } = ref_;
  const chips: string[] = [SET_TYPE_LABELS[set.setType]];
  if (set.intensity) chips.push(INTENSITY_LABELS[set.intensity]);
  const repPrescription = formatSetPrescription(set);
  if (repPrescription) chips.push(repPrescription);
  if (set.restSeconds !== undefined) chips.push(`rest ${set.restSeconds}s`);
  const suggestedWeight = formatSuggestedWeightRange(set, suggestedWeightUnit.shortForm);

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 p-4">
      <div>
        <p className="text-[0.8125rem] font-medium uppercase tracking-wide text-muted-foreground">
          Exercise {exerciseIndex + 1} · Set {setIndex + 1} of {totalSetsInExercise}
        </p>
        <h2 className="mt-1 text-[clamp(1.5rem,6vw,2rem)] font-semibold leading-tight tracking-tight">
          {def ? def.name : "Unknown exercise"}
        </h2>
        {exercise.notes && (
          <div className="mt-3 rounded-lg bg-muted/40 px-3.5 py-2.5">
            <p className="text-[0.8125rem] font-medium uppercase tracking-wide text-muted-foreground">
              Notes from coach
            </p>
            <p className="mt-1 whitespace-pre-line text-sm text-foreground">{exercise.notes}</p>
          </div>
        )}
        <ul className="mt-3 flex flex-wrap gap-1" aria-label="Prescription">
          {chips.map((chip) => (
            <li
              key={chip}
              className="rounded-md border border-border bg-muted px-2.5 py-1 text-[0.75rem] font-medium uppercase tracking-wide text-muted-foreground"
            >
              {chip}
            </li>
          ))}
        </ul>
        {suggestedWeight && (
          <div className="mt-3 rounded-lg border border-border bg-muted/30 px-3.5 py-2.5">
            <p className="text-[0.8125rem] font-medium uppercase tracking-wide text-muted-foreground">
              Suggested weight range
            </p>
            <p className="mt-0.5 text-base font-semibold tabular-nums text-foreground">
              {suggestedWeight}
            </p>
          </div>
        )}
        {set.coachNotes && (
          <div className="mt-3 rounded-lg bg-muted/40 px-3.5 py-2.5">
            <p className="text-[0.8125rem] font-medium uppercase tracking-wide text-muted-foreground">
              Notes from coach
            </p>
            <p className="mt-1 whitespace-pre-line text-sm text-foreground">{set.coachNotes}</p>
          </div>
        )}
      </div>

      <div className="space-y-3 rounded-lg border border-border bg-card p-4">
        <div className="space-y-1.5">
          <Label htmlFor={`guided-weight-${set.id}`} className="text-[1rem] font-medium leading-5 text-muted-foreground">
            Weight done
          </Label>
          {lastWeight && (
            <p className="text-[0.8125rem] leading-5 text-muted-foreground">
              Last time: {formatWeightNumber(lastWeight.weight)} {lastWeight.unitShortForm}
            </p>
          )}
          <WeightDoneInput
            id={`guided-weight-${set.id}`}
            value={result.actualWeight}
            unitId={result.actualWeightUnitId}
            units={weightUnits}
            onValueChange={onWeight}
            onUnitChange={onWeightUnit}
            onCreateUnit={onCreateWeightUnit}
            large
          />
        </div>
        {set.setType === "static_stretch" ? (
          <StaticStretchTimer
            id={`guided-time-${set.id}`}
            seconds={set.targetSeconds ?? 0}
            inline={hasUpcomingSupersets}
          />
        ) : set.setType === "static_strength" ? (
          <RepsStepper
            id={`guided-time-${set.id}`}
            label="Time done (sec)"
            value={result.actualSeconds}
            onChange={onSeconds}
            step={5}
          />
        ) : (
          <RepsStepper
            id={`guided-reps-${set.id}`}
            label="Reps done"
            value={result.actualReps}
            onChange={onReps}
          />
        )}
        <div className="space-y-1.5">
          <Label htmlFor={`guided-notes-${set.id}`} className="text-[1rem] font-medium leading-5 text-muted-foreground">
            Notes to your coach
          </Label>
          <Textarea
            id={`guided-notes-${set.id}`}
            value={result.notesToCoach ?? ""}
            onChange={(event) =>
              onNotes(event.target.value.trim().length > 0 ? event.target.value : undefined)
            }
            placeholder="Add a note for your coach"
            rows={1}
            maxLength={SET_NOTES_MAX_LENGTH}
            className="min-h-12 resize-y rounded-xl py-3 text-[1rem] leading-6"
          />
        </div>
        <Button className="min-h-12 w-full rounded-xl text-[1rem] font-semibold" onClick={onComplete}>
          <Check className="h-5 w-5" aria-hidden="true" />
          Complete set
        </Button>
      </div>

      <Button variant="ghost" onClick={onSkip} className="min-h-11 self-center rounded-xl text-[1rem]">
        <SkipForward className="h-5 w-5" aria-hidden="true" />
        Skip set
      </Button>
    </div>
  );
}

function RepsStepper({
  id,
  label,
  value,
  onChange,
  step = 1,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (number: number) => void;
  step?: number;
}) {
  const unitLabel = step > 1 ? "seconds" : "reps";
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-[1rem] font-medium leading-5 text-muted-foreground">
        {label}
      </Label>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={`Decrease ${unitLabel}`}
          onClick={() => onChange(clampNonNegative(value - step))}
          className="h-11 w-11 shrink-0"
        >
          <Minus className="h-4 w-4" aria-hidden="true" />
        </Button>
        <DefaultZeroNumberInput
          id={id}
          value={value}
          onChange={onChange}
          integer
          className="h-11 text-center text-base"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={`Increase ${unitLabel}`}
          onClick={() => onChange(clampNonNegative(value + step))}
          className="h-11 w-11 shrink-0"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

function StaticStretchTimer({
  id,
  seconds,
  inline,
}: {
  id: string;
  seconds: number;
  inline: boolean;
}) {
  const [remaining, setRemaining] = useState(seconds);
  const remainingRef = useRef(remaining);
  remainingRef.current = remaining;

  useEffect(() => {
    setRemaining(seconds);
  }, [seconds]);

  useEffect(() => {
    if (seconds <= 0) return;
    const id_ = window.setInterval(() => {
      setRemaining((r) => (r > 0 ? r - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id_);
  }, [seconds]);

  const pct =
    seconds > 0 ? Math.max(0, Math.min(100, ((seconds - remaining) / seconds) * 100)) : 100;
  const done = seconds > 0 && remaining <= 0;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-[1rem] font-medium leading-5 text-muted-foreground">
        {inline ? "Hold time" : "Hold — countdown"}
      </Label>
      {inline ? (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-3.5">
          <div
            className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(pct)}
            aria-label="Static stretch hold progress"
          >
            <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
          <span
            id={id}
            className="text-[0.875rem] font-medium leading-5 tabular-nums text-foreground"
            role="timer"
            aria-live="polite"
            aria-label={`${remaining} seconds remaining`}
          >
            {formatElapsed(remaining)}
          </span>
        </div>
      ) : (
        <div className="flex items-center justify-center rounded-xl border border-border bg-background p-5">
          <div
            className="relative h-40 w-40"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(pct)}
            aria-label="Static stretch hold progress"
          >
            <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden="true">
              <circle
                cx="60"
                cy="60"
                r="52"
                fill="none"
                strokeWidth="8"
                className="stroke-muted"
              />
              <circle
                cx="60"
                cy="60"
                r="52"
                fill="none"
                strokeWidth="8"
                strokeLinecap="round"
                className="stroke-primary transition-[stroke-dashoffset] duration-1000 ease-linear"
                strokeDasharray={2 * Math.PI * 52}
                strokeDashoffset={2 * Math.PI * 52 * (1 - pct / 100)}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span
                id={id}
                className="text-4xl font-semibold leading-none tabular-nums text-foreground"
                role="timer"
                aria-live="polite"
                aria-label={`${remaining} seconds remaining`}
              >
                {formatElapsed(remaining)}
              </span>
            </div>
          </div>
        </div>
      )}
      {done && (
        <p className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-[1rem] leading-5 text-primary">
          Hold complete — log it below when you&apos;re ready.
        </p>
      )}
    </div>
  );
}

function WeightDoneInput({
  id,
  value,
  unitId,
  units,
  disabled = false,
  large = false,
  onValueChange,
  onUnitChange,
  onCreateUnit,
}: {
  id: string;
  value: number;
  unitId: string;
  units: WeightUnit[];
  disabled?: boolean;
  large?: boolean;
  onValueChange: (value: number) => void;
  onUnitChange: (unitId: string) => void;
  onCreateUnit: (unit: WeightUnit) => void;
}) {
  const [draft, setDraft] = useState(() => `${value}`);
  const [focused, setFocused] = useState(false);
  const unit = getWeightUnit(units, unitId);

  useEffect(() => {
    if (!focused) setDraft(`${value}`);
  }, [focused, value]);

  const commit = (next: number) => {
    const normalized = clampNonNegative(next);
    setDraft(`${normalized}`);
    onValueChange(normalized);
  };

  const step = (direction: 1 | -1) => {
    const current = draft.trim() === "" ? 0 : Number(draft);
    commit(stepWeight(current, unit.increment, direction));
  };

  return (
    <div className="relative">
      <div className="absolute inset-y-1 left-1 z-[1] flex overflow-hidden rounded border border-border bg-background">
        <button
          type="button"
          aria-label={`Increase weight by ${unit.increment} ${unit.shortForm}`}
          disabled={disabled}
          onClick={() => step(1)}
          className="inline-flex w-8 items-center justify-center text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
        >
          <ChevronUp className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label={`Decrease weight by ${unit.increment} ${unit.shortForm}`}
          disabled={disabled}
          onClick={() => step(-1)}
          className="inline-flex w-8 items-center justify-center border-l border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
        >
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        min="0"
        step="any"
        value={draft}
        disabled={disabled}
        onFocus={(event) => {
          setFocused(true);
          event.currentTarget.select();
        }}
        onChange={(event) => {
          const raw = event.target.value;
          setDraft(raw);
          if (raw.trim() === "") return;
          const number = Number(raw);
          if (Number.isFinite(number) && number >= 0) onValueChange(number);
        }}
        onBlur={() => {
          setFocused(false);
          const number = Number(draft);
          commit(draft.trim() !== "" && Number.isFinite(number) && number >= 0 ? number : 0);
        }}
        className={cn(
          large
            ? "min-h-12 rounded-xl pl-[4.75rem] pr-20 text-[1rem]"
            : "min-h-12 rounded-xl pl-[4.75rem] pr-20 text-[1rem]",
        )}
      />
      <WeightUnitSelector
        value={unit.id}
        units={units}
        onChange={onUnitChange}
        onCreate={onCreateUnit}
        embedded
        disabled={disabled}
      />
    </div>
  );
}

function DefaultZeroNumberInput({
  id,
  value,
  onChange,
  integer = false,
  disabled = false,
  className,
}: {
  id: string;
  value: number;
  onChange: (value: number) => void;
  integer?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const [draft, setDraft] = useState(() => `${value}`);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(`${value}`);
  }, [focused, value]);

  const normalize = (number: number) => {
    const nonNegative = clampNonNegative(number);
    return integer ? Math.floor(nonNegative) : nonNegative;
  };

  return (
    <Input
      id={id}
      type="number"
      inputMode={integer ? "numeric" : "decimal"}
      min="0"
      step={integer ? "1" : "any"}
      value={draft}
      disabled={disabled}
      onFocus={(event) => {
        setFocused(true);
        event.currentTarget.select();
      }}
      onChange={(event) => {
        const raw = event.target.value;
        setDraft(raw);
        if (raw.trim() === "") return;
        const number = Number(raw);
        if (Number.isFinite(number) && number >= 0) onChange(normalize(number));
      }}
      onBlur={() => {
        setFocused(false);
        const number = Number(draft);
        const normalized = draft.trim() !== "" && Number.isFinite(number) ? normalize(number) : 0;
        setDraft(`${normalized}`);
        onChange(normalized);
      }}
      className={className}
    />
  );
}

function RestPanel({
  restSeconds,
  nextInfo,
  nextLabel = "Start next set",
  onDone,
  onSkip,
}: {
  restSeconds: number;
  nextInfo: string;
  nextLabel?: string;
  onDone: () => void;
  onSkip: () => void;
}) {
  const [remaining, setRemaining] = useState(restSeconds);
  const remainingRef = useRef(remaining);
  remainingRef.current = remaining;

  useEffect(() => {
    setRemaining(restSeconds);
  }, [restSeconds]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setRemaining((r) => (r > 0 ? r - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const pct =
    restSeconds > 0
      ? Math.max(0, Math.min(100, ((restSeconds - remaining) / restSeconds) * 100))
      : 100;

  const done = remaining <= 0;

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
      <p className="text-[0.8125rem] font-medium uppercase tracking-wide text-muted-foreground">Rest</p>
      <div
        className="relative h-52 w-52"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-label="Rest progress"
      >
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden="true">
          <circle cx="60" cy="60" r="52" fill="none" strokeWidth="8" className="stroke-muted" />
          <circle
            cx="60"
            cy="60"
            r="52"
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            className="stroke-primary transition-[stroke-dashoffset] duration-1000 ease-linear"
            strokeDasharray={2 * Math.PI * 52}
            strokeDashoffset={2 * Math.PI * 52 * (1 - pct / 100)}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="text-6xl font-semibold tabular-nums"
            role="timer"
            aria-live="polite"
            aria-label={`Rest ${remaining} seconds remaining`}
          >
            {formatElapsed(remaining)}
          </span>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{nextInfo}</p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button variant="outline" onClick={() => setRemaining((r) => clampNonNegative(r - 15))}>
          <Minus className="h-4 w-4" aria-hidden="true" />
          15 sec
        </Button>
        <Button variant="outline" onClick={() => setRemaining((r) => r + 15)}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          15 sec
        </Button>
        <Button variant="ghost" onClick={onSkip}>
          <SkipForward className="h-4 w-4" aria-hidden="true" />
          Skip rest
        </Button>
      </div>
      {done && (
        <Button className="w-full max-w-xs" onClick={onDone}>
          <Pause className="h-4 w-4 rotate-90" aria-hidden="true" />
          {nextLabel}
        </Button>
      )}
    </div>
  );
}

function SummaryScreen({
  workout,
  weightUnits,
  audience,
  results,
  elapsed,
  historySaveStatus,
  onRetryHistorySave,
  onAgain,
  onBack,
}: {
  workout: ProgramWorkout;
  weightUnits: WeightUnit[];
  audience: "coach" | "client";
  results: SessionResultsMap;
  elapsed: number;
  historySaveStatus: "idle" | "saving" | "saved" | "error";
  onRetryHistorySave: () => void;
  onAgain: () => void;
  onBack: () => void;
}) {
  const { completedSets, totalReps, volumeByUnitId } = useMemo(
    () => computeSummary(workout, results),
    [workout, results],
  );
  const volume = Object.entries(volumeByUnitId)
    .map(([unitId, value]) => {
      const unit = getWeightUnit(weightUnits, unitId);
      const formatted = value % 1 === 0 ? `${value}` : value.toFixed(1);
      return `${formatted} ${unit.shortForm}`;
    })
    .join(" · ");

  const stats = [
    { label: "Duration", value: formatElapsed(elapsed) },
    { label: "Completed sets", value: `${completedSets}` },
    { label: "Total reps", value: `${totalReps}` },
    { label: "Total volume", value: volume || "0" },
  ];

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col justify-between gap-6 p-6">
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {audience === "client" ? "Workout complete" : "Preview complete"}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{workout.name}</h1>
      </div>
      <dl className="grid grid-cols-2 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-card p-4">
            <dt className="text-[0.875rem] leading-5 text-muted-foreground">{s.label}</dt>
            <dd
              className={`mt-1 font-semibold tabular-nums ${
                s.label === "Total volume" ? "break-words text-lg" : "text-2xl"
              }`}
            >
              {s.value}
            </dd>
          </div>
        ))}
      </dl>
      {audience === "client" && historySaveStatus !== "idle" && (
        <div
          className={cn(
            "rounded-md border px-3 py-2 text-sm",
            historySaveStatus === "error"
              ? "border-destructive/40 text-destructive"
              : "border-border text-muted-foreground",
          )}
          aria-live="polite"
        >
          {historySaveStatus === "saving" && "Saving to Workout History…"}
          {historySaveStatus === "saved" && "Saved to Workout History."}
          {historySaveStatus === "error" && (
            <div className="flex items-center justify-between gap-3">
              <span>Workout History could not be saved.</span>
              <Button type="button" size="sm" variant="outline" onClick={onRetryHistorySave}>
                Retry
              </Button>
            </div>
          )}
        </div>
      )}
      <div className="flex flex-col gap-2">
        <Button onClick={onAgain} variant="outline">
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          {audience === "client" ? "Start again" : "Preview again"}
        </Button>
        <Button onClick={onBack}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {audience === "client" ? "Back to dashboard" : "Back to builder"}
        </Button>
      </div>
    </div>
  );
}
