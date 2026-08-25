# No More Copium — Payment Setup Progress Save

**Created:** 2026-08-03 (owner went offline — save point so we can continue later)
**Purpose:** Exact place where we left off in payment setup, so we can resume without re-explaining.
**Companion docs:** `docs/COMPLETE_PAYMENT_STRATEGY.md`, `docs/PAYMENT_MANAGER_SYSTEM.md`

---

## Where we left off (owner = she, Bangladesh)

### Done
- **bKash** ✅ open (personal account)
- **Nagad** ✅ open (personal account)
- **e-TIN** ✅ **downloaded** (2026-08-03)
  - Portal: `secure.incometax.gov.bd`
  - User ID: **ChampaKhotunNishi** (registered + logged in)
  - TIN application filled: Purpose **Others**, Individual → Bangladeshi → **Having NID**, Income Category **Service**, District **Dhaka**, Source **Income from Other Sources + Freelancing**
  - Hit the "Please select an option." UI bug on the long SaaS option — fixed by reselecting + Go to Next, or picking a shorter nearby option ("Software Development" / "IT Enabled Services")
  - Address entered: **OLD home address (same as NID)** — she has access to old home, so old address is provable
  - ✅ Certificate PDF downloaded

### Blocked / parked
- **Payoneer:** stuck at **address proof** (she just moved, old docs trashed, NID has old address, Islami Bank CellFin face-scan keeps failing). Possible unblock later: fresh bank statement from Islami Bank (re-print, old address) or old-home utility bill — she declined these for now.
- **Wise:** BD accounts are **send-only** (no USD account details) — confirmed by her screenshot → cannot receive Lemon Squeezy payouts via Wise.
- **Lemon Squeezy:** parked — no working payout rail yet (Payoneer/Wise blocked).

### Chosen direction (see COMPLETE_PAYMENT_STRATEGY.md §3)
**US Payment Partner route** — partner (US) collects via **PayPal** (has personal; upgrading to Business for subscriptions) + **Stripe** (creating; payouts paused until his SSN arrives Sep–Oct 2026). Partner pays developer via **Binance Pay internal transfer** (USDT). Developer unlocks clients manually in Coach Dashboard → Pending Payments (to be built).

### Next actions (when everyone is back)
1. Owner (optional, fallback): apply to **AamarPay** as Individual/Freelancer — upload NID + e-TIN PDF + Islami Bank checkbook photo + bKash/Nagad numbers; note text prepared (see chat history); KYC 24–48h; Store ID + Signature Key go straight into Supabase Edge Function Secrets (never in chat).
2. Partner: send **PayPal.me $29 link** → then PayPal Business **Subscription Plan** link → then **Stripe Payment Link** (dynamic methods) once verified.
3. Developer: put both links in the onboarding final landing card; build Pending Payments unlock; build Payment Manager System (PAYMENT_MANAGER_SYSTEM.md).
4. Owner cash flow (when she gets her own rails): Lemon Squeezy/AamarPay → her Payoneer (later) or bank → her bKash via Remittance → Payoneer section → cash out at ATMs (BRAC/City/Q-Cash, 7 Taka per thousand) → pays developer cash as agreed. Her bank details stay confidential — she configures payouts herself.

---

## Key constraints (never violate)
- No bank details of owner in the app/chat — she handles her own payout configuration.
- No provider API keys in chat or GitHub — Supabase Edge Function Secrets only.
- No personal wallet + screenshot payment flow (refused; see COMPLETE_PAYMENT_STRATEGY.md §2).
- Keep invoices/records for all transfers.
