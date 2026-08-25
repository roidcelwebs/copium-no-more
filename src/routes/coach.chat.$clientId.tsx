import { createFileRoute } from "@tanstack/react-router";
import { ChatConversation } from "@/components/chat/ChatConversation";

export const Route = createFileRoute("/coach/chat/$clientId")({
  head: () => ({
    meta: [
      { title: "Client Chat — No More Copium" },
      { name: "description", content: "Chat with a Client." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CoachChatConversation,
});

function CoachChatConversation() {
  const { clientId } = Route.useParams();
  return <ChatConversation clientId={clientId} />;
}
