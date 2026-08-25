import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/client/progress-pictures")({
  component: ProgressPicturesLayout,
});

function ProgressPicturesLayout() {
  return <Outlet />;
}
