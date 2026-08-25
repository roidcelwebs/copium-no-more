import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, BadgeDollarSign, CheckCircle2, Plus, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAccount } from "@/components/account/AccountProvider";
import { type AppAccount, fetchAccounts } from "@/lib/cloud-accounts";
import { cn } from "@/lib/utils";
import {
  LOCAL_PAYMENTS_CHANGED_EVENT,
  LOCAL_PAYOUTS_CHANGED_EVENT,
  PAYMENT_AMOUNT_USD,
  type PaymentRecord,
  type PayoutRecord,
  fetchPayments,
  fetchPayouts,
  formatUsd,
  paymentTotals,
  recordPayment,
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

export function PaymentDashboard() {
  const { account } = useAccount();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [clients, setClients] = useState<AppAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [username, setUsername] = useState("");
  const [amount, setAmount] = useState(String(PAYMENT_AMOUNT_USD));
  const [note, setNote] = useState("");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [nextPayments, nextPayouts, nextAccounts] = await Promise.all([
        fetchPayments(),
        fetchPayouts(),
        fetchAccounts(),
      ]);
      setPayments(nextPayments);
      setPayouts(nextPayouts);
      setClients(nextAccounts.filter((candidate) => candidate.role === "client"));
    } catch (nextError) {
      console.error(nextError);
      setError(
        "Payments could not be loaded because local storage is unavailable. Check device storage and try again.",
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

  const totalsFinal = useMemo(() => paymentTotals(payments, payouts), [payments, payouts]);

  const submitPayment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!account) return;
    setFormError(null);
    setSuccessMessage(null);
    setSubmitting(true);
    try {
      const parsedAmount = Number(amount);
      const record = await recordPayment({
        clientUsername: username,
        amountUsd: Number.isFinite(parsedAmount) ? parsedAmount : PAYMENT_AMOUNT_USD,
        note,
        recordedBy: account.id,
      });
      setSuccessMessage(
        `Payment recorded for ${record.clientName} (${record.tag === "new_user" ? "New user" : "Membership"}). Client access is now unlocked.`,
      );
      setUsername("");
      setAmount(String(PAYMENT_AMOUNT_USD));
      setNote("");
    } catch (nextError) {
      setFormError(nextError instanceof Error ? nextError.message : "Could not record the payment.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3.5">
        <div className="h-12 w-full rounded-xl bg-muted/60 skeleton-shimmer" />
        <div className="h-24 w-full rounded-xl bg-muted/60 skeleton-shimmer" />
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
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Payments</h1>
        <p className="mt-1.5 text-[1rem] leading-6 text-muted-foreground">
          Every payment from a client appears here. Record what you collect, and the app tracks
          what the developer is owed.
        </p>
      </div>

      {successMessage && (
        <div className="flex items-start gap-2 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 text-[1rem] leading-5 text-primary" role="status">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <p className="min-w-0 flex-1 break-words">{successMessage}</p>
        </div>
      )}

      <dl className="grid grid-cols-2 gap-2.5">
        <div className="rounded-xl border border-border bg-card p-4">
          <dt className="text-[0.8125rem] font-medium uppercase tracking-wide text-muted-foreground">
            Total payments
          </dt>
          <dd className="mt-1.5 text-[1.375rem] font-semibold leading-tight tracking-tight text-foreground">
            {totalsFinal.count}
          </dd>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <dt className="text-[0.8125rem] font-medium uppercase tracking-wide text-muted-foreground">
            Owed to developer
          </dt>
          <dd className="mt-1.5 text-[1.375rem] font-semibold leading-tight tracking-tight text-primary">
            {formatUsd(totalsFinal.owedUsd)}
          </dd>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <dt className="text-[0.8125rem] font-medium uppercase tracking-wide text-muted-foreground">
            Paid out
          </dt>
          <dd className="mt-1.5 text-[1.375rem] font-semibold leading-tight tracking-tight text-foreground">
            {formatUsd(totalsFinal.paidOutUsd)}
          </dd>
        </div>
        <div className="rounded-xl border border-primary/40 bg-primary/5 p-4">
          <dt className="text-[0.8125rem] font-medium uppercase tracking-wide text-muted-foreground">
            Remaining balance
          </dt>
          <dd className="mt-1.5 text-[1.375rem] font-semibold leading-tight tracking-tight text-foreground">
            {formatUsd(totalsFinal.remainingUsd)}
          </dd>
        </div>
      </dl>

      <form
        onSubmit={submitPayment}
        className="rounded-xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
      >
        <h2 className="flex items-center gap-2 text-[1.125rem] font-semibold leading-tight tracking-tight text-foreground">
          <BadgeDollarSign className="h-5 w-5 text-primary" aria-hidden="true" />
          Record a payment
        </h2>
        <p className="mt-1.5 text-[1rem] leading-6 text-muted-foreground">
          Enter the Client&apos;s username, the amount they paid, and the provider transaction ID
          (Stripe/PayPal) if you have it. The client is unlocked automatically.
        </p>
        <div className="mt-4 space-y-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="payment-username" className="text-[1rem] font-medium leading-5 text-muted-foreground">
              Client username
            </Label>
            <Input
              id="payment-username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="e.g. clientname"
              autoComplete="off"
              list="payment-client-usernames"
              required
              className="min-h-12 rounded-xl text-[1rem]"
            />
            <datalist id="payment-client-usernames">
              {clients.map((client) => (
                <option key={client.id} value={client.username}>
                  {client.name}
                </option>
              ))}
            </datalist>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="payment-amount" className="text-[1rem] font-medium leading-5 text-muted-foreground">
                Amount (USD)
              </Label>
              <Input
                id="payment-amount"
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                required
                className="min-h-12 rounded-xl text-[1rem]"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payment-note" className="text-[1rem] font-medium leading-5 text-muted-foreground">
                Transaction ID
              </Label>
              <Input
                id="payment-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="pi_... (optional)"
                autoComplete="off"
                className="min-h-12 rounded-xl text-[1rem]"
              />
            </div>
          </div>
          {formError && (
            <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-[1rem] leading-5 text-destructive" role="alert">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <p className="min-w-0 flex-1 break-words">{formError}</p>
            </div>
          )}
          <Button
            type="submit"
            disabled={submitting}
            className="min-h-12 w-full justify-center rounded-xl text-[1rem] font-semibold"
          >
            <Plus className="h-5 w-5" aria-hidden="true" />
            {submitting ? "Recording…" : "Record payment"}
          </Button>
        </div>
      </form>

      <section aria-labelledby="payments-list-heading" className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="payments-list-heading" className="text-[1rem] font-semibold tracking-tight text-foreground">
            Recent payments
          </h2>
          <span className="text-[1rem] font-medium text-muted-foreground">{payments.length} total</span>
        </div>
        {payments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center">
            <Receipt className="mx-auto h-7 w-7 text-muted-foreground" aria-hidden="true" />
            <h3 className="mt-3 text-[1.125rem] font-medium leading-tight text-foreground">
              No payments recorded yet
            </h3>
            <p className="mx-auto mt-1.5 max-w-sm text-[1rem] leading-6 text-muted-foreground">
              When a client pays, record it above and it will appear here with its tag and balance.
            </p>
          </div>
        ) : (
          <ol className="space-y-3">
            {payments.map((payment) => (
              <li key={payment.id} className="rounded-xl border border-border bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[1rem] font-semibold leading-5 text-foreground">
                      {payment.clientName}
                    </p>
                    <p className="mt-0.5 truncate text-[0.875rem] leading-5 text-muted-foreground">
                      @{payment.clientUsername}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-md border px-2.5 py-1 text-[0.75rem] font-medium uppercase tracking-wide",
                      payment.tag === "new_user"
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border bg-muted text-muted-foreground",
                    )}
                  >
                    {payment.tag === "new_user" ? "New user" : "Membership"}
                  </span>
                </div>
                <p className="mt-2 text-[1.125rem] font-semibold leading-tight tracking-tight text-foreground">
                  {formatUsd(payment.amountUsd)}
                </p>
                <p className="mt-1 text-[0.875rem] leading-5 text-muted-foreground">
                  {formatDateTime(payment.recordedAt)}
                  {payment.note ? ` · ${payment.note}` : ""}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
