import { supabase } from "@/integrations/supabase/client";
import { supabaseLoose } from "./supabase-loose-client";

export type PaymentTag = "new_user" | "membership";

export type PaymentStartedRecord = {
  id: string;
  clientId: string;
  clientUsername: string;
  clientName: string;
  method: "card" | "paypal";
  startedAt: string;
};

export type PaymentRecord = {
  id: string;
  clientName: string;
  clientUsername: string;
  amountUsd: number;
  tag: PaymentTag;
  note?: string;
  recordedBy: string;
  recordedAt: string;
};

export type PayoutStatus = "pending" | "approved" | "rejected";

export type PayoutRecord = {
  id: string;
  amountUsd: number;
  screenshotId?: string;
  note?: string;
  status: PayoutStatus;
  submittedBy: string;
  submittedAt: string;
  decidedAt?: string;
  decidedByCoachId?: string;
  rejectionReason?: string;
};

/** A single month of access for one client. */
export const PAYMENT_AMOUNT_USD = 29;
/** Fixed split: partner keeps this, developer receives this per payment. */
export const PARTNER_SHARE_PER_PAYMENT_USD = 5;
export const DEV_SHARE_PER_PAYMENT_USD = 20;

export const LOCAL_PAYMENTS_CHANGED_EVENT = "no-more-copium:local-payments-changed";
export const LOCAL_PAYOUTS_CHANGED_EVENT = "no-more-copium:local-payouts-changed";

type CloudPaymentRow = {
  id: string;
  client_id: string;
  client_username: string;
  client_name: string;
  amount_usd: number;
  tag: PaymentTag;
  note: string | null;
  recorded_by: string;
  recorded_at: string;
};

type CloudPayoutRow = {
  id: string;
  amount_usd: number;
  screenshot_id: string | null;
  note: string | null;
  status: PayoutStatus;
  submitted_by: string;
  submitted_at: string;
  decided_at: string | null;
  decided_by_coach_id: string | null;
  rejection_reason: string | null;
};

type CloudStartedRow = {
  id: string;
  client_id: string;
  client_username: string;
  client_name: string;
  method: "card" | "paypal";
  started_at: string;
};

function mapPayment(row: CloudPaymentRow): PaymentRecord {
  return {
    id: row.id,
    clientName: row.client_name,
    clientUsername: row.client_username,
    amountUsd: Number(row.amount_usd),
    tag: row.tag,
    note: row.note ?? undefined,
    recordedBy: row.recorded_by,
    recordedAt: row.recorded_at,
  };
}

function mapPayout(row: CloudPayoutRow): PayoutRecord {
  return {
    id: row.id,
    amountUsd: Number(row.amount_usd),
    screenshotId: row.screenshot_id ?? undefined,
    note: row.note ?? undefined,
    status: row.status,
    submittedBy: row.submitted_by,
    submittedAt: row.submitted_at,
    decidedAt: row.decided_at ?? undefined,
    decidedByCoachId: row.decided_by_coach_id ?? undefined,
    rejectionReason: row.rejection_reason ?? undefined,
  };
}

function mapStarted(row: CloudStartedRow): PaymentStartedRecord {
  return {
    id: row.id,
    clientId: row.client_id,
    clientUsername: row.client_username,
    clientName: row.client_name,
    method: row.method,
    startedAt: row.started_at,
  };
}

export function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

export async function fetchPayments(): Promise<PaymentRecord[]> {
  const { data, error } = await supabaseLoose
    .from("payments")
    .select(
      "id, client_id, client_username, client_name, amount_usd, tag, note, recorded_by, recorded_at",
    )
    .order("recorded_at", { ascending: false });
  if (error) {
    console.error("Payments could not be loaded", error);
    return [];
  }
  return (data ?? []).map((row) => mapPayment(row as unknown as CloudPaymentRow));
}

export async function fetchPayouts(): Promise<PayoutRecord[]> {
  const { data, error } = await supabaseLoose
    .from("payouts")
    .select(
      "id, amount_usd, screenshot_id, note, status, submitted_by, submitted_at, decided_at, decided_by_coach_id, rejection_reason",
    )
    .order("submitted_at", { ascending: false });
  if (error) {
    console.error("Payouts could not be loaded", error);
    return [];
  }
  return (data ?? []).map((row) => mapPayout(row as unknown as CloudPayoutRow));
}

export async function recordPayment({
  clientUsername,
  amountUsd,
  note,
  recordedBy,
}: {
  clientUsername: string;
  amountUsd: number;
  note?: string;
  recordedBy: string;
}): Promise<PaymentRecord> {
  const amount = Number.isFinite(amountUsd) && amountUsd > 0 ? amountUsd : PAYMENT_AMOUNT_USD;
  const { data, error } = await supabaseLoose.rpc("record_payment_and_unlock", {
    p_client_username: clientUsername,
    p_amount_usd: amount,
    p_note: note ?? "",
    p_recorded_by: recordedBy,
  });
  if (error) {
    const message =
      (error as { message?: string }).message ??
      "The payment could not be recorded. What happened: cloud verification failed. Why: the username may not match a client. What to do: check the username and try again.";
    throw new Error(message);
  }
  const paymentId = String(data);
  const { data: row } = await supabaseLoose
    .from("payments")
    .select(
      "id, client_id, client_username, client_name, amount_usd, tag, note, recorded_by, recorded_at",
    )
    .eq("id", paymentId)
    .maybeSingle();
  if (!row) throw new Error("Payment was recorded but could not be loaded.");
  emitPaymentsChanged();
  return mapPayment(row as unknown as CloudPaymentRow);
}

export async function recordPaymentStarted({
  clientId,
  method,
}: {
  clientId: string;
  method: "card" | "paypal";
}): Promise<PaymentStartedRecord> {
  const { data, error } = await supabaseLoose.rpc("record_payment_started", {
    p_client_id: clientId,
    p_method: method,
  });
  if (error) {
    throw new Error("The payment start could not be recorded.");
  }
  void data;
  const { data: row } = await supabaseLoose
    .from("payment_started")
    .select("id, client_id, client_username, client_name, method, started_at")
    .eq("client_id", clientId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!row) throw new Error("Payment start was recorded but could not be loaded.");
  return mapStarted(row as unknown as CloudStartedRow);
}

export async function fetchPaymentStartedRecords(): Promise<PaymentStartedRecord[]> {
  const { data, error } = await supabaseLoose
    .from("payment_started")
    .select("id, client_id, client_username, client_name, method, started_at")
    .order("started_at", { ascending: false });
  if (error) {
    console.error("Payment started records could not be loaded", error);
    return [];
  }
  return (data ?? []).map((row) => mapStarted(row as unknown as CloudStartedRow));
}

export function clearPaymentStartedForClient(clientId: string): void {
  void supabaseLoose.from("payment_started").delete().eq("client_id", clientId);
}

export function submitPayout({
  amountUsd,
  screenshotId,
  note,
  submittedBy,
}: {
  amountUsd: number;
  screenshotId?: string;
  note?: string;
  submittedBy: string;
}): Promise<PayoutRecord> {
  const amount = Number.isFinite(amountUsd) && amountUsd > 0 ? amountUsd : 0;
  if (amount <= 0) {
    return Promise.reject(
      new Error(
        "Enter a payout amount greater than zero. What happened: the amount was empty or invalid. Why: payouts need a positive USD amount. What to do: enter how much you sent and try again.",
      ),
    );
  }
  return (async () => {
    const { data, error } = await supabaseLoose.rpc("submit_payout", {
      p_amount_usd: amount,
      p_screenshot_id: screenshotId ?? "",
      p_note: note ?? "",
      p_submitted_by: submittedBy,
    });
    if (error) throw new Error("The payout could not be submitted.");
    const payoutId = String(data);
    const { data: row } = await supabaseLoose
      .from("payouts")
      .select(
        "id, amount_usd, screenshot_id, note, status, submitted_by, submitted_at, decided_at, decided_by_coach_id, rejection_reason",
      )
      .eq("id", payoutId)
      .maybeSingle();
    if (!row) throw new Error("Payout was submitted but could not be loaded.");
    emitPayoutsChanged();
    return mapPayout(row as unknown as CloudPayoutRow);
  })();
}

export async function decidePayout(
  payoutId: string,
  decision: "approved" | "rejected",
  coachId: string,
  reason?: string,
): Promise<void> {
  const { error } = await supabaseLoose.rpc("decide_payout", {
    p_payout_id: payoutId,
    p_decision: decision,
    p_coach_id: coachId,
    p_reason: reason ?? "",
  });
  if (error) throw new Error("The payout could not be updated.");
  emitPayoutsChanged();
}

export function paymentTotals(
  payments: PaymentRecord[],
  payouts: PayoutRecord[],
): {
  count: number;
  owedUsd: number;
  paidOutUsd: number;
  remainingUsd: number;
} {
  const count = payments.length;
  const owedUsd = count * DEV_SHARE_PER_PAYMENT_USD;
  const paidOutUsd = payouts
    .filter((payout) => payout.status === "approved")
    .reduce((sum, payout) => sum + payout.amountUsd, 0);
  const remainingUsd = Math.max(0, owedUsd - paidOutUsd);
  return { count, owedUsd, paidOutUsd, remainingUsd };
}

function emitPaymentsChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(LOCAL_PAYMENTS_CHANGED_EVENT));
}

function emitPayoutsChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(LOCAL_PAYOUTS_CHANGED_EVENT));
}
