import { createFileRoute } from "@tanstack/react-router";
import { WorkoutBuilder } from "@/components/coach/WorkoutBuilder";

export const Route = createFileRoute("/coach/programs/$programId/workouts/$workoutId/")({
  head: () => ({
    meta: [
      { title: "Workout Builder — No More Copium" },
      { name: "description", content: "Build a workout in No More Copium." },
      { property: "og:title", content: "Workout Builder — No More Copium" },
      { property: "og:description", content: "Build a workout in No More Copium." },
    ],
  }),
  component: WorkoutBuilderPage,
});

function WorkoutBuilderPage() {
  const { programId, workoutId } = Route.useParams();
  return <WorkoutBuilder programId={programId} workoutId={workoutId} />;
}
