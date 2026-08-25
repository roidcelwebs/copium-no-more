import { useCallback, useEffect, useMemo, useState } from "react";
import { BadgeCheck, FileImage, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAccount } from "@/components/account/AccountProvider";
import { type AppAccount, fetchAccounts } from "@/lib/cloud-accounts";
import { getLocalBlob } from "@/lib/local-media";
import { cn } from "@/lib/utils";
import {
  LOCAL_PAYOUTS_CHANGED_EVENT,
  type PayoutRecord,
  decidePayout,
  fetchPayouts,
  formatUsd,
} from "@/lib/payment-system";

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function payoutScreenshotKey(payoutId: string): string {
  return `payout-screenshots/${payoutId}`;
}

function PayoutScreenshotButton({ payoutId }: { payoutId: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    void getLocalBlob(payoutScreenshotKey(payoutId)).then((blob) => {
      if (cancelled || !blob) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [payoutId]);

  if (!url) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted px-2.5 py-1 text-[0.75rem] font-medium text-muted-foreground">
        <FileImage className="h-3.5 w-3.5" aria-hidden="true" />
        No screenshot
      </span>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 text-[0.75rem] font-medium text-primary transition-colors hover:bg-primary/15"
    >
      <FileImage className="h-3.5 w-3.5" aria-hidden="true" />
      View screenshot
    </a>
  );
}

export function PayoutApprovalsSection() {
  const { account } = useAccount();
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [paymentManagers, setPaymentManagers] = useState<AppAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PayoutRecord | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [workingId, setWorkingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [nextPayouts, nextAccounts] = await Promise.all([fetchPayouts(), fetchAccounts()]);
      setPayouts(nextPayouts);
      setPaymentManagers(
        nextAccounts.filter((candidate) => candidate.role === "payment_manager"),
      );
    } catch (nextError) {
      console.error(nextError);
      setError(
        "Payouts could not be loaded because local storage is unavailable. Check device storage and try again.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const onChange = () => void load();
    window.addEventListener(LOCAL_PAYOUTS_CHANGED_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(LOCAL_PAYOUTS_CHANGED_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [load]);

  const pending = useMemo(() => payouts.filter((p) => p.status === "pending"), [payouts]);
  const decided = useMemo(
    () => payouts.filter((p) => p.status !== "pending"),
    [payouts],
  );

  const managerName = (managerId: string) =>
    paymentManagers.find((candidate) => candidate.id === managerId)?.name ?? "Payment Manager";

  const approve = async (payout: PayoutRecord) => {
    if (!account) return;
    setWorkingId(payout.id);
    try {
      await decidePayout(payout.id, "approved", account.id);
      await load();
    } finally {
      setWorkingId(null);
    }
  };

  const confirmReject = async () => {
    if (!account || !rejectTarget) return;
    setWorkingId(rejectTarget.id);
    try {
      await decidePayout(rejectTarget.id, "rejected", account.id, rejectReason);
      setRejectTarget(null);
      setRejectReason("");
      await load();
    } finally {
      setWorkingId(null);
    }
  };

  if (loading) {
    return (
      <section aria-labelledby="payout-approvals-heading" className="space-y-3">
        <div className="h-8 w-48 rounded-lg bg-muted/60 skeleton-shimmer" />
        <div className="h-24 w-full rounded-xl bg-muted/60 skeleton-shimmer" />
      </section>
    );
  }

  if (error) {
    return (
      <section
        aria-labelledby="payout-approvals-heading"
        className="rounded-xl border border-destructive/40 bg-destructive/5 p-4"
      >
        <p className="break-words text-[1rem] leading-5 text-destructive">{error}</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="payout-approvals-heading" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2
          id="payout-approvals-heading"
          className="text-lg font-semibold tracking-tight text-foreground"
        >
          Payout approvals
        </h2>
        {pending.length > 0 && (
          <span className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[0.75rem] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-300">
            {pending.length} pending
          </span>
        )}
      </div>

      {pending.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center">
          <Wallet className="mx-auto h-7 w-7 text-muted-foreground" aria-hidden="true" />
          <h3 className="mt-3 text-[1.125rem] font-medium leading-tight text-foreground">
            No pending payouts
          </h3>
          <p className="mx-auto mt-1.5 max-w-sm text-[1rem] leading-6 text-muted-foreground">
            When the Payment Manager submits a payout, it appears here for your approval.
          </p>
        </div>
      ) : (
        <ol className="space-y-3">
          {pending.map((payout) => (
            <li
              key={payout.id}
              className="rounded-xl border border-amber-500/30 bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[1.125rem] font-semibold leading-tight tracking-tight text-foreground">
                    {formatUsd(payout.amountUsd)}
                  </p>
                  <p className="mt-1 text-[0.875rem] leading-5 text-muted-foreground">
                    {managerName(payout.submittedBy)} · {formatDateTime(payout.submittedAt)}
                  </p>
                  {payout.note && (
                    <p className="mt-1 break-words text-[0.875rem] leading-5 text-muted-foreground">
                      {payout.note}
                    </p>
                  )}
                </div>
                {payout.screenshotId && <PayoutScreenshotButton payoutId={payout.screenshotId} />}
              </div>
              <div className="mt-3.5 grid grid-cols-2 gap-2.5">
                <Button
                  type="button"
                  className="min-h-12 rounded-xl text-[1rem] font-semibold"
                  disabled={workingId === payout.id}
                  onClick={() => void approve(payout)}
                >
                  <BadgeCheck className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  Approve
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-12 rounded-xl text-[1rem] font-semibold text-destructive hover:text-destructive"
                  disabled={workingId === payout.id}
                  onClick={() => {
                    setRejectTarget(payout);
                    setRejectReason("");
                  }}
                >
                  Reject
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}

      {decided.length > 0 && (
        <div className="pt-2">
          <h3 className="text-[1rem] font-semibold tracking-tight text-foreground">
            History
          </h3>
          <ol className="mt-2.5 space-y-2.5">
            {decided.map((payout) => (
              <li
                key={payout.id}
                className="rounded-xl border border-border bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[1rem] font-semibold leading-5 text-foreground">
                      {formatUsd(payout.amountUsd)}
                    </p>
                    <p className="mt-1 text-[0.875rem] leading-5 text-muted-foreground">
                      {managerName(payout.submittedBy)} · {formatDateTime(payout.submittedAt)}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-md border px-2.5 py-1 text-[0.75rem] font-medium uppercase tracking-wide",
                      payout.status === "approved"
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-destructive/40 bg-destructive/10 text-destructive",
                    )}
                  >
                    {payout.status === "approved" ? "Approved" : "Rejected"}
                  </span>
                </div>
                {payout.decidedAt && (
                  <p className="mt-2 text-[0.875rem] leading-5 text-muted-foreground">
                    Decided {formatDateTime(payout.decidedAt)}
                    {payout.rejectionReason ? ` · ${payout.rejectionReason}` : ""}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}

      <AlertDialog
        open={rejectTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRejectTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject this payout?</AlertDialogTitle>
            <AlertDialogDescription>
              The amount will not be subtracted from the developer&apos;s balance. Tell the Payment
              Manager why.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <label
              htmlFor="payout-reject-reason"
              className="text-[0.8125rem] font-medium uppercase tracking-wide text-muted-foreground"
            >
              Reason (optional)
            </label>
            <Input
              id="payout-reject-reason"
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              placeholder="e.g. Wrong network — send again"
              className="min-h-12 rounded-xl text-[1rem]"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11 rounded-xl text-[1rem]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="min-h-11 rounded-xl bg-destructive text-[1rem] text-white hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void confirmReject();
              }}
            >
              Reject payout
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
