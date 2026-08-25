import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, BadgeDollarSign, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAccount } from "@/components/account/AccountProvider";
import { cn } from "@/lib/utils";
import {
  LOCAL_PAYMENTS_CHANGED_EVENT,
  PAYMENT_AMOUNT_USD,
  type PaymentStartedRecord,
  fetchPaymentStartedRecords,
  recordPayment,
} from "@/lib/payment-system";

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function PendingPaymentsSection() {
  const { account } = useAccount();
  const [claims, setClaims] = useState<PaymentStartedRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState("");
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setClaims(await fetchPaymentStartedRecords());
    } catch (nextError) {
      console.error(nextError);
      setError(
        "Pending payments could not be loaded because local storage is unavailable. Check device storage and try again.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const onChange = () => void load();
    window.addEventListener(LOCAL_PAYMENTS_CHANGED_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(LOCAL_PAYMENTS_CHANGED_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [load]);

  const verify = async (claim: PaymentStartedRecord) => {
    if (!account) return;
    setWorkingId(claim.id);
    setFormError(null);
    setSuccessMessage(null);
    try {
      await recordPayment({
        clientUsername: claim.clientUsername,
        amountUsd: PAYMENT_AMOUNT_USD,
        note: transactionId.trim() || undefined,
        recordedBy: account.id,
      });
      setSuccessMessage(
        `Payment verified for ${claim.clientName} — client access is now unlocked.`,
      );
      setTransactionId("");
      setExpandedId(null);
      await load();
    } catch (nextError) {
      setFormError(
        nextError instanceof Error
          ? nextError.message
          : "The payment could not be recorded. What happened: verification failed. Why: local storage may be unavailable. What to do: check device storage and try again.",
      );
    } finally {
      setWorkingId(null);
    }
  };

  return (
    <section aria-labelledby="pending-payments-heading" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2
          id="pending-payments-heading"
          className="text-lg font-semibold tracking-tight text-foreground"
        >
          Pending payments
        </h2>
        {!loading && claims.length > 0 && (
          <span className="rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 text-[0.75rem] font-medium uppercase tracking-wide text-primary">
            {claims.length} pending
          </span>
        )}
      </div>

      {successMessage && (
        <div
          className="rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 text-[1rem] leading-5 text-primary"
          role="status"
        >
          {successMessage}
        </div>
      )}

      {error ? (
        <p className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-[1rem] leading-5 text-destructive">
          {error}
        </p>
      ) : loading ? (
        <div className="h-24 w-full rounded-xl bg-muted/60 skeleton-shimmer" />
      ) : claims.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center">
          <BadgeDollarSign className="mx-auto h-7 w-7 text-muted-foreground" aria-hidden="true" />
          <h3 className="mt-3 text-[1.125rem] font-medium leading-tight text-foreground">
            No pending payments
          </h3>
          <p className="mx-auto mt-1.5 max-w-sm text-[1rem] leading-6 text-muted-foreground">
            When a client starts a payment from onboarding, it appears here for you to verify and
            unlock.
          </p>
        </div>
      ) : (
        <ol className="space-y-3">
          {claims.map((claim) => {
            const expanded = claim.id === expandedId;
            return (
              <li
                key={claim.id}
                className="rounded-xl border border-border bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
              >
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : claim.id)}
                  aria-expanded={expanded}
                  className="flex w-full items-start justify-between gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[1rem] font-semibold leading-5 text-foreground">
                      {claim.clientName}
                    </span>
                    <span className="mt-0.5 block truncate text-[0.875rem] leading-5 text-muted-foreground">
                      @{claim.clientUsername} · {claim.method === "card" ? "Card" : "PayPal"} ·{" "}
                      {formatDateTime(claim.startedAt)}
                    </span>
                  </span>
                  {expanded ? (
                    <ChevronUp className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  )}
                </button>

                {expanded && (
                  <div className="mt-3.5 space-y-3 border-t border-border pt-3.5">
                    <div className="space-y-1.5">
                      <Label
                        htmlFor={`tx-${claim.id}`}
                        className="text-[1rem] font-medium leading-5 text-muted-foreground"
                      >
                        Provider transaction ID
                      </Label>
                      <Input
                        id={`tx-${claim.id}`}
                        value={transactionId}
                        onChange={(event) => setTransactionId(event.target.value)}
                        placeholder="e.g. pi_3ABC... (from Stripe/PayPal dashboard)"
                        autoComplete="off"
                        className="min-h-12 rounded-xl text-[1rem]"
                      />
                      <p className="text-[0.8125rem] leading-5 text-muted-foreground">
                        Confirm the {claim.method === "card" ? "Stripe" : "PayPal"} payment for $
                        {PAYMENT_AMOUNT_USD} from this client in your partner&apos;s dashboard, then
                        unlock.
                      </p>
                    </div>
                    {formError && (
                      <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-[1rem] leading-5 text-destructive">
                        {formError}
                      </p>
                    )}
                    <Button
                      type="button"
                      className={cn("min-h-12 w-full justify-center rounded-xl text-[1rem] font-semibold")}
                      disabled={workingId === claim.id}
                      onClick={() => void verify(claim)}
                    >
                      <BadgeCheck className="mr-1.5 h-5 w-5" aria-hidden="true" />
                      {workingId === claim.id ? "Verifying…" : "Verify & unlock"}
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
