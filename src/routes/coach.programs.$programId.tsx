import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/coach/programs/$programId")({
  component: ProgramLayout,
});

function ProgramLayout() {
  return <Outlet />;
}
