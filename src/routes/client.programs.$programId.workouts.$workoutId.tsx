import { createFileRoute } from "@tanstack/react-router";
import { WorkoutPreview } from "@/components/coach/WorkoutPreview";

export const Route = createFileRoute("/client/programs/$programId/workouts/$workoutId")({
  head: () => ({
    meta: [
      { title: "Workout — No More Copium" },
      { name: "description", content: "Complete today’s workout in No More Copium." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ClientWorkoutPage,
});

function ClientWorkoutPage() {
  const { programId, workoutId } = Route.useParams();
  return <WorkoutPreview programId={programId} workoutId={workoutId} audience="client" />;
}
