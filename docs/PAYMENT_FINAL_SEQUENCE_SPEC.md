# No More Copium — Onboarding Payment Final Sequence Spec

**Created:** 2026-08-06 (discussion mode)
**Status:** ✅ APPROVED + IMPLEMENTED (Phase 1) — pending patch application
**Companion docs:** `docs/COMPLETE_PAYMENT_STRATEGY.md`, `docs/PAYMENT_MANAGER_SYSTEM.md`, `docs/ONBOARDING_DISCUSSION_SPEC.md`

---

## 1. Decisions locked (2026-08-06)

- **The coach-editable final-sequence editor is REMOVED.** The final message is now a fixed, hardcoded sequence. The Messaging page's "Automations" tab is replaced by a **Payment settings** tab (2 URL fields only).
- **"Are you ready for the unfair advantage?" → "Hell yeah" STAYS** immediately before the final message.
- **No "Not yet" option.** "Are you done with the payment?" has a single answer option: **Yes**.
- Payment buttons are labeled by **method, not processor**: **Card** and **PayPal**. Users never see "Stripe" as a brand.
- **No "Need help paying?" popup** (deferred — not needed).
- **Phase 1 = manual verify (launch now).** Client taps Yes → coach verifies in partner's Stripe/PayPal dashboard → records in Coach Dashboard → Pending Payments → client unlocks automatically.
- **Phase 2 = webhook auto-unlock (later, with Cloud rebuild).** Same buttons/UI; only what's behind them changes.

## 2. The full final sequence (in order)

1. **Coach message:** "Are you ready for the unfair advantage?" → answer options: **[Hell yeah]** (single option, same style as existing onboarding options)
2. After Hell yeah → **final coach message (fixed, not editable):**

   > Just complete the payment and you'll get instant access to your personalized training program. I can't wait to talk to you and personalize it even more.

   - Below the text, inside the same message bubble, a **payment box**:
     - Bridge line: **Click below to continue payment**
     - Button 1 (primary, solid red): **Card** — subtext: *Visa · Mastercard · Amex · Apple Pay · Google Pay*
     - Button 2 (secondary, outline): **PayPal**
     - Both buttons open the hosted checkout (Stripe checkout page / PayPal page) in a **new tab** so onboarding chat state is preserved.
     - The moment either button is tapped, the app records a **"payment started" pending record** (client username, method, time) — visible to the coach even if the client never taps Yes.

3. ~after the payment box appears → **coach auto-message:** "Are you done with the payment?" → answer options: **[Yes]** (single option only)
4. Client taps **Yes** → **coach auto-reply (fixed):** "Please wait for me to verify your payment."
5. **Coach side (manual verify):** coach sees the pending record in **Coach Dashboard → Pending payments** → confirms the matching $29 payment in the partner's Stripe/PayPal dashboard (match by time + username + amount) → enters the provider transaction ID → **Verify & unlock** → app **auto-unlocks the client** (completes onboarding). The payment is also recorded in the Payment Manager system (tag New user/Membership, $20 toward developer).
6. Client's onboarding screen shows "Payment verification in progress" until unlocked; on unlock the client enters the app instantly.

## 3. Cheat-proofing

- The coach is the gate: if the client taps Yes but no payment exists, the coach simply doesn't unlock (and can message the client). Same trust model as the old Join Requests.
- The "payment started" pending record prevents confusion about *who* claimed to pay.
- Phase 2 removes the manual step entirely via signed webhook (idempotent entitlement activation).

## 4. Build plan

**Phase 1 ✅ (built 2026-08-06, this patch):**
- Remove coach-editable final-sequence editor usage (Messaging page now has Payment settings tab).
- Fixed final message + payment box (Card / PayPal buttons) with configurable URLs.
- "Are you done with the payment?" → [Yes] → "Please wait for me to verify your payment." auto-messages.
- "Payment started" pending record on button tap, surfaced in Coach Dashboard → Pending payments (Verify & unlock form).
- Payment settings (2 URL fields) on coach Messaging page → Payment tab.
- Also folds in the Supabase integration cleanup (removes regenerated inactive paths + cleans start.ts).

**Phase 2 (later, with Cloud rebuild):**
- Lovable Cloud + Edge Functions: create Checkout Session, Stripe webhook handler (`checkout.session.completed`), signed verification, idempotent unlock.
- Same buttons; behind "Card" becomes real API checkout. PayPal webhook similarly.
- Full localStorage → database data migration (accounts, programs, workouts, chat, history, payments).

## 5. Implementation notes

- `src/lib/client-onboarding.ts`: steps 1–6 questions (6 = "Are you done with the payment?"), step 7 = awaiting verification. `ONBOARDING_FINAL_MESSAGE` and `ONBOARDING_PAYMENT_BOX_BODY` exported.
- `src/lib/payment-settings.ts`: `loadPaymentSettings` / `savePaymentSettings` (cardUrl, paypalUrl) + validation.
- `src/lib/payment-system.ts`: `recordPaymentStarted` / `fetchPaymentStartedRecords` / `clearPaymentStartedForClient`; `recordPayment` now clears the client's started record; unlock sets onboardingStep 7.
- `src/components/payment/PaymentBox.tsx`: renders in chat (client: interactive; coach: read-only). Buttons disabled until the matching URL is configured.
- `src/components/chat/ChatMessageBubble.tsx`: renders PaymentBox when body === `ONBOARDING_PAYMENT_BOX_BODY`. Old placeholder/PopupLink branch removed.
- `src/components/chat/ClientOnboardingChat.tsx`: answers allowed at steps 1–6; step 7 shows "Payment verification in progress" and polls for completion. Image/join-request gate removed from onboarding (replaced by payment gate).
- `src/components/chat/PaymentSettingsForm.tsx`: 2 URL fields + save (Messaging → Payment tab).
- `src/components/coach/PendingPaymentsSection.tsx`: Coach Dashboard section listing payment-started records with Verify & unlock (transaction ID) → recordPayment → auto-unlock.
