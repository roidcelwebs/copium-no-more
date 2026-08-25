import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { MessageCircle, Play, RotateCcw } from "lucide-react";
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
import { useAccount } from "@/components/account/AccountProvider";
import { ProgressPicturesDashboardSection } from "@/components/client/progress-pictures/ProgressPicturesDashboardSection";
import { useChat } from "@/components/chat/ChatProvider";
import {
  type DayAssignment,
  type ProgramSummary,
  loadPrograms,
  weekdayFromDate,
} from "@/lib/coach-programs";
import { type ProgramWorkout, loadWorkouts } from "@/lib/coach-workouts";
import { getClientGreeting } from "@/lib/client-greeting";
import { useProgressPictureBatches } from "@/hooks/use-progress-picture-batches";
import { LOCAL_WORKOUT_HISTORY_CHANGED_EVENT } from "@/lib/local-events";
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
  const [confirmStep, setConfirmStep] = useState<0 | 1 | 2>(0);
  const progressPictures = useProgressPictureBatches(
    client?.role === "client" ? client.id : undefined,
  );

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
    const onChange = () => loadSessions();
    window.addEventListener(LOCAL_WORKOUT_HISTORY_CHANGED_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(LOCAL_WORKOUT_HISTORY_CHANGED_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [client]);

  const assignedProgram = useMemo(
    () => programs.find((program) => program.id === client?.assignedProgramId),
    [client?.assignedProgramId, programs],
  );
  const weekday = weekdayFromDate(now);
  const assignment: DayAssignment | undefined = assignedProgram?.dayAssignments[weekday];
  const todayWorkout = useMemo(() => {
    if (!assignedProgram || assignment?.type !== "workout") return undefined;
    return workouts.find((workout) => workout.id === assignment.workoutId);
  }, [assignedProgram, assignment, workouts]);

  const todayWorkoutAlreadyDone =
    todayWorkout !== undefined && todayWorkoutIds.includes(todayWorkout.id);

  const reattemptWorkout = () => {
    if (!assignedProgram || !todayWorkout) return;
    void navigate({
      to: "/client/programs/$programId/workouts/$workoutId",
      params: { programId: assignedProgram.id, workoutId: todayWorkout.id },
    });
  };

  if (!hydrated || !client || client.role !== "client") return null;

  return (
    <div className="flex flex-col gap-10">
      {/* Greeting - top-left per spec, timezone-aware via local Date */}
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

      <section aria-labelledby="today-workout-heading" className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2
            id="today-workout-heading"
            className="text-[1rem] font-semibold tracking-[-0.01em] text-foreground"
          >
            Today&apos;s workout
          </h2>
          <span className="text-[1rem] font-medium text-muted-foreground">
            {new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(now)}
          </span>
        </div>

        {todayWorkout && assignedProgram ? (
          <div className="rounded-xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <h3
              className="line-clamp-2 break-words text-[1.375rem] font-semibold leading-[1.2] tracking-[-0.015em] text-card-foreground"
              title={todayWorkout.name}
            >
              {todayWorkout.name}
            </h3>
            {assignedProgram.name && (
              <p className="mt-1.5 line-clamp-1 text-[1rem] leading-5 text-muted-foreground">
                {assignedProgram.name}
              </p>
            )}
            <Button asChild className="mt-5 min-h-12 w-full justify-center rounded-xl text-[1rem] font-semibold sm:w-auto">
              <Link
                to="/client/programs/$programId/workouts/$workoutId"
                params={{ programId: assignedProgram.id, workoutId: todayWorkout.id }}
              >
                <Play className="h-5 w-5" aria-hidden="true" />
                Start workout
              </Link>
            </Button>
          </div>
        ) : (
          <TodayState assignment={assignment} hasAssignedProgram={assignedProgram !== undefined} />
        )}
      </section>

      {todayWorkout && todayWorkoutAlreadyDone && (
        <section
          aria-labelledby="workout-complete-heading"
          className="rounded-xl border border-primary/40 bg-primary/5 p-5"
        >
          <h2
            id="workout-complete-heading"
            className="text-[1.125rem] font-semibold leading-tight tracking-tight text-foreground"
          >
            Workout complete!
          </h2>
          <p className="mt-1.5 text-[1rem] leading-6 text-muted-foreground">
            You finished {todayWorkout.name} today. Want to run it back?
          </p>
          <AlertDialog
            open={confirmStep > 0}
            onOpenChange={(open) => {
              if (!open) setConfirmStep(0);
            }}
          >
            <AlertDialogTrigger asChild>
              <Button className="mt-4 min-h-12 w-full justify-center rounded-xl text-[1rem] font-semibold sm:w-auto">
                <RotateCcw className="h-5 w-5" aria-hidden="true" />
                Do this workout again
              </Button>
            </AlertDialogTrigger>
            {confirmStep === 1 && (
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    You already completed {todayWorkout.name} today. Starting again will begin a
                    fresh session.
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
                    You already did this workout. Finishing it again will add a second entry to
                    your workout history.
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
                      reattemptWorkout();
                    }}
                  >
                    Yes, do it again
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            )}
          </AlertDialog>
        </section>
      )}

      <ProgressPicturesDashboardSection
        clientId={client.id}
        batches={progressPictures.batches}
        loading={progressPictures.loading}
        error={progressPictures.error}
        onRetry={() => void progressPictures.refresh()}
        onUploaded={progressPictures.refresh}
      />
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
    <div className="rounded-xl border border-dashed border-border bg-muted/20 p-6">
      <h3 className="text-[1.125rem] font-semibold leading-tight text-foreground">{title}</h3>
      <p className="mt-1.5 text-[1rem] leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}
