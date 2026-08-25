import { createFileRoute } from "@tanstack/react-router";
import { ClientWorkoutHistory } from "@/components/client/ClientWorkoutHistory";

export const Route = createFileRoute("/client/workout-history")({
  head: () => ({
    meta: [
      { title: "Workout History — No More Copium" },
      { name: "description", content: "Review completed workouts in No More Copium." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ClientWorkoutHistory,
});
