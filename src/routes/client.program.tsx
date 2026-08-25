import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/client/program")({
  component: ClientProgramLayout,
});

function ClientProgramLayout() {
  return <Outlet />;
}
