import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, ChevronUp, Dumbbell, ImageIcon } from "lucide-react";
import { useAccount } from "@/components/account/AccountProvider";
import { useProgramCoverUrls } from "@/hooks/use-program-cover-urls";
import {
  type DayAssignment,
  type ProgramSummary,
  type Weekday,
  getAssignedWorkoutIds,
  getOrderedWeekdays,
  getWeekdayLabel,
  loadPrograms,
} from "@/lib/coach-programs";
import { type ProgramWorkout, loadWorkouts } from "@/lib/coach-workouts";
import { cn } from "@/lib/utils";

export function YourProgramPage() {
  const { account } = useAccount();
  const [programs, setPrograms] = useState<ProgramSummary[]>([]);
  const [workouts, setWorkouts] = useState<ProgramWorkout[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const profileRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const load = () => {
      setPrograms(loadPrograms());
      setWorkouts(loadWorkouts());
      setLoading(false);
    };
    load();
    window.addEventListener("no-more-copium:cloud-cache-refreshed", load);
    return () => window.removeEventListener("no-more-copium:cloud-cache-refreshed", load);
  }, []);

  const program = programs.find((candidate) => candidate.id === account?.assignedProgramId);
  const covers = useProgramCoverUrls(program ? [program] : []);
  const workoutsById = useMemo(() => {
    const map = new Map<string, ProgramWorkout>();
    for (const workout of workouts) {
      map.set(workout.id, workout);
    }
    return map;
  }, [workouts]);

  if (loading) {
    return (
      <section className="space-y-6" aria-busy="true">
        <div className="h-6 w-32 rounded bg-muted animate-pulse" />
        <div className="flex gap-4">
          <div className="aspect-[17/23] w-28 rounded-lg bg-muted animate-pulse sm:w-32" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-3/4 rounded bg-muted animate-pulse" />
            <div className="h-4 w-full rounded bg-muted animate-pulse" />
            <div className="h-4 w-2/3 rounded bg-muted animate-pulse" />
          </div>
        </div>
      </section>
    );
  }

  if (!program) {
    return (
      <section className="space-y-6 text-left">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Your Program</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your assigned training program will appear here.
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card/60 p-8 text-center">
          <h2 className="text-base font-medium text-foreground">No program assigned</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your coach has not assigned a program to this account yet.
          </p>
        </div>
      </section>
    );
  }

  const assignedIds = getAssignedWorkoutIds(program);
  const assignedWorkouts = assignedIds
    .map((workoutId) => workoutsById.get(workoutId))
    .filter((workout): workout is ProgramWorkout => workout !== undefined);
  const coverUrl = covers.urls[program.id];

  const toggleProfile = () => {
    setExpanded((current) => !current);
    window.requestAnimationFrame(() => {
      profileRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  return (
    <section className="space-y-8 text-left">
      <section ref={profileRef} aria-labelledby="your-program-title" className="scroll-mt-20">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Your Program
        </p>
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {expanded ? (
            <div className="p-4">
              <div className="flex items-start gap-4">
                <div className="flex aspect-[17/23] w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/30 sm:w-32">
                  {coverUrl ? (
                    <img
                      src={coverUrl}
                      alt="Program cover"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="h-7 w-7 text-muted-foreground" aria-hidden="true" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h1
                    id="your-program-title"
                    className="overflow-hidden text-xl font-semibold leading-tight text-card-foreground [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]"
                  >
                    {program.name}
                  </h1>
                  <p className="mt-2 overflow-hidden text-sm leading-5 text-muted-foreground [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:4]">
                    {program.shortDescription ||
                      "Your coach has not added a short description yet."}
                  </p>
                </div>
              </div>
              <div className="mt-4 border-t border-border pt-4">
                <h2 className="text-sm font-semibold text-foreground">About this program</h2>
                <p className="mt-2 whitespace-pre-line text-sm leading-6 text-muted-foreground">
                  {program.longDescription || "Your coach has not added a long description yet."}
                </p>
              </div>
            </div>
          ) : (
            <div className="px-4 py-3">
              <h1
                id="your-program-title"
                className="truncate text-lg font-semibold text-foreground"
              >
                {program.name}
              </h1>
            </div>
          )}
          <button
            type="button"
            onClick={toggleProfile}
            aria-expanded={expanded}
            aria-controls="your-program-profile-body"
            className="flex min-h-11 w-full items-center justify-between border-t border-border bg-muted/40 px-4 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            <span>{expanded ? "Collapse program details" : "View program details"}</span>
            {expanded ? (
              <ChevronUp className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </section>

      {/* Weekly Schedule */}
      <section aria-labelledby="weekly-schedule-heading" className="space-y-3">
        <div>
          <h2 id="weekly-schedule-heading" className="text-lg font-semibold text-foreground">
            Weekly Schedule
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your coach&apos;s workout and rest-day assignments.
          </p>
        </div>
        <div role="list" aria-label="Weekly schedule" className="grid grid-cols-7 gap-1.5">
          {getOrderedWeekdays(program.firstDayOfWeek).map((weekday) => (
            <ReadOnlyDay
              key={weekday}
              weekday={weekday}
              assignment={program.dayAssignments[weekday]}
              workoutsById={workoutsById}
            />
          ))}
        </div>
      </section>

      {/* Assigned Workouts List */}
      <section aria-labelledby="assigned-workouts-heading" className="space-y-3">
        <div>
          <h2 id="assigned-workouts-heading" className="text-lg font-semibold text-foreground">
            Assigned Workouts
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Review the workouts currently prescribed in your weekly schedule.
          </p>
        </div>
        {assignedWorkouts.length === 0 ? (
          <div className="rounded-xl border border-border bg-card/60 p-6 text-center">
            <p className="text-sm text-muted-foreground">
              No workouts are currently assigned to a day.
            </p>
          </div>
        ) : (
          <ul role="list" className="overflow-hidden rounded-xl border border-border bg-card">
            {assignedWorkouts.map((workout) => (
              <li key={workout.id} className="border-b border-border last:border-b-0">
                <Link
                  to="/client/program/workouts/$workoutId"
                  params={{ workoutId: workout.id }}
                  className="flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Dumbbell className="h-4 w-4" />
                    </div>
                    <span className="min-w-0 truncate text-sm font-medium text-foreground">
                      {workout.name}
                    </span>
                  </div>
                  <ChevronRight
                    className="h-4 w-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}

function ReadOnlyDay({
  weekday,
  assignment,
  workoutsById,
}: {
  weekday: Weekday;
  assignment: DayAssignment | undefined;
  workoutsById: Map<string, ProgramWorkout>;
}) {
  const label = getWeekdayLabel(weekday);
  const workoutIds = getAssignedWorkoutIds(assignment);
  const assignedWorkouts = workoutIds
    .map((id) => workoutsById.get(id))
    .filter((w): w is ProgramWorkout => w !== undefined);
  const isRest = assignment?.type === "rest";
  const assigned = assignment !== undefined;

  return (
    <div
      role="listitem"
      className={cn(
        "flex h-24 min-w-0 flex-col items-center justify-between overflow-hidden rounded-lg border px-1 py-2 text-center",
        assigned ? "border-primary/50 bg-primary/10" : "border-border bg-card",
      )}
      aria-label={`${label.full}: ${isRest ? "Rest day" : assignedWorkouts.map((w) => w.name).join(", ") || (assignment ? "Workout unavailable" : "No assignment")}`}
    >
      <span className="text-xs font-medium text-foreground">{label.short}</span>
      {isRest ? (
        <span className="text-xs font-medium text-muted-foreground">Rest</span>
      ) : assignedWorkouts.length === 1 ? (
        <span className="flex min-w-0 flex-col items-center gap-0.5">
          <Dumbbell className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
          <span className="max-w-full truncate text-[9px] leading-tight font-medium text-foreground">
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
        <span className="text-[9px] leading-tight text-muted-foreground">None</span>
      )}
      <div className="h-1" />
    </div>
  );
}
