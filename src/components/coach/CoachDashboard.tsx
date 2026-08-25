import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Users } from "lucide-react";
import { type AppAccount, fetchAccounts } from "@/lib/cloud-accounts";
import { JoinRequestsSection } from "./JoinRequestsSection";
import { PayoutApprovalsSection } from "./PayoutApprovalsSection";
import { PendingPaymentsSection } from "./PendingPaymentsSection";

export function CoachDashboard() {
  const [clients, setClients] = useState<AppAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAccounts()
      .then((accounts) => setClients(accounts.filter((account) => account.role === "client")))
      .catch((nextError: unknown) => {
        console.error(nextError);
        setError("Local clients could not be loaded.");
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your clients.</p>
      </div>

      <JoinRequestsSection />

      <PendingPaymentsSection />

      <PayoutApprovalsSection />

      <section aria-labelledby="clients-heading" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="clients-heading" className="text-lg font-semibold text-foreground">
            Clients
          </h2>
          {!loading && clients.length > 0 && (
            <span className="text-sm text-muted-foreground">{clients.length}</span>
          )}
        </div>

        {error ? (
          <p className="rounded-lg border border-destructive/40 p-4 text-sm text-destructive">
            {error}
          </p>
        ) : loading ? null : clients.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <Users className="mx-auto h-7 w-7 text-muted-foreground" aria-hidden="true" />
            <h3 className="mt-3 text-sm font-medium text-foreground">No clients yet</h3>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              Local Client accounts created on this device appear here.
            </p>
          </div>
        ) : (
          <ul role="list" className="divide-y divide-border rounded-lg border border-border">
            {clients.map((client) => (
              <li key={client.id}>
                <Link
                  to="/coach/clients/$clientId"
                  params={{ clientId: client.id }}
                  className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  aria-label={`Manage ${client.username}`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-foreground">{client.name}</p>
                      {!client.approvedAt && (
                        <span className="shrink-0 rounded-md border border-[#E50910]/40 bg-[#E50910]/10 px-1.5 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-[#E50910]">
                          Awaiting approval
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">@{client.username}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {client.approvedAt
                        ? client.assignedProgramId
                          ? "Approved · Program assigned"
                          : "Approved · No program assigned"
                        : client.assignedProgramId
                          ? "Unapproved · Program assigned"
                          : "Unapproved · No program assigned"}
                    </p>
                  </div>
                  <ChevronRight
                    className="h-4 w-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
