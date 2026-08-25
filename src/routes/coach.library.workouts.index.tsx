import { createFileRoute } from "@tanstack/react-router";
import { WorkoutLibrary } from "@/components/coach/WorkoutLibrary";

export const Route = createFileRoute("/coach/library/workouts/")({
  head: () => ({
    meta: [
      { title: "Workout Library — No More Copium" },
      { name: "description", content: "Universal workout templates in No More Copium." },
    ],
  }),
  component: WorkoutLibrary,
});
