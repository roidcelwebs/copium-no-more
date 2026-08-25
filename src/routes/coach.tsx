import { createFileRoute, redirect } from "@tanstack/react-router";
import { CoachShell } from "@/components/coach/CoachShell";

export const Route = createFileRoute("/coach")({
  beforeLoad: ({ location }) => {
    if (location.pathname === "/coach" || location.pathname === "/coach/") {
      throw redirect({ to: "/coach/dashboard" });
    }
  },
  component: CoachShell,
});
