import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/coach/chat")({
  component: CoachChatLayout,
});

function CoachChatLayout() {
  return <Outlet />;
}
