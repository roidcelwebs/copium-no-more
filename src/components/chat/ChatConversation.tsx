import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertCircle, ArrowLeft, LoaderCircle, Send } from "lucide-react";
import { useAccount } from "@/components/account/AccountProvider";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  MAX_CHAT_MESSAGE_LENGTH,
  type ChatMessage,
  createChatMessageId,
  ensureChatThread,
  fetchChatMessages,
  fetchCoachAccount,
  markChatRead,
  sendChatMessage,
} from "@/lib/chat";
import { approveClientWithProgram } from "@/lib/access-codes";
import { fetchAccount, type AppAccount } from "@/lib/cloud-accounts";
import { LOCAL_CHAT_CHANGED_EVENT } from "@/lib/local-events";
import {
  LOCAL_JOIN_REQUESTS_CHANGED_EVENT,
  approveJoinRequest,
  fetchJoinRequest,
} from "@/lib/local-join-requests";
import { ChatImageUploadDialog } from "./ChatImageUploadDialog";
import { ChatMessageBubble } from "./ChatMessageBubble";
import { useChat } from "./ChatProvider";

export function ChatConversation({
  clientId,
  hideBack = false,
}: {
  clientId: string;
  hideBack?: boolean;
}) {
  const { account } = useAccount();
  const { refreshUnread } = useChat();
  const [peer, setPeer] = useState<AppAccount | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approvingCloud, setApprovingCloud] = useState(false);
  const [joinRequestPending, setJoinRequestPending] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(async (id: string) => {
    const next = await fetchChatMessages(id);
    setMessages(next);
  }, []);

  useEffect(() => {
    if (!account) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      ensureChatThread(clientId),
      account.role === "coach" ? fetchAccount(clientId) : fetchCoachAccount(),
    ])
      .then(async ([nextThreadId, nextPeer]) => {
        if (cancelled) return;
        setThreadId(nextThreadId);
        setPeer(nextPeer);
        await loadMessages(nextThreadId);
        await markChatRead(account.id, clientId);
        if (account.role === "coach") {
          const request = await fetchJoinRequest(clientId);
          setJoinRequestPending(request?.status === "pending");
        }
        await refreshUnread();
      })
      .catch((nextError: unknown) => {
        console.error(nextError);
        if (!cancelled) setError("This local conversation could not be loaded. The local chat store may be unavailable. Try refreshing and checking device storage.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [account, clientId, loadMessages, refreshUnread]);

  useEffect(() => {
    if (!threadId || !account) return;
    const onChatChanged = () => {
      void loadMessages(threadId);
      void refreshUnread().catch(console.error);
    };
    window.addEventListener(LOCAL_CHAT_CHANGED_EVENT, onChatChanged);
    window.addEventListener("storage", onChatChanged);
    return () => {
      window.removeEventListener(LOCAL_CHAT_CHANGED_EVENT, onChatChanged);
      window.removeEventListener("storage", onChatChanged);
    };
  }, [account, clientId, loadMessages, refreshUnread, threadId]);

  useEffect(() => {
    if (account?.role !== "coach") return;
    const refreshRequest = async () => {
      const request = await fetchJoinRequest(clientId);
      setJoinRequestPending(request?.status === "pending");
    };
    window.addEventListener(LOCAL_JOIN_REQUESTS_CHANGED_EVENT, refreshRequest);
    window.addEventListener("storage", refreshRequest);
    return () => {
      window.removeEventListener(LOCAL_JOIN_REQUESTS_CHANGED_EVENT, refreshRequest);
      window.removeEventListener("storage", refreshRequest);
    };
  }, [account?.role, clientId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  if (!account) return null;

  const send = async () => {
    const body = draft.trim();
    if (!body || !threadId || sending) return;
    const messageId = createChatMessageId();
    setSending(true);
    setError(null);
    try {
      await sendChatMessage({
        senderAccountId: account.id,
        clientId,
        body,
        messageId,
      });
      setDraft("");
      await loadMessages(threadId);
    } catch (nextError) {
      console.error(nextError);
      setError("Your message could not be sent because local storage is unavailable or full. Check device storage and try again.");
    } finally {
      setSending(false);
    }
  };

  const approveCloud = async () => {
    if (account.role !== "coach" || !peer || approvingCloud || !peer.assignedProgramId) return;
    if (!window.confirm("Approve this client and unlock full access?")) return;
    setApprovingCloud(true);
    setApprovalError(null);
    try {
      await approveClientWithProgram(peer.id);
      setPeer({ ...peer, approvedAt: new Date().toISOString() });
    } catch (nextError) {
      console.error(nextError);
      setApprovalError(
        nextError instanceof Error
          ? nextError.message
          : "The client could not be approved.",
      );
    } finally {
      setApprovingCloud(false);
    }
  };

  const approve = async () => {
    if (account.role !== "coach" || !joinRequestPending || approving) return;
    if (!window.confirm("Approve this Client and unlock the app?")) return;
    setApproving(true);
    setError(null);
    try {
      await approveJoinRequest({ clientId, coachId: account.id });
      setJoinRequestPending(false);
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "The Join Request could not be approved. Local data may be unavailable.",
      );
    } finally {
      setApproving(false);
    }
  };

  const backTo = account.role === "coach" ? "/coach/chat" : "/client/dashboard";

  return (
    <section className="flex min-h-[calc(100dvh-11rem)] flex-col">
      <div className="flex items-center gap-3 border-b border-border pb-3">
        {!hideBack && (
          <Button asChild variant="ghost" size="icon" className="min-h-11 min-w-11 shrink-0 rounded-xl">
            <Link
              to={backTo}
              aria-label={account.role === "coach" ? "Back to chats" : "Back to Dashboard"}
            >
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            </Link>
          </Button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[1.125rem] font-semibold leading-tight tracking-[-0.01em] text-foreground">
            {peer?.name ?? (account.role === "coach" ? "Client" : "Coach")}
          </h1>
          {peer && <p className="truncate text-[1rem] leading-5 text-muted-foreground">@{peer.username}</p>}
        </div>
      </div>

      {account.role === "coach" && peer && !peer.approvedAt && (
        <div className="mt-4 space-y-3 rounded-xl border border-[#E50910]/40 bg-[#E50910]/5 p-4">
          <div className="min-w-0 flex-1">
            <p className="text-[1rem] font-semibold leading-5 text-foreground">
              Awaiting approval
            </p>
            <p className="mt-1 text-[1rem] leading-5 text-muted-foreground">
              {peer.assignedProgramId
                ? "Approve to give this client full access to their program, workout history, progress pictures, and chat."
                : "Assign a training program on the client page first, then approve them here."}
            </p>
          </div>
          {approvalError && (
            <p className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-[1rem] leading-5 text-destructive" role="alert">
              {approvalError}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            {!peer.assignedProgramId && (
              <Button asChild variant="outline" className="min-h-11 rounded-xl text-[1rem] font-semibold">
                <Link to="/coach/clients/$clientId" params={{ clientId: peer.id }}>
                  Assign a program
                </Link>
              </Button>
            )}
            <Button
              type="button"
              disabled={approvingCloud || !peer.assignedProgramId}
              onClick={() => void approveCloud()}
              className="min-h-11 rounded-xl text-[1rem] font-semibold"
            >
              {approvingCloud ? "Approving…" : "Approve client"}
            </Button>
          </div>
        </div>
      )}

      {account.role === "coach" && joinRequestPending && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <div className="min-w-0 flex-1">
            <p className="text-[1rem] font-semibold leading-5 text-foreground">Pending Join Request</p>
            <p className="mt-1 text-[1rem] leading-5 text-muted-foreground">
              Review the complete onboarding conversation and submitted images before approving.
            </p>
          </div>
          <Button type="button" disabled={approving} onClick={() => void approve()} className="min-h-11 rounded-xl">
            {approving ? "Approving…" : "Approve Client"}
          </Button>
        </div>
      )}

      <div className="flex-1 space-y-3.5 py-5" aria-live="polite">
        {loading ? (
          <div className="space-y-3.5">
            <div className="flex justify-start"><div className="h-14 w-3/4 max-w-[78%] rounded-xl bg-muted/60 skeleton-shimmer" /></div>
            <div className="flex justify-end"><div className="h-10 w-1/2 max-w-[78%] rounded-xl bg-muted/60 skeleton-shimmer" /></div>
            <div className="flex justify-start"><div className="h-20 w-4/5 max-w-[78%] rounded-xl bg-muted/60 skeleton-shimmer" /></div>
            <div className="flex justify-end"><div className="h-12 w-2/3 max-w-[78%] rounded-xl bg-muted/60 skeleton-shimmer" /></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center">
            <p className="text-[1.125rem] font-medium leading-tight text-foreground">No messages yet</p>
            <p className="mt-1.5 text-[1rem] leading-6 text-muted-foreground">
              Send the first message to start the conversation.
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <ChatMessageBubble
              key={message.id}
              message={message}
              own={message.senderAccountId === account.id}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {error && (
        <p className="mb-3 flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-[1rem] leading-5 text-destructive">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1">{error}</span>
        </p>
      )}

      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] rounded-xl border border-border bg-background p-2.5 shadow-sm">
        <div className="flex items-end gap-2">
          {account.role === "client" && (
            <ChatImageUploadDialog
              clientId={clientId}
              senderAccountId={account.id}
              iconOnly
              onSent={async () => {
                if (threadId) await loadMessages(threadId);
                await refreshUnread();
              }}
            />
          )}
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
            placeholder="Write a message"
            rows={1}
            maxLength={MAX_CHAT_MESSAGE_LENGTH}
            disabled={loading || sending || !threadId}
            className="min-h-12 resize-none rounded-xl py-3 text-[1rem] leading-6"
            aria-label="Message"
          />
          <Button
            type="button"
            size="icon"
            disabled={!draft.trim() || loading || sending || !threadId}
            onClick={() => void send()}
            aria-label="Send message"
            className="min-h-12 min-w-12 shrink-0 rounded-xl"
          >
            {sending ? (
              <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="h-5 w-5" aria-hidden="true" />
            )}
          </Button>
        </div>
        <p className="mt-1.5 px-1 text-right text-[0.875rem] leading-4 text-muted-foreground">
          {draft.length}/{MAX_CHAT_MESSAGE_LENGTH}
        </p>
      </div>
    </section>
  );
}
