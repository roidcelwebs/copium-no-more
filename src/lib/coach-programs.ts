import { emitCloudDataChanged } from "./cloud-events";
import { getCloudCache, persistCloudAppStateField, setCloudCacheField } from "./cloud-cache";


export type Weekday =
  | "sunday"
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday";

export type DayAssignment = { type: "rest" } | { type: "workout"; workoutId: string };

export type ProgramSummary = {
  id: string;
  name: string;
  shortDescription: string;
  longDescription: string;
  coverImagePath?: string;
  coverUpdatedAt?: string;
  createdAt: string;
  firstDayOfWeek: Weekday;
  dayAssignments: Partial<Record<Weekday, DayAssignment>>;
};

export const PROGRAMS_STORAGE_KEY = "no-more-copium:coach-programs:v1";
export const PROGRAM_NAME_MAX_LENGTH = 80;
export const PROGRAM_SHORT_DESCRIPTION_MAX_LENGTH = 90;
export const PROGRAM_LONG_DESCRIPTION_MAX_LENGTH = 1500;
export const PROGRAM_COVER_WIDTH = 850;
export const PROGRAM_COVER_HEIGHT = 1150;

const WEEKDAYS: Weekday[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

const WEEKDAY_LABELS: Record<Weekday, { full: string; short: string }> = {
  sunday: { full: "Sunday", short: "Sun" },
  monday: { full: "Monday", short: "Mon" },
  tuesday: { full: "Tuesday", short: "Tue" },
  wednesday: { full: "Wednesday", short: "Wed" },
  thursday: { full: "Thursday", short: "Thu" },
  friday: { full: "Friday", short: "Fri" },
  saturday: { full: "Saturday", short: "Sat" },
};

export function isWeekday(value: unknown): value is Weekday {
  return typeof value === "string" && WEEKDAYS.includes(value as Weekday);
}

export function getWeekdayLabel(weekday: Weekday): { full: string; short: string } {
  return WEEKDAY_LABELS[weekday];
}

export function getOrderedWeekdays(firstDayOfWeek: Weekday): Weekday[] {
  const startIndex = WEEKDAYS.indexOf(firstDayOfWeek);
  if (startIndex === -1) return [...WEEKDAYS];
  return [...WEEKDAYS.slice(startIndex), ...WEEKDAYS.slice(0, startIndex)];
}

export function isRestDay(
  assignments: Partial<Record<Weekday, DayAssignment>>,
  weekday: Weekday,
): boolean {
  return assignments[weekday]?.type === "rest";
}

export function getWorkoutAssignment(
  assignments: Partial<Record<Weekday, DayAssignment>>,
  weekday: Weekday,
): string | undefined {
  const assignment = assignments[weekday];
  return assignment?.type === "workout" ? assignment.workoutId : undefined;
}

export function weekdayFromDate(date: Date): Weekday {
  return WEEKDAYS[date.getDay()] ?? "sunday";
}

export function getAssignedWorkoutIds(program: ProgramSummary): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const weekday of getOrderedWeekdays(program.firstDayOfWeek)) {
    const assignment = program.dayAssignments[weekday];
    if (assignment?.type !== "workout" || seen.has(assignment.workoutId)) continue;
    seen.add(assignment.workoutId);
    ids.push(assignment.workoutId);
  }
  return ids;
}

function isValidDayAssignment(value: unknown): value is DayAssignment {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (v.type === "rest") return true;
  return v.type === "workout" && typeof v.workoutId === "string" && v.workoutId.length > 0;
}

function normalizeDayAssignments(value: unknown): Partial<Record<Weekday, DayAssignment>> {
  if (!value || typeof value !== "object") return {};
  const result: Partial<Record<Weekday, DayAssignment>> = {};
  const v = value as Record<string, unknown>;
  for (const key of Object.keys(v)) {
    if (!isWeekday(key)) continue;
    const assignment = v[key];
    if (isValidDayAssignment(assignment)) {
      result[key as Weekday] = assignment;
    }
  }
  return result;
}

function normalizeProgram(value: unknown): ProgramSummary | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;

  if (
    typeof v.id !== "string" ||
    v.id.length === 0 ||
    typeof v.name !== "string" ||
    v.name.length === 0 ||
    typeof v.createdAt !== "string" ||
    v.createdAt.length === 0
  ) {
    return null;
  }

  const firstDayOfWeek = isWeekday(v.firstDayOfWeek) ? v.firstDayOfWeek : "sunday";

  return {
    id: v.id,
    name: v.name,
    shortDescription:
      typeof v.shortDescription === "string"
        ? v.shortDescription.slice(0, PROGRAM_SHORT_DESCRIPTION_MAX_LENGTH)
        : "",
    longDescription:
      typeof v.longDescription === "string"
        ? v.longDescription.slice(0, PROGRAM_LONG_DESCRIPTION_MAX_LENGTH)
        : "",
    coverImagePath:
      typeof v.coverImagePath === "string" && v.coverImagePath.length > 0
        ? v.coverImagePath
        : undefined,
    coverUpdatedAt:
      typeof v.coverUpdatedAt === "string" && v.coverUpdatedAt.length > 0
        ? v.coverUpdatedAt
        : undefined,
    createdAt: v.createdAt,
    firstDayOfWeek,
    dayAssignments: normalizeDayAssignments(v.dayAssignments),
  };
}

export function loadPrograms(): ProgramSummary[] {
  if (typeof window === "undefined") return [];
  try {
    const cached = getCloudCache().programs;
    if (!Array.isArray(cached)) return [];
    return cached.map(normalizeProgram).filter((p): p is ProgramSummary => p !== null);
  } catch {
    return [];
  }
}

export function removeWorkoutFromAssignments(
  programs: ProgramSummary[],
  workoutId: string,
): ProgramSummary[] {
  return programs.map((program) => {
    const nextAssignments = { ...program.dayAssignments };
    let changed = false;
    for (const weekday of WEEKDAYS) {
      const assignment = nextAssignments[weekday];
      if (assignment?.type === "workout" && assignment.workoutId === workoutId) {
        delete nextAssignments[weekday];
        changed = true;
      }
    }
    return changed ? { ...program, dayAssignments: nextAssignments } : program;
  });
}

export function savePrograms(programs: ProgramSummary[]): void {
  if (typeof window === "undefined") return;
  try {
    setCloudCacheField("programs", programs);
    void persistCloudAppStateField("programs");
    emitCloudDataChanged("programs");
  } catch {
    // ignore quota / access errors
  }
}

export function createProgramId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createDefaultProgram(input: {
  name: string;
  shortDescription: string;
  longDescription: string;
}): ProgramSummary {
  return {
    id: createProgramId(),
    name: input.name.trim(),
    shortDescription: input.shortDescription.trim(),
    longDescription: input.longDescription.trim(),
    createdAt: new Date().toISOString(),
    firstDayOfWeek: "sunday",
    dayAssignments: {},
  };
}
