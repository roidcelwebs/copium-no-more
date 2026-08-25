import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Clock } from "lucide-react";
import type { AppAccount } from "@/lib/cloud-accounts";
import { fetchAccount } from "@/lib/cloud-accounts";
import { appendOnboardingGreeting } from "@/lib/chat";
import { hydrateCloudCache, invalidateCloudCache } from "@/lib/cloud-cache";
import { LOCAL_CHAT_CHANGED_EVENT, emitLocalEvent } from "@/lib/local-events";
import { ChatConversation } from "./ChatConversation";
import { useChat } from "./ChatProvider";

/**
 * Manual onboarding screen: a live free-text chat with the Coach plus a
 * "waiting for approval" banner. Exactly one server-side greeting is seeded
 * (idempotent); everything after that is a normal texting app for both sides.
 * When the coach approves the client, this screen routes to the dashboard.
 */
export function ClientOnboardingScreen({ account }: { account: AppAccount }) {
  const navigate = useNavigate();
  const { refreshUnread } = useChat();
  const seededRef = useRef(false);
  const [seedError, setSeedError] = useState<string | null>(null);

  // Seed the single server-side greeting exactly once per mount.
  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    void appendOnboardingGreeting(account.id)
      .then(() => {
        emitLocalEvent(LOCAL_CHAT_CHANGED_EVENT);
        return refreshUnread().catch(() => undefined);
      })
      .catch((error: unknown) => {
        console.error("Onboarding greeting could not be seeded", error);
        setSeedError("Your welcome message could not be loaded. You can still text your coach.");
      });
  }, [account.id, refreshUnread]);

  // Watch for approval: when approved_at is set, enter the app.
  useEffect(() => {
    let cancelled = false;
    const checkApproval = async () => {
      try {
        const current = await fetchAccount(account.id);
        if (!cancelled && current?.approvedAt) {
          // Pick up the coach-published program snapshot before entering the
          // app so the dashboard renders the client's program immediately.
          invalidateCloudCache();
          await hydrateCloudCache().catch(() => undefined);
          void navigate({ to: "/client/dashboard", replace: true });
        }
      } catch {
        // transient network errors are ignored; the next poll retries
      }
    };
    void checkApproval();
    const interval = window.setInterval(() => void checkApproval(), 4000);
    const onStorage = () => void checkApproval();
    window.addEventListener("storage", onStorage);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("storage", onStorage);
    };
  }, [account.id, navigate]);

  return (
    <main className="flex h-[100dvh] flex-col overflow-hidden bg-background text-foreground">
      <div
        className="shrink-0 border-b border-border bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/75"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.5rem)" }}
      >
        <div className="mx-auto w-full max-w-3xl">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[1rem] font-semibold leading-5 text-foreground">
              Welcome, {account.name}.
            </p>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[#E50910]/40 bg-[#E50910]/10 px-2.5 py-1 text-[0.75rem] font-medium text-[#E50910]">
              <Clock className="h-4 w-4" aria-hidden="true" />
              Waiting for approval
            </span>
          </div>
          <p className="mt-1 text-[1rem] leading-5 text-muted-foreground">
            Text your coach freely here. Your program unlocks once they approve.
          </p>
          {seedError && (
            <p className="mt-1.5 text-[1rem] leading-5 text-destructive" role="alert">
              {seedError}
            </p>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4">
          <ChatConversation clientId={account.id} hideBack />
        </div>
      </div>
    </main>
  );
}
