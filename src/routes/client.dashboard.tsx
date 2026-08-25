import { createFileRoute } from "@tanstack/react-router";
import { ClientDashboard } from "@/components/client/ClientDashboard";

export const Route = createFileRoute("/client/dashboard")({
  head: () => ({
    meta: [
      { title: "Client Dashboard — No More Copium" },
      { name: "description", content: "Your workout dashboard in No More Copium." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ClientDashboard,
});
