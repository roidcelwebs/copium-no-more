import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/coach/programs/$programId/workouts/$workoutId")({
  component: WorkoutLayout,
});

function WorkoutLayout() {
  return <Outlet />;
}
