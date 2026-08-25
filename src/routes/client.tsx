import { createFileRoute, redirect } from "@tanstack/react-router";
import { ClientShell } from "@/components/client/ClientShell";

export const Route = createFileRoute("/client")({
  beforeLoad: ({ location }) => {
    if (location.pathname === "/client" || location.pathname === "/client/") {
      throw redirect({ to: "/client/dashboard" });
    }
  },
  component: ClientShell,
});
