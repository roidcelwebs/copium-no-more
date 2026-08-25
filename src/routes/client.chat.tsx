import { createFileRoute } from "@tanstack/react-router";
import { useAccount } from "@/components/account/AccountProvider";
import { ChatConversation } from "@/components/chat/ChatConversation";

export const Route = createFileRoute("/client/chat")({
  head: () => ({
    meta: [
      { title: "Coach Chat — No More Copium" },
      { name: "description", content: "Chat with your Coach." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ClientChatConversation,
});

function ClientChatConversation() {
  const { account } = useAccount();
  if (!account || account.role !== "client") return null;
  return <ChatConversation clientId={account.id} />;
}
