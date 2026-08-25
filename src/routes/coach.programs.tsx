import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/coach/programs")({
  component: ProgramsLayout,
});

function ProgramsLayout() {
  return <Outlet />;
}
