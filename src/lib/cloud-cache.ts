import { supabase } from "@/integrations/supabase/client";
import { emitLocalEvent } from "./local-events";
import { supabaseLoose } from "./supabase-loose-client";

/**
 * Cloud cache for coach-authored app state and payment settings.
 *
 * The cloud stores coach content in ONE `app_state` row ('global') with
 * jsonb columns (programs, exercises, workouts, weight_units). The existing
 * local libs expose synchronous readers (loadPrograms(), ...) that components
 * call directly — so we keep a module-level cache those readers return, and
 * write-through to Supabase whenever the local libs save.
 */

export type CloudAppState = {
  programs: unknown[];
  exercises: unknown[];
  workouts: unknown[];
  weightUnits: unknown[];
};

export const CLOUD_STATE_HYDRATED_EVENT = "no-more-copium:cloud-state-hydrated";

const EMPTY_STATE: CloudAppState = { programs: [], exercises: [], workouts: [], weightUnits: [] };

let cache: CloudAppState = { ...EMPTY_STATE };
let hydrated = false;
let hydratePromise: Promise<boolean> | null = null;

export function getCloudCache(): CloudAppState {
  return cache;
}

export function isCloudCacheHydrated(): boolean {
  return hydrated;
}

export function setCloudCacheField<K extends keyof CloudAppState>(
  field: K,
  value: CloudAppState[K],
): void {
  cache = { ...cache, [field]: value };
}

export async function hydrateCloudCache(): Promise<boolean> {
  if (hydratePromise) return hydratePromise;
  hydratePromise = (async () => {
    try {
      // DATA ISOLATION: clients read ONLY their own published program snapshot
      // (coach-published at approval; the RPC returns NULL for coaches, for
      // unapproved clients, or before a bundle exists). The global app_state
      // row is coach-only via RLS. Cache shape stays the same as the old
      // library shape so every existing reader keeps working:
      //   programs: [<the client's single program>]
      const { data: bundleData, error: bundleError } = await supabaseLoose.rpc(
        "get_client_program_bundle",
      );
      const bundle = bundleData as
        | {
            program?: unknown;
            workouts?: unknown;
            exercises?: unknown;
            weight_units?: unknown;
          }
        | null;
      if (!bundleError && bundle && bundle.program) {
        cache = {
          programs: [bundle.program],
          workouts: Array.isArray(bundle.workouts) ? bundle.workouts : [],
          exercises: Array.isArray(bundle.exercises) ? bundle.exercises : [],
          weightUnits: Array.isArray(bundle.weight_units) ? bundle.weight_units : [],
        };
        hydrated = true;
        emitLocalEvent(CLOUD_STATE_HYDRATED_EVENT);
        return true;
      }

      // Coach (or any account without a bundle): read the library row. RLS
      // returns an empty result for non-coaches, so no error path.
      const { data, error } = await supabaseLoose
        .from("app_state")
        .select("programs, exercises, workouts, weight_units")
        .eq("id", "global")
        .maybeSingle();
      if (error) {
        console.error("Cloud state could not be loaded", error);
        return false;
      }
      if (data) {
        cache = {
          programs: Array.isArray(data.programs) ? data.programs : [],
          exercises: Array.isArray(data.exercises) ? data.exercises : [],
          workouts: Array.isArray(data.workouts) ? data.workouts : [],
          weightUnits: Array.isArray(data.weight_units) ? data.weight_units : [],
        };
      }
      hydrated = true;
      emitLocalEvent(CLOUD_STATE_HYDRATED_EVENT);
      return true;
    } catch (error) {
      console.error("Cloud state hydrate failed", error);
      return false;
    } finally {
      // Allow the next call to re-fetch (e.g. after the coach approves a
      // client, the newly published bundle must be picked up).
      hydratePromise = null;
    }
  })();
  return hydratePromise;
}

/** Write-through persist for a single app_state column. */
export async function persistCloudAppStateField(
  field: "programs" | "exercises" | "workouts" | "weight_units",
): Promise<void> {
  try {
    const value = field === "weight_units" ? cache.weightUnits : cache[field];
    const payload = { [field]: value };
    const { error } = await supabaseLoose.from("app_state").update(payload).eq("id", "global");
    if (error) console.error("Cloud app state persist failed", error);
  } catch (error) {
    console.error("Cloud app state persist threw", error);
  }
}

/** Re-hydrate after writes so other devices see the latest. */
export function invalidateCloudCache(): void {
  hydrated = false;
  hydratePromise = null;
}
