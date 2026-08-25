# No More Copium — Cloud Activation & Launch Playbook

**Updated:** 2026-08-08 (cloud runtime delivered — Google-only accounts)
**Status:** ✅ Cloud runtime implemented in code. Lovable auto-applies `supabase/migrations/` on deploy, so no manual SQL is needed.
**Goal:** Real Google login. The single allowlisted Google email (`COACH_GOOGLE_EMAIL`) becomes the Coach; every other Google account becomes a Client. All data lives in Supabase (fresh start).

---

## 1. What is already live (verified 2026-08-08)

- **Lovable Cloud enabled** on project `48681bee-...`; Supabase project `hhslcnrjndxoxedvante` (Tokyo, Tiny, 0.27/2 GB).
- **Google sign-in: "Managed by Lovable"** — OAuth fully configured, nothing to touch.
- **Secret set:** `COACH_GOOGLE_EMAIL` (created Aug 7) + `LOVABLE_API_KEY`.
- **Edge functions deployed:** `account-bootstrap` (Google → Coach/Client via COACH_GOOGLE_EMAIL), `program-cover-media`, `progress-picture-media` — all responding (verified).
- **Tables exist:** app_accounts, app_state, workout_sessions, chat_threads/messages/reads, progress_picture_batches/pictures, payments, payouts, payment_started, payment_settings, paused_workouts (all verified).
- **Storage buckets:** `progress-pictures`, `program-covers`.

## 2. What this code patch adds

- **Google-only access flow** (`/access`): "Continue with Google" → new clients pick Your name + Username (A–Z/a–z/0–9/underscore, 3–30) → onboarding → payment. Coach email skips straight to Coach mode.
- **Full cloud data layer** (replaces localStorage for the launch path):
  - Accounts via `account-bootstrap` edge function
  - Programs/exercises/workouts/weight units via `app_state` (jsonb)
  - Chat via `chat_threads`/`chat_messages`/`chat_reads` + `unread_counts` RPC
  - Workout history via `workout_sessions` (incl. edit/delete)
  - Paused workouts via `paused_workouts`
  - Payments/payouts/payment_started/payment_settings via tables + SECURITY DEFINER RPCs (`record_payment_and_unlock`, `submit_payout`, `decide_payout`, `record_payment_started`, `upsert_payment_settings`, `append_onboarding_messages`)
- **New migration `20260808130000_cloud_runtime.sql`**: onboarding columns on app_accounts, table grants + policies, chat write policies, workout update/delete policies, RPCs. Lovable applies it automatically on deploy.
- **Removed**: local account picker (Coach Mode/Client Mode/Payment Mode buttons), export/import, local prototype tools, final-sequence editor (already gone), old Supabase runtime files.

## 3. Deploy steps (just publish)

1. Push/apply this patch in Lovable (dry-run → apply → build).
2. Lovable Cloud automatically runs the new migration on deploy. **Verify** in Database → Tables: `payments`, `payouts`, `payment_started`, `payment_settings`, `paused_workouts` exist AND `app_accounts` has `onboarding_step` + `onboarding_completed_at` columns.
3. If edge functions need redeploying: Cloud → Edge Functions → deploy all 3 (they're in the repo).
4. Confirm `COACH_GOOGLE_EMAIL` secret is the exact Gmail that should be the Coach.

## 4. Launch test

1. Open the deployed app → **Continue with Google** → sign in with the coach Gmail → lands in **Coach mode**.
2. Coach: create exercises + a program + workouts (saved to cloud `app_state`).
3. Sign out → open in a fresh browser/incognito → **Continue with Google** with any other Gmail → enters name + username → onboarding questions → Hell yeah → final message → Card/PayPal payment box → "Are you done with the payment?" → Yes → "Please wait for me to verify your payment."
4. Coach dashboard → **Pending payments** → enter provider transaction ID → **Verify & unlock** → client enters the app and sees the program.

## 5. Still local (device-only, follow-up)

- Chat images, program covers, progress pictures files (stored in IndexedDB on-device). Metadata/features work; cross-device media sync is a later phase.
- Payment Manager partner page (PayoutsPage) is coach-side in cloud; the payout-submit RPC supports a future payment_manager role.
- Broadcasts, legacy join requests (local; unused in the new payment flow).

## 6. Remix-proofing

After any Lovable remix: re-link Cloud (or the same Supabase project), re-set the `COACH_GOOGLE_EMAIL` secret, redeploy edge functions. Migrations already applied stay; new `supabase/migrations/` files auto-apply on the next deploy. `supabase/config.toml` is Lovable-managed — leave it.
