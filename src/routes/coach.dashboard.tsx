import { createFileRoute } from "@tanstack/react-router";
import { CoachDashboard } from "@/components/coach/CoachDashboard";

export const Route = createFileRoute("/coach/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — No More Copium" },
      { name: "description", content: "Coach dashboard in No More Copium." },
      { property: "og:title", content: "Dashboard — No More Copium" },
      { property: "og:description", content: "Coach dashboard in No More Copium." },
    ],
  }),
  component: CoachDashboard,
});
