import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/coach/library/workouts")({
  component: WorkoutLibraryLayout,
});

function WorkoutLibraryLayout() {
  return <Outlet />;
}
