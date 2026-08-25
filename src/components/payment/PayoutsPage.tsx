import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, FileImage, Send, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAccount } from "@/components/account/AccountProvider";
import { cn } from "@/lib/utils";
import { deleteLocalBlob, putLocalBlob } from "@/lib/local-media";
import {
  LOCAL_PAYMENTS_CHANGED_EVENT,
  LOCAL_PAYOUTS_CHANGED_EVENT,
  type PaymentRecord,
  type PayoutRecord,
  fetchPayments,
  fetchPayouts,
  formatUsd,
  paymentTotals,
  submitPayout,
} from "@/lib/payment-system";

const MAX_PAYOUT_SCREENSHOT_BYTES = 25 * 1024 * 1024;

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

function PayoutScreenshotThumb({ payoutId }: { payoutId: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    void import("@/lib/local-media").then(async ({ getLocalBlob }) => {
      const blob = await getLocalBlob(payoutScreenshotKey(payoutId));
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
        Screenshot
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

export function PayoutsPage() {
  const { account } = useAccount();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [screenshotName, setScreenshotName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [nextPayments, nextPayouts] = await Promise.all([fetchPayments(), fetchPayouts()]);
      setPayments(nextPayments);
      setPayouts(nextPayouts);
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
    window.addEventListener(LOCAL_PAYMENTS_CHANGED_EVENT, onChange);
    window.addEventListener(LOCAL_PAYOUTS_CHANGED_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(LOCAL_PAYMENTS_CHANGED_EVENT, onChange);
      window.removeEventListener(LOCAL_PAYOUTS_CHANGED_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [load]);

  const totals = useMemo(() => paymentTotals(payments, payouts), [payments, payouts]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!account) return;
    setFormError(null);
    setSuccessMessage(null);
    setSubmitting(true);
    const file = fileRef.current?.files?.[0] ?? null;
    let screenshotId: string | undefined;
    try {
      if (file) {
        if (file.size > MAX_PAYOUT_SCREENSHOT_BYTES) {
          throw new Error(
            "That screenshot is too large (over 25 MB). What happened: the file exceeds the size limit. Why: local storage has limited space. What to do: use a smaller screenshot and try again.",
          );
        }
        screenshotId = `payout-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        await putLocalBlob(payoutScreenshotKey(screenshotId), file);
      }
      try {
        await submitPayout({
          amountUsd: Number(amount),
          screenshotId,
          note,
          submittedBy: account.id,
        });
      } catch (submitError) {
        if (screenshotId) {
          await deleteLocalBlob(payoutScreenshotKey(screenshotId)).catch(() => {});
        }
        throw submitError;
      }
      setSuccessMessage(
        "Payout submitted. The coach will review the confirmation and approve it — your balance updates when approved.",
      );
      setAmount("");
      setNote("");
      setScreenshotName(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (nextError) {
      setFormError(
        nextError instanceof Error
          ? nextError.message
          : "Your payout could not be submitted. What happened: submission failed. Why: local storage may be unavailable. What to do: check device storage and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3.5">
        <div className="h-12 w-full rounded-xl bg-muted/60 skeleton-shimmer" />
        <div className="h-24 w-full rounded-xl bg-muted/60 skeleton-shimmer" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4">
        <p className="break-words text-[1rem] leading-5 text-destructive">{error}</p>
        <Button
          type="button"
          variant="outline"
          className="mt-3 min-h-11 rounded-xl text-[1rem]"
          onClick={() => void load()}
        >
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Payouts</h1>
        <p className="mt-1.5 text-[1rem] leading-6 text-muted-foreground">
          Send the developer his share. Submit the amount and a screenshot of the transfer — the
          coach approves it from the Coach Dashboard.
        </p>
      </div>

      {successMessage && (
        <div
          className="flex items-start gap-2 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 text-[1rem] leading-5 text-primary"
          role="status"
        >
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <p className="min-w-0 flex-1 break-words">{successMessage}</p>
        </div>
      )}

      <dl className="grid grid-cols-2 gap-2.5">
        <div className="rounded-xl border border-border bg-card p-4">
          <dt className="text-[0.8125rem] font-medium uppercase tracking-wide text-muted-foreground">
            Owed to developer
          </dt>
          <dd className="mt-1.5 text-[1.375rem] font-semibold leading-tight tracking-tight text-primary">
            {formatUsd(totals.owedUsd)}
          </dd>
        </div>
        <div className="rounded-xl border border-primary/40 bg-primary/5 p-4">
          <dt className="text-[0.8125rem] font-medium uppercase tracking-wide text-muted-foreground">
            Remaining balance
          </dt>
          <dd className="mt-1.5 text-[1.375rem] font-semibold leading-tight tracking-tight text-foreground">
            {formatUsd(totals.remainingUsd)}
          </dd>
        </div>
      </dl>

      <form
        onSubmit={submit}
        className="rounded-xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
      >
        <h2 className="flex items-center gap-2 text-[1.125rem] font-semibold leading-tight tracking-tight text-foreground">
          <Send className="h-5 w-5 text-primary" aria-hidden="true" />
          Make a payout
        </h2>
        <p className="mt-1.5 text-[1rem] leading-6 text-muted-foreground">
          The amount is subtracted from the remaining balance only after the coach approves it.
        </p>
        <div className="mt-4 space-y-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="payout-amount" className="text-[1rem] font-medium leading-5 text-muted-foreground">
              Amount (USD)
            </Label>
            <Input
              id="payout-amount"
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="20.00"
              required
              className="min-h-12 rounded-xl text-[1rem]"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="payout-screenshot" className="text-[1rem] font-medium leading-5 text-muted-foreground">
              Confirmation screenshot
            </Label>
            <div className="flex items-center gap-3">
              <input
                id="payout-screenshot"
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={(event) =>
                  setScreenshotName(event.target.files?.[0]?.name ?? null)
                }
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                className="min-h-12 rounded-xl text-[1rem]"
                onClick={() => fileRef.current?.click()}
              >
                <FileImage className="mr-1.5 h-4 w-4" aria-hidden="true" />
                {screenshotName ? "Change screenshot" : "Choose screenshot"}
              </Button>
              {screenshotName && (
                <span className="min-w-0 flex-1 truncate text-[0.875rem] leading-5 text-muted-foreground">
                  {screenshotName}
                </span>
              )}
            </div>
            <p className="text-[0.8125rem] leading-5 text-muted-foreground">
              Optional, but the coach needs it to verify the transfer.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="payout-note" className="text-[1rem] font-medium leading-5 text-muted-foreground">
              Note
            </Label>
            <Input
              id="payout-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="e.g. Binance Pay transfer for this week (optional)"
              autoComplete="off"
              className="min-h-12 rounded-xl text-[1rem]"
            />
          </div>
          {formError && (
            <div
              className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-[1rem] leading-5 text-destructive"
              role="alert"
            >
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <p className="min-w-0 flex-1 break-words">{formError}</p>
            </div>
          )}
          <Button
            type="submit"
            disabled={submitting}
            className="min-h-12 w-full justify-center rounded-xl text-[1rem] font-semibold"
          >
            <Wallet className="h-5 w-5" aria-hidden="true" />
            {submitting ? "Submitting…" : "Submit payout"}
          </Button>
        </div>
      </form>

      <section aria-labelledby="payouts-list-heading" className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2
            id="payouts-list-heading"
            className="text-[1rem] font-semibold tracking-tight text-foreground"
          >
            Payout history
          </h2>
          <span className="text-[1rem] font-medium text-muted-foreground">
            {payouts.length} total
          </span>
        </div>
        {payouts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center">
            <Wallet className="mx-auto h-7 w-7 text-muted-foreground" aria-hidden="true" />
            <h3 className="mt-3 text-[1.125rem] font-medium leading-tight text-foreground">
              No payouts yet
            </h3>
            <p className="mx-auto mt-1.5 max-w-sm text-[1rem] leading-6 text-muted-foreground">
              Submitted payouts appear here with their status.
            </p>
          </div>
        ) : (
          <ol className="space-y-3">
            {payouts.map((payout) => (
              <li
                key={payout.id}
                className="rounded-xl border border-border bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[1.125rem] font-semibold leading-tight tracking-tight text-foreground">
                      {formatUsd(payout.amountUsd)}
                    </p>
                    <p className="mt-1 text-[0.875rem] leading-5 text-muted-foreground">
                      Submitted {formatDateTime(payout.submittedAt)}
                    </p>
                    {payout.note && (
                      <p className="mt-1 break-words text-[0.875rem] leading-5 text-muted-foreground">
                        {payout.note}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <span
                      className={cn(
                        "rounded-md border px-2.5 py-1 text-[0.75rem] font-medium uppercase tracking-wide",
                        payout.status === "approved" &&
                          "border-primary/40 bg-primary/10 text-primary",
                        payout.status === "pending" &&
                          "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
                        payout.status === "rejected" &&
                          "border-destructive/40 bg-destructive/10 text-destructive",
                      )}
                    >
                      {payout.status === "approved"
                        ? "Approved"
                        : payout.status === "pending"
                          ? "Pending"
                          : "Rejected"}
                    </span>
                    {payout.screenshotId && <PayoutScreenshotThumb payoutId={payout.screenshotId} />}
                  </div>
                </div>
                {payout.status === "approved" && payout.decidedAt && (
                  <p className="mt-2 text-[0.875rem] leading-5 text-muted-foreground">
                    Approved {formatDateTime(payout.decidedAt)}
                  </p>
                )}
                {payout.status === "rejected" && (
                  <p className="mt-2 rounded-lg bg-destructive/5 px-3 py-2 text-[0.875rem] leading-5 text-destructive">
                    Rejected{payout.rejectionReason ? `: ${payout.rejectionReason}` : ""}
                    {payout.decidedAt ? ` · ${formatDateTime(payout.decidedAt)}` : ""}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
