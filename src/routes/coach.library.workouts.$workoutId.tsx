import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/coach/library/workouts/$workoutId")({
  component: LibraryWorkoutLayout,
});

function LibraryWorkoutLayout() {
  return <Outlet />;
}
