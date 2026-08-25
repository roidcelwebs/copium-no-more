import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertCircle, ChevronRight, MessageCircle, RotateCw } from "lucide-react";
import { useAccount } from "@/components/account/AccountProvider";
import { Button } from "@/components/ui/button";
import { type CoachChatConversation, fetchCoachChatInbox } from "@/lib/chat";
import { LOCAL_ACCOUNTS_CHANGED_EVENT, LOCAL_CHAT_CHANGED_EVENT } from "@/lib/local-events";
import { cn } from "@/lib/utils";
import { useChat } from "./ChatProvider";

export function CoachChatInbox({ showHeader = true }: { showHeader?: boolean }) {
  const { account } = useAccount();
  const { refreshUnread } = useChat();
  const [conversations, setConversations] = useState<CoachChatConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (account?.role !== "coach") return;
    setError(null);
    try {
      setConversations(await fetchCoachChatInbox(account.id));
      await refreshUnread();
    } catch (nextError) {
      console.error(nextError);
      setError("Local chats could not be loaded because local storage is unavailable. Check device storage and try again.");
    } finally {
      setLoading(false);
    }
  }, [account, refreshUnread]);

  useEffect(() => {
    void load();
    if (account?.role !== "coach") return;
    const onChange = () => void load();
    window.addEventListener(LOCAL_CHAT_CHANGED_EVENT, onChange);
    window.addEventListener(LOCAL_ACCOUNTS_CHANGED_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(LOCAL_CHAT_CHANGED_EVENT, onChange);
      window.removeEventListener(LOCAL_ACCOUNTS_CHANGED_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [account, load]);

  if (account?.role !== "coach") return null;

  return (
    <section className="space-y-6">
      {showHeader && (
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Chats</h1>
          <p className="mt-1 text-[1rem] leading-6 text-muted-foreground">
            Read and reply to messages from your clients.
          </p>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          <div className="h-20 w-full rounded-xl bg-muted/60 skeleton-shimmer" />
          <div className="h-20 w-full rounded-xl bg-muted/60 skeleton-shimmer" />
          <div className="h-20 w-full rounded-xl bg-muted/60 skeleton-shimmer" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4">
          <p className="flex items-start gap-2 text-[1rem] leading-6 text-destructive">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1">{error}</span>
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-3 min-h-10 rounded-xl"
            onClick={() => void load()}
          >
            <RotateCw className="h-4 w-4" aria-hidden="true" />
            Try again
          </Button>
        </div>
      ) : conversations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <MessageCircle className="mx-auto h-7 w-7 text-muted-foreground" aria-hidden="true" />
          <h2 className="mt-3 text-[1.125rem] font-medium leading-tight text-foreground">No clients yet</h2>
          <p className="mt-1.5 text-[1rem] leading-6 text-muted-foreground">
            Client conversations will appear here automatically.
          </p>
        </div>
      ) : (
        <ul role="list" className="overflow-hidden rounded-xl border border-border">
          {conversations.map((conversation) => {
            const unread = conversation.unreadMessages > 0;
            return (
              <li key={conversation.client.id} className="border-b border-border last:border-b-0">
                <Link
                  to="/coach/chat/$clientId"
                  params={{ clientId: conversation.client.id }}
                  className={cn(
                    "flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                    unread && "bg-primary/10",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p
                        className={cn("truncate text-[1rem] leading-6", unread ? "font-semibold" : "font-medium")}
                      >
                        {conversation.client.name}
                      </p>
                      {unread && (
                        <span className="inline-flex min-h-5 min-w-5 items-center justify-center rounded-md bg-destructive px-1.5 py-0.5 text-[0.75rem] font-bold leading-none text-destructive-foreground">
                          {conversation.unreadMessages > 99 ? "99+" : conversation.unreadMessages}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-[1rem] leading-5 text-muted-foreground">
                      @{conversation.client.username}
                    </p>
                    <p
                      className={cn(
                        "mt-1 truncate text-[1rem] leading-5",
                        unread ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {conversation.lastMessageBody
                        ? `${conversation.lastMessageSenderId === account.id ? "You: " : ""}${conversation.lastMessageBody}`
                        : "No messages yet"}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                    {conversation.lastMessageAt && (
                      <p className="text-[0.8125rem] leading-4 text-muted-foreground">
                        {formatInboxTime(conversation.lastMessageAt)}
                      </p>
                    )}
                    <ChevronRight
                      className="h-5 w-5 text-muted-foreground"
                      aria-hidden="true"
                    />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function formatInboxTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  return date.toDateString() === today.toDateString()
    ? new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date)
    : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}
