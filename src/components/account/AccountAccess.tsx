import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ShieldCheck,
  User,
  Plus,
  RotateCcw,
  CreditCard,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { type AppAccount } from "@/lib/cloud-accounts";
import { useAccount } from "./AccountProvider";

function enterRouteFor(account: AppAccount): string {
  if (account.role === "coach") return "/coach/dashboard";
  if (account.role === "payment_manager") return "/payment/dashboard";
  if (account.approvedAt) return "/client/dashboard";
  return "/onboarding";
}

export function AccountAccess() {
  const navigate = useNavigate();
  const { account, accounts, login, createLocalClient, resetToDefaults } = useAccount();

  const [creatingClient, setCreatingClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSelectAccount = (acc: AppAccount) => {
    login(acc);
    void navigate({ to: enterRouteFor(acc) as never });
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName.trim()) return;
    setBusy(true);
    try {
      const created = await createLocalClient(newClientName.trim());
      setCreatingClient(false);
      setNewClientName("");
      void navigate({ to: enterRouteFor(created) as never });
    } finally {
      setBusy(false);
    }
  };

  const coachAccount = accounts.find((a) => a.role === "coach") ?? {
    id: "coach-hal",
    name: "Hal",
    username: "coach",
    role: "coach" as const,
    isPreview: true,
    onboardingStep: 0,
    approvedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  const clientAccounts = accounts.filter((a) => a.role === "client");
  const paymentAccount = accounts.find((a) => a.role === "payment_manager");

  return (
    <div className="space-y-6 text-left">
      {/* Badge Banner */}
      <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 p-3.5">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
            Local Prototype Mode
          </Badge>
          <span className="text-[0.8125rem] text-muted-foreground">Zero cloud dependencies</span>
        </div>
        {account && (
          <span className="text-[0.75rem] font-medium text-white/60">
            Active: <strong className="text-white">{account.name}</strong> ({account.role})
          </span>
        )}
      </div>

      {/* 1. Coach Mode Section */}
      <div className="space-y-2">
        <Label className="text-[0.75rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Coach Workspace
        </Label>
        <Button
          type="button"
          onClick={() => handleSelectAccount(coachAccount)}
          className="min-h-12 w-full justify-between rounded-xl bg-primary px-4 text-[1rem] font-semibold text-primary-foreground hover:bg-primary/90 active:scale-[0.98]"
        >
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-5 w-5 text-white" aria-hidden="true" />
            <span>Enter as Coach ({coachAccount.name})</span>
          </div>
          <span className="text-xs uppercase tracking-wider text-white/80">Open Dashboard →</span>
        </Button>
      </div>

      {/* 2. Client Accounts Section */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <Label className="text-[0.75rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Client Accounts (1-Tap Switch)
          </Label>
          <button
            type="button"
            onClick={() => setCreatingClient((prev) => !prev)}
            className="flex items-center gap-1 text-[0.8125rem] font-medium text-primary hover:underline"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add client</span>
          </button>
        </div>

        {/* Inline Create Client Form */}
        {creatingClient && (
          <form
            onSubmit={(e) => void handleCreateClient(e)}
            className="space-y-3 rounded-xl border border-border bg-card p-3.5"
          >
            <div className="space-y-1.5">
              <Label htmlFor="new-client-name" className="text-xs">
                Client Name
              </Label>
              <Input
                id="new-client-name"
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                placeholder="e.g. Alex"
                autoFocus
                required
                className="rounded-lg"
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setCreatingClient(false)}
                className="rounded-lg text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={busy || !newClientName.trim()}
                className="rounded-lg text-xs font-semibold"
              >
                {busy ? "Creating..." : "Create & Enter"}
              </Button>
            </div>
          </form>
        )}

        {/* Clients List */}
        <div className="grid gap-2">
          {clientAccounts.map((c) => {
            const isApproved = !!c.approvedAt;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => handleSelectAccount(c)}
                className="flex min-h-12 w-full items-center justify-between rounded-xl border border-border bg-card px-4 py-2.5 text-left transition-colors hover:border-primary/50 hover:bg-muted/40 active:scale-[0.99]"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[0.9375rem] font-medium text-foreground">
                      {c.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">@{c.username}</p>
                  </div>
                </div>

                {isApproved ? (
                  <Badge
                    variant="secondary"
                    className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[0.6875rem]"
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    Dashboard
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="gap-1 border-amber-500/30 bg-amber-500/10 text-amber-400 text-[0.6875rem]"
                  >
                    <Clock className="h-3 w-3" />
                    Onboarding
                  </Badge>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Payment Manager Section */}
      {paymentAccount && (
        <div className="space-y-2">
          <Label className="text-[0.75rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Payment Manager Mode
          </Label>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleSelectAccount(paymentAccount)}
            className="min-h-11 w-full justify-between rounded-xl border-border px-4 text-[0.9375rem] font-medium hover:bg-muted/40"
          >
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <span>Enter as Payment Manager ({paymentAccount.name})</span>
            </div>
            <span className="text-xs text-muted-foreground">/payment/dashboard</span>
          </Button>
        </div>
      )}

      {/* 4. Prototype Reset Controls */}
      <div className="pt-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={resetToDefaults}
          className="w-full justify-center text-xs text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
          Reset sample data to defaults
        </Button>
      </div>
    </div>
  );
}
