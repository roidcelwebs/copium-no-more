# No More Copium — Complete Payment Strategy

**Created:** 2026-08-02 (discussion mode), updated 2026-08-03/04 with US Payment Partner route
**Status:** LIVE STRATEGY — always refer to this file before any payment work
**Pricing:** $29/month subscription (card displayed: "All this for just $29/month")
**Team:** Owner (she, Bangladesh), Developer (Bangladesh, Binance + Bybit), US Payment Partner (US, PayPal + Stripe)

---

## 1. Resources we actually have (as of last check)

### Owner (she) — Bangladesh
- **NID only** (old home address; she just moved, no new address proof, old docs trashed)
- **bKash** ✅ open (personal)
- **Nagad** ✅ open (personal)
- **Islami Bank Ltd** account + physical checkbook (dormant ~1 year; CellFin app face-scan keeps failing; bank details confidential by her request — she does her own bank/payout handling)
- **e-TIN** ✅ downloaded (2026-08-03) — created online with only NID at `secure.incometax.gov.bd`
- No PayPal/Stripe/Wise/Payoneer/Lemon Squeezy account yet (Payoneer stuck at address proof — see below)

### Developer (user) — Bangladesh
- **Binance** exchange + wallet account ✅ (verified)
- **Bybit** account with **virtual Visa card** (spending only, cannot receive merchant payments)
- **No NID access right now** → cannot open new Payoneer / fully verify new bKash at this moment
- Payout preference: USDT to Binance via **Binance Pay internal transfer** (email/phone/Binance ID/Pay ID), then P2P sell to bKash/bank when needed

### US Payment Partner — United States
- **PayPal** (personal account) ✅ — upgrade to Business (free, Individual/Sole Proprietor) pending
- **Stripe** — creating standard account; payouts paused until SSN verification
- **No SSN until September–October 2026** (parents applied; his own SSN pending)
- Paid per client: keeps **$5** per payment, sends **$20** to developer (see §4)

---

## 2. Options evaluated and their status

| Option | Status | Why |
|---|---|---|
| PayPal receiving in BD | ❌ Blocked | Not available for Bangladesh |
| Stripe direct in BD | ❌ Blocked | Stripe not available in Bangladesh |
| Payoneer (owner) | ⚠️ Stuck | Asks for address proof; old docs trashed; NID has old address; CellFin face-scan fails; bKash-app registration still hits Payoneer's own KYC |
| Wise (BD) | ❌ Dead for receiving | New BD Wise accounts are **send-only** — no USD account details (confirmed by screenshot 2026-08-02) |
| Lemon Squeezy → Payoneer/Wise | ❌ Blocked | Both payout rails blocked above |
| Lemon Squeezy → bank wire → Islami Bank | ⚠️ Fallback | Requires bank details (confidential by owner request); dormant account; first payout hold 7–15 days |
| AamarPay (BD gateway) | ⚠️ Fallback | Needs NID + e-TIN + bank/checkbook + bKash; setup fee BDT 4,000–15,000; commission 2.55–3.25% cards / 1.85–2% MFS; KYC 24–48h; covers cards + bKash + Nagad + Rocket + internet banking |
| Personal wallet + screenshot manual verification | ❌ Refused | No machine-verifiable proof; screenshots editable/reusable; double-spend; underpayment; no refunds/disputes. Never implemented. |

---

## 3. CHOSEN PATH (current) — US Payment Partner collects, manual unlock in app

**Why:** Fastest lawful route to "as many payment methods as possible" for US/international clients without requiring BD KYC or address proof. The partner is a real US person collecting on our behalf (written arrangement advised).

### 3.1 Partner setup
1. **PayPal (now):**
   - For today/MVP: send **PayPal.me $29 one-time link** (`paypal.me/NAME/29`)
   - Parallel: upgrade Personal → **Business** (free, Individual/Sole Proprietor, legal name, SSN) → create **PayPal Subscription Plan** $29/mo → `paypal.com/webapps/billing/plans/subscribe?plan_id=...` link
2. **Stripe (when verified):**
   - Standard free account → **Payment Links** → $29/mo recurring → enable **Dynamic payment methods** (cards, Apple Pay, Google Pay, Link one-click; 25+ methods) → `buy.stripe.com/...` link
3. **No SSN yet (until Sep–Oct):**
   - PayPal personal can still receive small amounts via PayPal.me; funds held until SSN verification for withdrawal
   - Stripe can create Payment Links and collect; **payouts paused** until SSN verification — money sits in Stripe balance
4. **Payout to developer:**
   - PayPal/Stripe → partner's US bank → **Binance P2P Buy USDT** (bank transfer) → **Binance Pay → Send → developer's email/phone/Binance ID/Pay ID** (USDT internal transfer, instant, free)
   - Keep invoices: "dev work payment for period Y" — partner is liable for US taxes/1099-K on what he collects

### 3.2 App flow (MVP, no provider API keys needed)
1. Client finishes onboarding final sequence → payment gate card
2. Two buttons: **Pay with Card / Apple Pay / Google Pay** (Stripe link) + **Pay with PayPal** (PayPal link)
3. Client pays on provider-hosted checkout (many methods, no code)
4. Partner sees `succeeded`/`completed` → sends transaction ID to developer (WhatsApp)
5. Developer (coach account) → **Coach Dashboard → Pending Payments** → enter transaction ID → **Verify & Unlock**
6. App marks `onboardingCompleted` + approves Join Request + unlocks `/client/dashboard`
7. Audit log: who approved, when, which transaction ID — prevents double-unlock

### 3.3 Future (when partner has SSN / or owner gets rails)
- **Automated:** Stripe webhook / provider IPN → signed verification → auto-unlock (Edge Function; secrets in Supabase Edge Function Secrets, never in chat/GitHub)
- **Owner rails:** AamarPay (NID + e-TIN + checkbook, settlement to Islami Bank/bKash) OR Lemon Squeezy bank wire — revisit when she wants her own merchant account
- **Payment Manager System** (web app page for the partner): see `docs/PAYMENT_MANAGER_SYSTEM.md`

---

## 4. Money split (as decided by owner/developer)

- Client pays **$29/month**
- Fees (~$4–5 depending on method) come out first → ~**$25** effective
- Partner keeps **$5** (~20%)
- Developer receives **$20** per client payment
- Payment Manager System totals every payment as **$20 toward developer** and tracks payouts

---

## 5. Compliance / safety rules (non-negotiable)

- **Never** paste Stripe/PayPal/AamarPay API keys or bank details in chat. Provider secrets go into Supabase Edge Function Secrets only (when we do automated webhooks).
- Owner's bank/payout configuration is **her own business** — the app never sees or stores her bank details.
- Keep records: invoices for developer payments, partner's sales reports, transfer logs.
- Partner should have a written partnership note (profit split, who handles US tax) — he is liable for 1099-K on the $29s.
- No personal wallet + screenshot payment flow, ever (refused for safety — see §2).
- Bangladesh FX: keep lawful rails (Payoneer/bKash remittance, Binance P2P is exchange-to-exchange; consult a local accountant at scale).

---

## 6. Current status & next actions

**Done:**
- bKash ✅, Nagad ✅, e-TIN ✅ (owner)
- Partner: PayPal confirmed, Stripe "creating right away", SSN Sep–Oct
- Payment gate UI placeholder exists in onboarding final sequence
- Pending Payments unlock flow designed (build into coach dashboard)

**Next (when partner replies):**
1. Get **PayPal.me $29 link** (go live today for first clients)
2. Get **PayPal Business subscription link** (auto-recurring)
3. Get **Stripe Payment Link** when verified
4. Put both links in app final landing card ("Pay with Card / Apple Pay / Google Pay" + "Pay with PayPal")
5. Build **Pending Payments** section in coach dashboard (manual unlock)
6. Build **Payment Manager System** page (see PAYMENT_MANAGER_SYSTEM.md)
7. Later: automated webhooks after SSN + Edge Function secrets
