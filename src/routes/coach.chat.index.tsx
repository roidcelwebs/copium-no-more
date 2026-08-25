import { createFileRoute } from "@tanstack/react-router";
import { CoachMessagingPage } from "@/components/chat/CoachMessagingPage";

export const Route = createFileRoute("/coach/chat/")({
  head: () => ({
    meta: [
      { title: "Messaging — No More Copium" },
      { name: "description", content: "Client conversations and Coach messaging tools." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CoachMessagingPage,
});
