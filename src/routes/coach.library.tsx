import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/coach/library")({
  component: LibraryLayout,
});

function LibraryLayout() {
  return <Outlet />;
}
