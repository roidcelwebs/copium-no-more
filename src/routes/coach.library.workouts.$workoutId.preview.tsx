import { createFileRoute } from "@tanstack/react-router";
import { WorkoutPreview } from "@/components/coach/WorkoutPreview";

export const Route = createFileRoute("/coach/library/workouts/$workoutId/preview")({
  head: () => ({
    meta: [
      { title: "Preview workout — No More Copium" },
      { name: "description", content: "Preview a universal workout as a coach." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LibraryWorkoutPreviewPage,
});

function LibraryWorkoutPreviewPage() {
  const { workoutId } = Route.useParams();
  return <WorkoutPreview workoutId={workoutId} />;
}
