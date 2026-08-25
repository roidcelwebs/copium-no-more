import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/coach/exercises")({
  beforeLoad: () => {
    throw redirect({ to: "/coach/library/exercises" });
  },
});
