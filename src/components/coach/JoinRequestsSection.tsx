import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, ChevronRight, ImageIcon, UserCheck } from "lucide-react";
import { useAccount } from "@/components/account/AccountProvider";
import { type AppAccount, fetchAccount } from "@/lib/cloud-accounts";
import {
  LOCAL_JOIN_REQUESTS_CHANGED_EVENT,
  type LocalJoinRequest,
  approveJoinRequest,
  fetchPendingJoinRequests,
} from "@/lib/local-join-requests";
import { Button } from "@/components/ui/button";

export function JoinRequestsSection() {
  const { account } = useAccount();
  const [requests, setRequests] = useState<
    Array<{ request: LocalJoinRequest; client: AppAccount }>
  >([]);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const pending = await fetchPendingJoinRequests();
    const hydrated = await Promise.all(
      pending.map(async (request) => ({ request, client: await fetchAccount(request.clientId) })),
    );
    setRequests(
      hydrated.filter((entry): entry is { request: LocalJoinRequest; client: AppAccount } =>
        Boolean(entry.client),
      ),
    );
  }, []);

  useEffect(() => {
    void load();
    const onChange = () => void load();
    window.addEventListener(LOCAL_JOIN_REQUESTS_CHANGED_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(LOCAL_JOIN_REQUESTS_CHANGED_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [load]);

  const approve = async (clientId: string, clientName: string) => {
    if (!account || account.role !== "coach") return;
    if (!window.confirm(`Approve ${clientName} and unlock the app? This will allow them to log in as a normal client.`)) return;
    setApprovingId(clientId);
    try {
      await approveJoinRequest({ clientId, coachId: account.id });
      await load();
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "Could not approve. Try again and check device storage.");
    } finally {
      setApprovingId(null);
    }
  };

  return (
    <section aria-labelledby="join-requests-heading" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 id="join-requests-heading" className="text-lg font-semibold tracking-tight text-foreground">
            Join Requests
          </h2>
          <p className="mt-1 text-[1rem] leading-5 text-muted-foreground">
            Review Clients who finished onboarding and submitted images. Approve to unlock client experience.
          </p>
        </div>
        {requests.length > 0 && (
          <span className="inline-flex min-h-6 min-w-6 items-center justify-center rounded-md bg-destructive px-2 py-1 text-[0.75rem] font-bold leading-none text-destructive-foreground">
            {requests.length}
          </span>
        )}
      </div>

      {requests.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center">
          <UserCheck className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden="true" />
          <p className="mt-2 text-[1rem] leading-5 text-muted-foreground">No pending join requests.</p>
        </div>
      ) : (
        <ul className="overflow-hidden rounded-xl border border-border">
          {requests.map(({ request, client }) => (
            <li key={client.id} className="border-b border-border last:border-b-0">
              <div className="flex items-center justify-between gap-3 p-3">
                <Link
                  to="/coach/chat/$clientId"
                  params={{ clientId: client.id }}
                  className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[1rem] font-semibold leading-5 text-foreground">{client.name}</p>
                    <p className="truncate text-[1rem] leading-5 text-muted-foreground">@{client.username}</p>
                    <p className="mt-1 flex items-center gap-1 text-[0.875rem] leading-4 text-muted-foreground">
                      <ImageIcon className="h-4 w-4" aria-hidden="true" />
                      {request.imageCount} image{request.imageCount === 1 ? "" : "s"} · {formatRequestTime(request.requestedAt)}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                </Link>
                <Button
                  type="button"
                  size="sm"
                  disabled={approvingId === client.id}
                  onClick={() => void approve(client.id, client.name)}
                  className="min-h-10 shrink-0 rounded-lg px-3 text-[0.875rem] font-semibold"
                  aria-label={`Approve ${client.name}`}
                >
                  <Check className="h-4 w-4" aria-hidden="true" />
                  {approvingId === client.id ? "Approving..." : "Approve"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatRequestTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Pending";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
