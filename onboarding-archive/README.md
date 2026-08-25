# Onboarding Archive (INACTIVE)

**Archived:** 2026-08-25 · **Status:** INACTIVE BY DESIGN — code legacy, not routed, not imported, not bundled.

These are the **exact original files** of the old **automated onboarding + payment-box** flow, kept in the repo per the never-delete rule. Nothing imports them and nothing routes to them after Batch B5; the app now uses the manual texting onboarding (`ClientOnboardingScreen` + the live coach chat + the `append_onboarding_greeting` RPC).

## What replaced them (B5, 2026-08-25)

- `/onboarding` = live free-text chat with the Coach (`src/components/chat/ClientOnboardingScreen.tsx`) + "Waiting for approval" banner
- One server-side greeting, idempotent: `Welcome to No More Copium, {name}. How many times a week do you usually work out right now, brother?`
- Access gate = `app_accounts.approved_at` (coach approves via Access & approval in ClientManagement, or the Awaiting-approval card in Messaging)

## Files in this folder (original, unchanged)

| File | What it was |
| --- | --- |
| `client-onboarding.ts` | Scripted questions (1–6), personalized responses, `ONBOARDING_FINAL_MESSAGE`, `ONBOARDING_PAYMENT_BOX_BODY`, `PAYMENT_DONE_PROMPT`, `PAYMENT_VERIFY_MESSAGE` |
| `ClientOnboardingChat.tsx` | The scripted chat UI (options buttons, step 7 payment wait) |
| `PaymentBox.tsx` | The in-app Card/PayPal payment box (dead — payments happen via DM; owner verifies in coach dashboard) |
| `PaymentSettingsForm.tsx` | Coach-side 2 URL fields for the payment box (dead) |
| `onboarding-ui.test.ts` | Historical UI guard (moved with the code) |
| `payment-final-sequence.test.ts` | Historical payment-sequence guard (moved; live-code assertions updated to verify the box is gone) |

## Files that remain active (do NOT archive)

- `src/lib/payment-system.ts`, `src/lib/payment-settings.ts` — coach-side payment bookkeeping + settings hydration (still used)
- `src/components/coach/PendingPaymentsSection.tsx`, `PayoutApprovalsSection.tsx` — coach dashboard tracking
- `src/hooks/use-vertical-section-pager.ts`, `src/lib/final-sequence.ts`, `src/lib/client-greeting.ts` — legacy libs, unused but harmless

## Restore (if ever needed)

Move the files back (client-onboarding.ts → `src/lib/`, the rest → `src/components/chat/` / `src/components/payment/`), restore `src/routes/onboarding.tsx` to import `ClientOnboardingChat` (it is in git history), and rebuild.
