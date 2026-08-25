import { createFileRoute } from "@tanstack/react-router";
import { ClientWorkoutPrescription } from "@/components/client/ClientWorkoutPrescription";

export const Route = createFileRoute("/client/program/workouts/$workoutId")({
  head: () => ({
    meta: [
      { title: "Assigned Workout — No More Copium" },
      { name: "description", content: "Review an assigned workout prescription." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AssignedWorkoutPage,
});

function AssignedWorkoutPage() {
  const { workoutId } = Route.useParams();
  return <ClientWorkoutPrescription workoutId={workoutId} />;
}
