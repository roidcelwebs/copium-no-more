import { emitCloudDataChanged } from "./cloud-events";
import { getCloudCache, persistCloudAppStateField, setCloudCacheField } from "./cloud-cache";


export type WeightUnit = {
  id: string;
  longForm: string;
  shortForm: string;
  increment: number;
  isCustom: boolean;
};

export const CUSTOM_WEIGHT_UNITS_STORAGE_KEY = "no-more-copium:coach-weight-units:v1";
export const DEFAULT_WEIGHT_UNIT_ID = "kg";
export const WEIGHT_UNIT_LONG_FORM_MAX_LENGTH = 40;
export const WEIGHT_UNIT_SHORT_FORM_MAX_LENGTH = 4;

export const BUILT_IN_WEIGHT_UNITS: readonly WeightUnit[] = [
  { id: "kg", longForm: "Kilogram", shortForm: "kg", increment: 2.5, isCustom: false },
  { id: "lbs", longForm: "Pounds", shortForm: "lbs", increment: 5, isCustom: false },
  { id: "plates", longForm: "Plates", shortForm: "P", increment: 1, isCustom: false },
] as const;

function cleanLabel(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function positiveNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

function normalizeCustomWeightUnit(value: unknown): WeightUnit | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (
    typeof raw.id !== "string" ||
    raw.id.length === 0 ||
    typeof raw.longForm !== "string" ||
    typeof raw.shortForm !== "string"
  ) {
    return null;
  }
  const longForm = cleanLabel(raw.longForm);
  const shortForm = cleanLabel(raw.shortForm);
  if (
    longForm.length === 0 ||
    longForm.length > WEIGHT_UNIT_LONG_FORM_MAX_LENGTH ||
    shortForm.length === 0 ||
    shortForm.length > WEIGHT_UNIT_SHORT_FORM_MAX_LENGTH
  ) {
    return null;
  }
  return {
    id: raw.id,
    longForm,
    shortForm,
    increment: positiveNumber(raw.increment) ?? 1,
    isCustom: true,
  };
}

export function loadCustomWeightUnits(): WeightUnit[] {
  if (typeof window === "undefined") return [];
  try {
    const cached = getCloudCache().weightUnits;
    if (!Array.isArray(cached)) return [];
    return cached
      .map(normalizeCustomWeightUnit)
      .filter((unit): unit is WeightUnit => unit !== null);
  } catch {
    return [];
  }
}

export function saveCustomWeightUnits(units: WeightUnit[]): void {
  if (typeof window === "undefined") return;
  try {
    setCloudCacheField("weightUnits", units.filter((unit) => unit.isCustom));
    void persistCloudAppStateField("weight_units");
    emitCloudDataChanged("weight_units");
  } catch {
    // The in-memory editor remains usable when storage is unavailable.
  }
}

export function getAllWeightUnits(customUnits: WeightUnit[]): WeightUnit[] {
  const builtInIds = new Set(BUILT_IN_WEIGHT_UNITS.map((unit) => unit.id));
  return [
    ...BUILT_IN_WEIGHT_UNITS,
    ...customUnits.filter((unit) => unit.isCustom && !builtInIds.has(unit.id)),
  ];
}

export function getWeightUnit(units: readonly WeightUnit[], id: string | undefined): WeightUnit {
  return (
    units.find((unit) => unit.id === id) ??
    BUILT_IN_WEIGHT_UNITS.find((unit) => unit.id === DEFAULT_WEIGHT_UNIT_ID)!
  );
}

export function getWeightIncrement(unitId: string | undefined): number {
  return BUILT_IN_WEIGHT_UNITS.find((unit) => unit.id === unitId)?.increment ?? 1;
}

export function stepWeight(value: number, increment: number, direction: 1 | -1): number {
  const safeValue = Number.isFinite(value) && value >= 0 ? value : 0;
  const safeIncrement = Number.isFinite(increment) && increment > 0 ? increment : 1;
  const next = Math.max(0, safeValue + safeIncrement * direction);
  return Number(next.toFixed(8));
}

export function createCustomWeightUnit(
  longFormRaw: string,
  shortFormRaw: string,
  increment: number,
): WeightUnit {
  const longForm = cleanLabel(longFormRaw);
  const shortForm = cleanLabel(shortFormRaw);
  const unique =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  return {
    id: `custom_unit_${unique}`,
    longForm,
    shortForm,
    increment: positiveNumber(increment) ?? 1,
    isCustom: true,
  };
}
