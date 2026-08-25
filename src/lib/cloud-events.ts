export type CloudDataField = "programs" | "exercises" | "workouts" | "weight_units";

export const CLOUD_DATA_CHANGED_EVENT = "no-more-copium:local-coach-data-changed";

export function emitCloudDataChanged(field: CloudDataField): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<CloudDataField>(CLOUD_DATA_CHANGED_EVENT, { detail: field }),
  );
}
