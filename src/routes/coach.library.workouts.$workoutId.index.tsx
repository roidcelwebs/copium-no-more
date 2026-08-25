import { createFileRoute } from "@tanstack/react-router";
import { WorkoutBuilder } from "@/components/coach/WorkoutBuilder";

export const Route = createFileRoute("/coach/library/workouts/$workoutId/")({
  head: () => ({
    meta: [
      { title: "Workout Builder — No More Copium" },
      { name: "description", content: "Build a universal workout in No More Copium." },
    ],
  }),
  component: LibraryWorkoutBuilderPage,
});

function LibraryWorkoutBuilderPage() {
  const { workoutId } = Route.useParams();
  return <WorkoutBuilder workoutId={workoutId} />;
}
