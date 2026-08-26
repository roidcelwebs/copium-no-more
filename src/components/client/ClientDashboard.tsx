import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, Dumbbell, MessageCircle, Play, RotateCcw } from "lucide-react";
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
} from "@/components/ui/alert-dialog";
import { useAccount } from "@/components/account/AccountProvider";
import { ProgressPicturesDashboardSection } from "@/components/client/progress-pictures/ProgressPicturesDashboardSection";
import { StreakBrokenModal } from "@/components/client/progress-pictures/StreakBrokenModal";
import { checkBrokenStreak } from "@/lib/progress-pictures";
import { useChat } from "@/components/chat/ChatProvider";
import {
  type DayAssignment,
  type ProgramSummary,
  getAssignedWorkoutIds,
  loadPrograms,
  weekdayFromDate,
} from "@/lib/coach-programs";
import { type ProgramWorkout, loadWorkouts } from "@/lib/coach-workouts";
import { getClientGreeting } from "@/lib/client-greeting";
import { useProgressPictureBatches } from "@/hooks/use-progress-picture-batches";
import { fetchWorkoutSessions } from "@/lib/workout-history";

export function ClientDashboard() {
  const { account: client, refresh } = useAccount();
  const { summary: chatSummary } = useChat();
  const navigate = useNavigate();
  const [programs, setPrograms] = useState<ProgramSummary[]>([]);
  const [workouts, setWorkouts] = useState<ProgramWorkout[]>([]);
  const [now, setNow] = useState(() => new Date());
  const [hydrated, setHydrated] = useState(false);
  const [todayWorkoutIds, setTodayWorkoutIds] = useState<string[]>([]);
  const [reattemptWorkoutTarget, setReattemptWorkoutTarget] = useState<ProgramWorkout | null>(null);
  const [confirmStep, setConfirmStep] = useState<0 | 1 | 2>(0);
  const [resolvedStreakEventId, setResolvedStreakEventId] = useState<string | null>(null);

  const progressPictures = useProgressPictureBatches(
    client?.role === "client" ? client.id : undefined,
  );

  const brokenStreakInfo = useMemo(() => {
    if (!client || client.role !== "client") {
      return { isBroken: false, previousStreak: 0, eventId: "" };
    }
    return checkBrokenStreak(progressPictures.batches, client.id, now);
  }, [client, progressPictures.batches, now]);

  useEffect(() => {
    const loadCachedCoachData = () => {
      setPrograms(loadPrograms());
      setWorkouts(loadWorkouts());
    };

    void refresh();
    loadCachedCoachData();
    setNow(new Date());
    setHydrated(true);

    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    window.addEventListener("no-more-copium:cloud-cache-refreshed", loadCachedCoachData);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("no-more-copium:cloud-cache-refreshed", loadCachedCoachData);
    };
  }, [refresh]);

  useEffect(() => {
    if (!client || client.role !== "client") return;
    const loadSessions = () => {
      void fetchWorkoutSessions(client.id).then((sessions) => {
        const todayKey = localDateKey(new Date());
        setTodayWorkoutIds(
          sessions
            .filter((session) => localDateKey(new Date(session.completedAt)) === todayKey)
            .map((session) => session.workoutId),
        );
      });
    };
    loadSessions();
    window.addEventListener("no-more-copium:workout-sessions-updated", loadSessions);
    return () => {
      window.removeEventListener("no-more-copium:workout-sessions-updated", loadSessions);
    };
  }, [client]);

  const assignedProgram = useMemo(() => {
    if (!client?.assignedProgramId) return undefined;
    return programs.find((program) => program.id === client.assignedProgramId);
  }, [client?.assignedProgramId, programs]);

  const weekday = weekdayFromDate(now);
  const assignment: DayAssignment | undefined = assignedProgram?.dayAssignments[weekday];

  const assignedWorkoutIds = useMemo(() => {
    return getAssignedWorkoutIds(assignment);
  }, [assignment]);

  const todayWorkouts = useMemo(() => {
    if (!assignedProgram || assignedWorkoutIds.length === 0) return [];
    return assignedWorkoutIds
      .map((id) => workouts.find((workout) => workout.id === id))
      .filter((workout): workout is ProgramWorkout => workout !== undefined);
  }, [assignedProgram, assignedWorkoutIds, workouts]);

  const handleReattempt = (workout: ProgramWorkout) => {
    setReattemptWorkoutTarget(workout);
    setConfirmStep(1);
  };

  const executeReattempt = () => {
    if (!assignedProgram || !reattemptWorkoutTarget) return;
    void navigate({
      to: "/client/programs/$programId/workouts/$workoutId",
      params: { programId: assignedProgram.id, workoutId: reattemptWorkoutTarget.id },
    });
  };

  if (!hydrated || !client || client.role !== "client") return null;

  return (
    <div className="flex flex-col gap-10">
      {/* Greeting */}
      <div className="space-y-1">
        <h1 className="text-left text-[clamp(1.75rem,6vw,2.25rem)] font-semibold leading-[1.1] tracking-[-0.02em] text-foreground">
          {getClientGreeting(client.name, now)}
        </h1>
        <p className="text-left text-[1rem] leading-6 text-muted-foreground">
          Here is what is lined up for you today.
        </p>
      </div>

      {chatSummary.unreadMessages > 0 && (
        <Link
          to="/client/chat"
          className="flex min-h-12 items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-[1rem] font-medium text-foreground transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1 text-left leading-5">
            You have {chatSummary.unreadMessages} unread message
            {chatSummary.unreadMessages === 1 ? "" : "s"} from your coach
          </span>
        </Link>
      )}

      {/* Today's Workout(s) Section */}
      <section aria-labelledby="today-workout-heading" className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2
            id="today-workout-heading"
            className="text-[1rem] font-semibold tracking-[-0.01em] text-foreground"
          >
            {todayWorkouts.length > 1 ? "Today's workouts" : "Today's workout"}
          </h2>
          <span className="text-[1rem] font-medium text-muted-foreground">
            {new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(now)}
          </span>
        </div>

        {todayWorkouts.length > 0 && assignedProgram ? (
          <div className="space-y-3">
            {todayWorkouts.map((workout, index) => {
              const alreadyDone = todayWorkoutIds.includes(workout.id);
              return (
                <div
                  key={workout.id}
                  className="rounded-xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] text-left"
                >
                  <div className="flex items-center justify-between gap-2">
                    {todayWorkouts.length > 1 && (
                      <span className="text-xs font-bold uppercase tracking-wider text-primary">
                        Workout {index + 1} of {todayWorkouts.length}
                      </span>
                    )}
                    {alreadyDone && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400 ml-auto">
                        <CheckCircle2 className="h-3 w-3" />
                        Completed
                      </span>
                    )}
                  </div>

                  <h3
                    className="mt-1 line-clamp-2 break-words text-[1.375rem] font-semibold leading-[1.2] tracking-[-0.015em] text-card-foreground"
                    title={workout.name}
                  >
                    {workout.name}
                  </h3>
                  {assignedProgram.name && (
                    <p className="mt-1 line-clamp-1 text-[1rem] leading-5 text-muted-foreground">
                      {assignedProgram.name}
                    </p>
                  )}

                  <div className="mt-5 flex flex-wrap items-center gap-2.5">
                    {alreadyDone ? (
                      <Button
                        type="button"
                        onClick={() => handleReattempt(workout)}
                        variant="outline"
                        className="min-h-12 w-full justify-center rounded-xl text-[1rem] font-semibold sm:w-auto"
                      >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Do this workout again
                      </Button>
                    ) : (
                      <Button
                        asChild
                        className="min-h-12 w-full justify-center rounded-xl text-[1rem] font-semibold sm:w-auto"
                      >
                        <Link
                          to="/client/programs/$programId/workouts/$workoutId"
                          params={{ programId: assignedProgram.id, workoutId: workout.id }}
                        >
                          <Play className="h-5 w-5 mr-1.5" aria-hidden="true" />
                          Start workout
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <TodayState assignment={assignment} hasAssignedProgram={assignedProgram !== undefined} />
        )}
      </section>

      {/* Confirmation Dialogs for Re-attempting */}
      <AlertDialog
        open={confirmStep > 0}
        onOpenChange={(open) => {
          if (!open) setConfirmStep(0);
        }}
      >
        {confirmStep === 1 && (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                You already completed {reattemptWorkoutTarget?.name} today. Starting again will
                begin a fresh session.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="min-h-11 rounded-xl text-[1rem]">
                Not now
              </AlertDialogCancel>
              <AlertDialogAction
                className="min-h-11 rounded-xl text-[1rem]"
                onClick={(event) => {
                  event.preventDefault();
                  setConfirmStep(2);
                }}
              >
                Yes, redo it
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
        {confirmStep === 2 && (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you really sure?</AlertDialogTitle>
              <AlertDialogDescription>
                You already did this workout. Finishing it again will add a second entry to your
                workout history.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="min-h-11 rounded-xl text-[1rem]">
                Go back
              </AlertDialogCancel>
              <AlertDialogAction
                className="min-h-11 rounded-xl text-[1rem]"
                onClick={(event) => {
                  event.preventDefault();
                  setConfirmStep(0);
                  executeReattempt();
                }}
              >
                Yes, do it again
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>

      <ProgressPicturesDashboardSection
        clientId={client.id}
        batches={progressPictures.batches}
        loading={progressPictures.loading}
        error={progressPictures.error}
        onRetry={() => void progressPictures.refresh()}
        onUploaded={progressPictures.refresh}
      />

      {brokenStreakInfo.isBroken && resolvedStreakEventId !== brokenStreakInfo.eventId && client && (
        <StreakBrokenModal
          clientId={client.id}
          brokenInfo={brokenStreakInfo}
          onResolved={() => {
            setResolvedStreakEventId(brokenStreakInfo.eventId);
            void progressPictures.refresh();
          }}
        />
      )}
    </div>
  );
}

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function TodayState({
  assignment,
  hasAssignedProgram,
}: {
  assignment: DayAssignment | undefined;
  hasAssignedProgram: boolean;
}) {
  let title = "No program assigned";
  let description = "Your coach has not assigned a training program yet.";

  if (hasAssignedProgram && assignment?.type === "rest") {
    title = "Rest day";
    description = "No workout is scheduled for today. Take the recovery — you earned it.";
  } else if (hasAssignedProgram && assignment?.type === "workout") {
    title = "Workout unavailable";
    description = "The workout assigned for today could not be found. Your coach may have updated the program.";
  } else if (hasAssignedProgram) {
    title = "No workout scheduled";
    description = "Your program does not have a workout assigned for today.";
  }

  return (
    <div className="rounded-xl border border-border bg-card/60 p-6 shadow-sm text-left">
      <h3 className="text-[1.125rem] font-semibold leading-tight text-foreground">{title}</h3>
      <p className="mt-1.5 text-[1rem] leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}
