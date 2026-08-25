import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, LoaderCircle } from "lucide-react";
import { useAccount } from "@/components/account/AccountProvider";
import { Button } from "@/components/ui/button";
import { type ChatMessage, fetchChatMessages, fetchCoachAccount, markChatRead } from "@/lib/chat";
import { LOCAL_CHAT_CHANGED_EVENT } from "@/lib/local-events";
import {
  CLIENT_ONBOARDING_QUESTIONS,
  type ClientOnboardingState,
  answerClientOnboarding,
  initializeClientOnboarding,
} from "@/lib/client-onboarding";
import type { AppAccount } from "@/lib/cloud-accounts";
import { ChatMessageBubble } from "./ChatMessageBubble";
import { useChat } from "./ChatProvider";

export function ClientOnboardingChat({
  account,
  onCompleted,
}: {
  account: AppAccount;
  onCompleted: () => Promise<void>;
}) {
  const { refresh } = useAccount();
  const { refreshUnread } = useChat();
  const [coach, setCoach] = useState<AppAccount | null>(null);
  const [flow, setFlow] = useState<ClientOnboardingState | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(async (threadId: string) => {
    setMessages(await fetchChatMessages(threadId));
  }, []);

  const loadOnboarding = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextFlow, nextCoach] = await Promise.all([
        initializeClientOnboarding(account.id),
        fetchCoachAccount(),
      ]);
      setFlow(nextFlow);
      setCoach(nextCoach);
      await loadMessages(nextFlow.threadId);
      await markChatRead(account.id, account.id);
      await refreshUnread();
      if (nextFlow.completedAt) await onCompleted();
    } catch (nextError) {
      console.error("Client onboarding could not be loaded", nextError);
      setError(
        "Local onboarding could not be loaded because local chat storage is unavailable. Try refreshing and checking device storage.",
      );
    } finally {
      setLoading(false);
    }
  }, [account.id, loadMessages, onCompleted, refreshUnread]);

  useEffect(() => {
    void loadOnboarding();
  }, [loadOnboarding]);

  useEffect(() => {
    if (!flow?.threadId) return;
    const threadId = flow.threadId;
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
  }, [account.id, flow?.threadId, loadMessages, refreshUnread]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  const chooseAnswer = async (answer: string) => {
    if (submitting) return;
    if (!flow) {
      setError("Onboarding is not ready yet. What happened: flow not loaded. Why: local data may still be loading. What to do: wait a moment and try again, or refresh and check device storage.");
      return;
    }
    if (flow.step < 1 || flow.step > 6) {
      setError(`This answer is not expected at step ${flow.step}. What happened: wrong step. Why: onboarding may have already completed or is waiting for payment verification. What to do: refresh or contact the coach.`);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const nextFlow = await answerClientOnboarding(account.id, answer);
      setFlow(nextFlow);
      await loadMessages(nextFlow.threadId);
      await markChatRead(account.id, account.id);
      await refreshUnread();
    } catch (nextError) {
      console.error("Client onboarding answer failed", nextError);
      setError(
        "Your answer could not be saved because local storage is unavailable or full. Check device storage and try again.",
      );
      await loadOnboarding();
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (flow?.step !== 7) return;
    // Awaiting payment verification: when the coach records the payment, the
    // account becomes completed and the client enters the app.
    const checkCompleted = async () => {
      await refresh();
      const { fetchAccount } = await import("@/lib/cloud-accounts");
      const current = await fetchAccount(account.id);
      if (current?.onboardingCompletedAt) {
        await onCompleted();
      }
    };
    void checkCompleted();
    const interval = window.setInterval(() => void checkCompleted(), 4000);
    window.addEventListener("storage", () => void checkCompleted());
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("storage", () => void checkCompleted());
    };
  }, [account.id, flow?.step, onCompleted, refresh]);

  const question =
    flow && flow.step >= 1 && flow.step <= 6
      ? CLIENT_ONBOARDING_QUESTIONS[flow.step as 1 | 2 | 3 | 4 | 5 | 6]
      : null;

  return (
    <main className="flex h-[100dvh] flex-col overflow-hidden bg-background text-foreground">
      <header
        className="shrink-0 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto flex min-h-16 w-full max-w-3xl items-center px-4 py-3">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[1.125rem] font-semibold leading-tight tracking-[-0.01em] text-foreground">
              {coach?.name ?? "Coach"}
            </h1>
            <p className="truncate text-[1rem] leading-5 text-muted-foreground">
              {coach ? `@${coach.username}` : "No More Copium onboarding"}
            </p>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto w-full max-w-3xl space-y-3.5 px-4 py-5" aria-live="polite">
          {loading && messages.length === 0 ? (
            <div className="space-y-3.5">
              <div className="flex justify-start"><div className="h-14 w-3/4 max-w-[78%] rounded-xl bg-muted/60 skeleton-shimmer" /></div>
              <div className="flex justify-end"><div className="h-10 w-1/2 max-w-[78%] rounded-xl bg-muted/60 skeleton-shimmer" /></div>
              <div className="flex justify-start"><div className="h-20 w-4/5 max-w-[78%] rounded-xl bg-muted/60 skeleton-shimmer" /></div>
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
      </div>

      <footer
        className="shrink-0 z-10 border-t border-border bg-background px-4 pt-3 pointer-events-auto"
        style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto w-full max-w-3xl space-y-3">
          {error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-[1rem] leading-5 text-destructive">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="break-words">{error}</p>
                {!flow && (
                  <button
                    type="button"
                    className="mt-2 min-h-9 rounded-lg border border-destructive/30 px-3 py-1.5 text-[1rem] font-medium underline-offset-4 hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
                    onClick={() => void loadOnboarding()}
                  >
                    Try again
                  </button>
                )}
              </div>
            </div>
          )}

          {question && (
            <div className="grid gap-2.5" aria-label={question.prompt}>
              {question.options.map((option) => (
                <Button
                  key={option}
                  type="button"
                  variant="outline"
                  disabled={submitting}
                  className="min-h-12 h-auto touch-manipulation justify-start rounded-xl border-border bg-card px-4 py-3.5 text-left text-[1rem] font-medium leading-6 tracking-[-0.01em] whitespace-normal shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring pointer-events-auto"
                  onClick={() => {
                    console.log("Onboarding option clicked:", option, "flow:", flow);
                    void chooseAnswer(option);
                  }}
                >
                  <span className="min-w-0 flex-1 break-words">{option}</span>
                </Button>
              ))}
            </div>
          )}

          {flow?.step === 7 && !flow.completedAt && (
            <div className="rounded-xl border border-border bg-muted/30 px-4 py-3.5">
              <p className="text-[1rem] font-semibold leading-5 text-foreground">
                Payment verification in progress
              </p>
              <p className="mt-1.5 text-[1rem] leading-5 text-muted-foreground">
                Once your payment is verified, you&apos;ll get instant access to your personalized
                training program.
              </p>
            </div>
          )}
        </div>
      </footer>
    </main>
  );
}
