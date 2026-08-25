import { createFileRoute } from "@tanstack/react-router";
import { WorkoutPreview } from "@/components/coach/WorkoutPreview";

export const Route = createFileRoute("/coach/programs/$programId/workouts/$workoutId/preview")({
  head: () => ({
    meta: [
      { title: "Preview workout — No More Copium" },
      { name: "description", content: "Preview a workout as a coach." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Preview workout — No More Copium" },
      { property: "og:description", content: "Preview a workout as a coach." },
    ],
  }),
  component: WorkoutPreviewPage,
});

function WorkoutPreviewPage() {
  const { programId, workoutId } = Route.useParams();
  return <WorkoutPreview programId={programId} workoutId={workoutId} />;
}
