import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { DEV_SHARE_PER_PAYMENT_USD, formatUsd, paymentTotals } from "./payment-system";

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

describe("payment system totals", () => {
  test("each payment counts as $20 owed to the developer", () => {
    const payments = Array.from({ length: 5 }, (_, index) => ({
      id: `p${index}`,
      clientName: "Client",
      clientUsername: "client",
      amountUsd: 29,
      tag: "new_user" as const,
      recordedBy: "pm",
      recordedAt: "2026-08-06T00:00:00.000Z",
    }));
    const totals = paymentTotals(payments, []);
    expect(totals.count).toBe(5);
    expect(totals.owedUsd).toBe(5 * DEV_SHARE_PER_PAYMENT_USD);
    expect(totals.paidOutUsd).toBe(0);
    expect(totals.remainingUsd).toBe(100);
  });

  test("approved payouts subtract from the remaining balance", () => {
    const payments = Array.from({ length: 5 }, (_, index) => ({
      id: `p${index}`,
      clientName: "Client",
      clientUsername: "client",
      amountUsd: 29,
      tag: "new_user" as const,
      recordedBy: "pm",
      recordedAt: "2026-08-06T00:00:00.000Z",
    }));
    const payouts = [
      { id: "x1", amountUsd: 40, status: "approved" as const, submittedBy: "pm", submittedAt: "2026-08-06T01:00:00.000Z" },
      { id: "x2", amountUsd: 10, status: "pending" as const, submittedBy: "pm", submittedAt: "2026-08-06T02:00:00.000Z" },
      { id: "x3", amountUsd: 5, status: "rejected" as const, submittedBy: "pm", submittedAt: "2026-08-06T03:00:00.000Z" },
    ];
    const totals = paymentTotals(payments, payouts);
    expect(totals.paidOutUsd).toBe(40);
    expect(totals.remainingUsd).toBe(60);
  });

  test("USD formatting uses two decimals", () => {
    expect(formatUsd(20)).toBe("$20.00");
    expect(formatUsd(12.5)).toBe("$12.50");
  });
});

describe("payment manager UI overhaul", () => {
  test("Payment Dashboard uses reduced corners, large touch targets, and no emojis", () => {
    const dashboard = read("../components/payment/PaymentDashboard.tsx");
    expect(dashboard).toMatch(/rounded-xl/);
    expect(dashboard).toMatch(/min-h-12 rounded-xl/);
    expect(dashboard).toMatch(/text-\[1rem\]/);
    expect(dashboard).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  test("no colored gradients in payment UI", () => {
    const dashboard = read("../components/payment/PaymentDashboard.tsx");
    const grads = dashboard
      .split(/\s+/)
      .map((t) => t.replace(/^[^a-z]+|[^\w/\[\].%-]+$/g, ""))
      .filter((t) => /^(?:from|via|to)-/.test(t));
    expect(grads.filter((t) => !t.includes("black") && !t.startsWith("from-transparent"))).toEqual([]);
  });

  test("cloud accounts flow uses Google sign-in only", () => {
    const accounts = read("../lib/cloud-accounts.ts");
    expect(accounts).toMatch(/bootstrapAccount/);
    const button = read("../components/account/GoogleSignInButton.tsx");
    expect(button).toMatch(/Continue with Google/);
    expect(button).toMatch(/signInWithOAuth/);
    expect(button).toMatch(/provider: "google"/);
    const access = read("../components/account/AccountAccess.tsx");
    expect(access).toMatch(/bootstrapAccount/);
    expect(access).toMatch(/GoogleSignInButton/);
    expect(access).toMatch(/Your name/);
    expect(access).toMatch(/Your username/);
    expect(access).not.toMatch(/Coach Mode/);
    expect(access).not.toMatch(/Payment Mode/);
    expect(access).not.toMatch(/Create a new local account/);
    // The old landing is archived (kept in the repo) but must not be active:
    // it stays in landing-archive/ and the root route no longer uses it.
    const archivedLanding = read("../../landing-archive/LandingPage.tsx");
    expect(archivedLanding).toMatch(/GoogleSignInButton/);
    expect(archivedLanding).not.toMatch(/to="\/access"/);
    // The root route is now the stripped-down welcome screen that leads to /access.
    const indexRoute = read("../routes/index.tsx");
    expect(indexRoute).toMatch(/You made it, brother/);
    expect(indexRoute).toMatch(/Welcome to No More Copium/);
    expect(indexRoute).toMatch(/to="\/access"/);
    expect(indexRoute).not.toMatch(/GoogleSignInButton/);
    const route = read("../routes/access.tsx");
    expect(route).not.toMatch(/Local development prototype/);
  });

  test("payment routes exist and no emojis", () => {
    const paymentRoute = read("../routes/payment.tsx");
    const dashboardRoute = read("../routes/payment.dashboard.tsx");
    const payoutsRoute = read("../routes/payment.payouts.tsx");
    expect(paymentRoute).toMatch(/payment\/dashboard/);
    expect(dashboardRoute).toMatch(/PaymentDashboard/);
    expect(payoutsRoute).toMatch(/PayoutsPage/);
    expect(dashboardRoute).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(payoutsRoute).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  test("payout flow exists on both sides without emojis or colored gradients", () => {
    const payoutsPage = read("../components/payment/PayoutsPage.tsx");
    expect(payoutsPage).toMatch(/Submit payout/);
    expect(payoutsPage).toMatch(/Make a payout/);
    expect(payoutsPage).toMatch(/min-h-12 rounded-xl/);
    expect(payoutsPage).not.toMatch(/\p{Extended_Pictographic}/u);

    const coachSection = read("../components/coach/PayoutApprovalsSection.tsx");
    expect(coachSection).toMatch(/Payout approvals/);
    expect(coachSection).toMatch(/Approve/);
    expect(coachSection).toMatch(/Reject/);
    expect(coachSection).not.toMatch(/\p{Extended_Pictographic}/u);

    const all = `${payoutsPage}\n${coachSection}`;
    const grads = all
      .split(/\s+/)
      .map((t) => t.replace(/^[^a-z]+|[^\w/\[\].%-]+$/g, ""))
      .filter((t) => /^(?:from|via|to)-/.test(t));
    expect(grads.filter((t) => !t.includes("black") && !t.startsWith("from-transparent"))).toEqual([]);
  });

  test("nav includes Payouts destination", () => {
    const shell = read("../components/payment/PaymentShell.tsx");
    expect(shell).toMatch(/\/payment\/payouts/);
    expect(shell).toMatch(/label: "Payouts"/);
  });
});
