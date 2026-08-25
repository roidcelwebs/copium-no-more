# No More Copium — Payment Manager System

**Created:** 2026-08-03 (discussion mode, message "in the web app, we'll have a new page where my US payment manager...")
**Status:** SPEC — to be implemented in batches after the workout overhaul; always refer to this file + docs/COMPLETE_PAYMENT_STRATEGY.md

---

## 1. Purpose

A dedicated **Payment Mode** page in the web app where the **US Payment Manager** (the US partner who collects payments) can:

- Log in with his own account (a third role alongside Coach and Client)
- See every payment that comes through
- Track how much he owes the developer
- Submit payouts (with proof) that the developer approves

---

## 2. Roles & access

- **One US Payment Manager** account (like the single coach account).
- New role value: `payment_manager` (or reuse coach-style single-account pattern).
- Access: visible in the account/role picker as **Payment mode** (or direct link given by developer).
- Only the developer (coach account) can create/manage this account.

---

## 3. Payment list page (main page of Payment mode)

- **List of every payment** a client/user makes — newest first.
- Each payment row shows:
  - Client name / username / email used to pay
  - Date & time
  - Amount ($29)
  - **Tag**:
    - `New user` — first payment for a new client
    - `Membership` — returning client paying again (renewal, next month)
  - Status (e.g., `Recorded`, `Unlocked`, `Payout submitted`)
- The app **automatically approves** the client when payment is confirmed (gives them access to client mode).
  - MVP: developer/coach verifies transaction ID → **Verify & Unlock** (Pending Payments in Coach Dashboard)
  - Future: provider webhook auto-unlocks (Stripe/PayPal IPN signed verification)

## 4. Totals & split

- Every client payment is counted as **$20** toward the developer (fixed split: $29 − fees ≈ $25 → $5 partner / $20 developer — see COMPLETE_PAYMENT_STRATEGY.md §4).
- Bottom of the page shows:
  - `Total payments` (count)
  - `Total owed to developer` = number of payments × $20
  - `Total paid out` (approved payouts)
  - `Remaining balance` = owed − paid out

## 5. Payout flow

1. Partner taps **Make payout** → new page/panel
2. Partner sets **amount** (BDT/USD — the amount he's sending the developer)
3. Partner **attaches a screenshot/photo** as confirmation of the payout (e.g., Binance Pay transfer confirmation)
4. Partner submits → payout is **Pending**
5. Developer logs into **Coach mode → (Payouts/Approvals section)** → sees pending payout with amount + screenshot → **Approve** or **Reject**
6. On approval: the payout amount is **subtracted from the total owed**; audit log records who/when
7. On rejection: optional reason; balance unchanged

## 6. Future features (not now)

- Partner's own earnings history — "how much he has been paid as US Payment Manager up until now"
- Automatic webhook unlock (post-SSN Stripe/PayPal)
- Payout via Stripe Connect-style transfers (later)

---

## 7. Implementation batches (when we build it)

- **P1 ✅ (delivered 2026-08-06):** Role + login for payment manager (single account, passwordless like local coach/client) + Payments list with tags (New user / Membership) + $20-per-payment totals + auto-unlock client on payment record.
- **P2 ✅ (delivered 2026-08-06):** Payout submission (amount + screenshot upload) + Pending state + Coach approval UI + balance subtraction + audit log. Payment Manager submits from `/payment/payouts`; Coach approves/rejects from Coach Dashboard → Payout approvals.
- **P3 (future):** webhook auto-unlock (Stripe/PayPal IPN), earnings history for the Payment Manager.

## 8. Rules

- No emojis, black/red theme (#E50910 red), min font 1rem, 44px+ touch targets, rounded-xl cards — same UI system as the rest of the app.
- Images upload to a private storage bucket (like chat images), not mixed with Progress Pictures.
- Never expose provider API keys in frontend.
