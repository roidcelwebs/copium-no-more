import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAccount } from "@/components/account/AccountProvider";
import { Toaster } from "@/components/ui/sonner";
import { fetchAccount } from "@/lib/cloud-accounts";
import {
  type ChatMessage,
  type ChatUnreadSummary,
  fetchChatUnreadSummary,
  fetchCoachAccount,
} from "@/lib/chat";
import { LOCAL_CHAT_CHANGED_EVENT } from "@/lib/local-events";

const EMPTY_SUMMARY: ChatUnreadSummary = {
  unreadMessages: 0,
  unreadClientCount: 0,
  byClientId: {},
};

const ChatContext = createContext<{
  summary: ChatUnreadSummary;
  badgeCount: number;
  refreshUnread: () => Promise<void>;
} | null>(null);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { account } = useAccount();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [summary, setSummary] = useState<ChatUnreadSummary>(EMPTY_SUMMARY);

  const refreshUnread = useCallback(async () => {
    setSummary(account ? await fetchChatUnreadSummary(account.id) : EMPTY_SUMMARY);
  }, [account]);

  useEffect(() => {
    void refreshUnread();
    const onChange = (event: Event) => {
      void refreshUnread();
      const message = (event as CustomEvent<ChatMessage | undefined>).detail;
      if (
        !message ||
        !account ||
        pathname === "/onboarding" ||
        message.senderAccountId === account.id ||
        (account.role !== "coach" && account.role !== "client")
      )
        return;
      void showIncomingToast({
        accountRole: account.role,
        senderId: message.senderAccountId,
        body: message.body,
        navigate,
      });
    };
    window.addEventListener(LOCAL_CHAT_CHANGED_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(LOCAL_CHAT_CHANGED_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [account, navigate, pathname, refreshUnread]);

  const value = useMemo(
    () => ({
      summary,
      badgeCount: account?.role === "coach" ? summary.unreadClientCount : summary.unreadMessages,
      refreshUnread,
    }),
    [account?.role, refreshUnread, summary],
  );

  return (
    <ChatContext.Provider value={value}>
      {children}
      <Toaster position="top-center" closeButton richColors />
    </ChatContext.Provider>
  );
}

async function showIncomingToast({
  accountRole,
  senderId,
  body,
  navigate,
}: {
  accountRole: "coach" | "client";
  senderId: string;
  body: string;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const sender = accountRole === "coach" ? await fetchAccount(senderId) : await fetchCoachAccount();
  toast(sender?.name ?? (accountRole === "coach" ? "Client" : "Coach"), {
    description: body.length > 120 ? `${body.slice(0, 117)}…` : body,
    action: {
      label: "Open",
      onClick: () => {
        if (accountRole === "coach") {
          void navigate({ to: "/coach/chat/$clientId", params: { clientId: senderId } });
        } else {
          void navigate({ to: "/client/chat" });
        }
      },
    },
  });
}

// The provider and hook intentionally share this small module.
// eslint-disable-next-line react-refresh/only-export-components
export function useChat() {
  const value = useContext(ChatContext);
  if (!value) throw new Error("useChat must be used inside ChatProvider");
  return value;
}
