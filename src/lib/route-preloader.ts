/**
 * Route preloader for eliminating bottom-nav delay.
 * After dashboard finishes loading, preloads every other page the user can click
 * in order of priority, so navigation feels instant.
 * Uses TanStack Router preloadRoute with staggered timeouts to avoid blocking main thread.
 * No overflow — only preloads route code, not user data (user data is cached separately via static-cache and localStorage reads).
 */

type RouterLike = {
  preloadRoute: (opts: { to: string; params?: Record<string, string> }) => Promise<unknown>;
};

const COACH_ROUTES_PRIORITY = [
  "/coach/dashboard",
  "/coach/programs",
  "/coach/library",
  "/coach/library/exercises",
  "/coach/library/workouts",
  "/coach/chat",
  "/coach/clients/$clientId",
] as const;

const CLIENT_ROUTES_PRIORITY = [
  "/client/dashboard",
  "/client/program",
  "/client/workout-history",
  "/client/chat",
  "/client/progress-pictures",
] as const;

let preloaded = false;

export async function preloadCoachRoutes(router: RouterLike) {
  if (preloaded) return;
  preloaded = true;

  for (const to of COACH_ROUTES_PRIORITY.slice(0, 2)) {
    try {
      await router.preloadRoute({ to });
    } catch {}
    await sleep(120);
  }

  for (const to of COACH_ROUTES_PRIORITY.slice(2, 5)) {
    try {
      await router.preloadRoute({ to });
    } catch {}
    await sleep(80);
  }

  for (const to of COACH_ROUTES_PRIORITY.slice(5)) {
    try {
      await router.preloadRoute({ to });
    } catch {}
    await sleep(80);
  }

  try {
    const { loadPrograms } = await import("@/lib/coach-programs");
    loadPrograms();
  } catch {}
  await sleep(50);
  try {
    const { loadExercises } = await import("@/lib/coach-exercises");
    const { loadWorkouts } = await import("@/lib/coach-workouts");
    loadExercises();
    loadWorkouts();
  } catch {}
  await sleep(50);
  try {
    const { fetchAccounts } = await import("@/lib/cloud-accounts");
    await fetchAccounts();
  } catch {}
}

export async function preloadClientRoutes(router: RouterLike) {
  if (preloaded) return;
  preloaded = true;

  for (const to of CLIENT_ROUTES_PRIORITY) {
    try {
      await router.preloadRoute({ to });
    } catch {}
    await sleep(100);
  }

  try {
    const { loadPrograms } = await import("@/lib/coach-programs");
    loadPrograms();
  } catch {}
}

export function resetPreload() {
  preloaded = false;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export async function warmStaticCache() {
  try {
    const { cacheStaticUI } = await import("./static-cache");
    cacheStaticUI();
  } catch {}
}
