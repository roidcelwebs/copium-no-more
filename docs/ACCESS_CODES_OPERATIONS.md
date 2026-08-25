# No More Copium — Access Codes & Manual Onboarding Operations Guide

**Document Version:** 1.0 (SPEC v2 Final Operations Manual)  
**Target Role:** Coach / Business Owner  
**Last Updated:** 2026-08-25  

---

## 1. Overview & Purpose

No More Copium operates on a **Two-Track Voucher Model**:
1. **Track A (Storefront):** Potential clients land on the static landing page (`https://illustrious-lamington-77c77e.netlify.app` / `nomorecopium.us.kg`), review transformations and social proof, and DM the coach (WhatsApp, Instagram, Telegram, TikTok).
2. **DM Payment:** Client pays the $29/month subscription via Jakub's permanent Stripe/PayPal payment link.
3. **Track B (Access Code Voucher):** Once payment is confirmed, the coach generates a single-use 12-character access code in the app and sends it to the client in the DM.
4. **Instant Burn & Google Login:** The client enters the code on `/access`, which instantly burns the voucher, mints a 30-minute ticket, and guides the client through Google sign-up and profile setup.
5. **Interactive Texting & Approval:** The client enters the `/onboarding` chat, discusses their training history with the coach, and is approved when the coach assigns their customized workout program.

---

## 2. Generating Access Codes (Coach Workspace)

### How to Generate a Code
1. Log in to **Coach Mode** at `/access` using the discrete *"Coach?"* link and master password.
2. In the bottom navigation (or sidebar), tap **Access Codes** (`/coach/access-codes`).
3. In the **Generate Access Code** card:
   * **Note (Optional but recommended):** Enter a descriptor identifying the client and payment channel (e.g., `WhatsApp Dylan $29`, `IG Marcus Month 1`).
   * **Expiry:** Select lifetime (24 hours, **72 hours (Default)**, 7 days, or 30 days).
4. Tap **Generate access code**.
5. The **Code Reveal Dialog** pops up showing the 12-character formatted code (e.g. `7F2K-Q9Z4-M8XT`):
   * Tap **Copy code** to copy the code directly to your clipboard.
   * Tap **Done** to close the dialog.

> **CRITICAL SECURITY RULE:** The plaintext code is shown **exactly once** in this reveal dialog. It is stored in the database only as a one-way bcrypt hash. If you close the modal without copying or lose the code before sending it to the client, simply tap **Revoke** on that code and generate a new one.

---

## 3. DM Client Handoff Template

Once you copy the code, send the following message in the DM:

```text
Payment received! Welcome to No More Copium.

Here is your private, single-use access code to get started:
[INSERT-CODE-HERE]

To activate your account:
1. Open the app: https://nomorecopium.app (or current preview URL)
2. Tap "Create account"
3. Enter your 12-character access code
4. Sign in with your Google account and choose your username
5. Drop your first message in the onboarding chat, and I'll review and assign your custom program right away!
```

---

## 4. The Instant Burn & Voucher Mechanics

* **Instant Burn on Redemption:** When the client enters their code in the "Create account" modal and taps Submit, the server validates the code and **immediately stamps `redeemed_at = now()`**. The code itself is permanently burned at that exact millisecond.
* **The 30-Minute Ticket:** The server mints a crypto-random 64-hex ticket token stored temporarily in the client's browser session. This ticket allows the client to complete Google OAuth and profile setup (Name + Username) without needing to re-enter the code.
* **What if the client closes their browser before finishing?**
  * If a client redeems the code but closes their tab or cancels Google sign-in, the code cannot be entered again (it will report *"This code was already used"*).
  * **Solution:** This is normal and secure. As the coach, simply open `/coach/access-codes`, generate a fresh code, and send it to the client.

---

## 5. Security Thresholds & Abuse Prevention

* **72-Hour Lifetime:** If a code is never redeemed by a client, it expires automatically 72 hours after creation.
* **5 Failed Attempts Lockout:** If an attacker or unauthorized user enters 5 incorrect codes, that specific code is permanently marked `status = locked`.
* **IP Rate Limiting:** A global limit of **15 attempts per IP per 15 minutes** prevents automated brute-force attacks (returns HTTP `429 Too Many Requests`).
* **Instant Revocation:** If you ever issue a code to someone who requests a refund before activating, find the code prefix in `/coach/access-codes` and tap **Revoke**.

---

## 6. Coach Master Password & Secret Management

* **Login:** Open `/access` $\rightarrow$ Tap *"Coach? Sign in with your account password"* in the footer $\rightarrow$ Enter your 32-character master password.
* **Cloud Secret:** The Edge Functions verify this against the `COACH_ACCESS_HASH` secret in Lovable Cloud / Supabase.
* **To Change Your Password:**
  1. Generate a new bcrypt hash (cost 12) of your new master password string.
  2. Open Lovable Cloud / Supabase Dashboard $\rightarrow$ **Project Settings** $\rightarrow$ **Secrets**.
  3. Update `COACH_ACCESS_HASH` with the new hash.

---

## 7. Client Onboarding & Program Approval SOP

1. **Client Setup:** After Google sign-up, the client chooses their **Display Name** (1–80 characters) and **Username** (lowercase `a–z`, `0–9`, and `_` only).
2. **Onboarding Chat Screen (`/onboarding`):**
   * The client sees the single automated greeting:
     > *"Welcome to No More Copium, {name}. How many times a week do you usually work out right now, brother?"*
   * A persistent banner displays: *"Waiting for your coach to approve your program."*
   * The client cannot access the dashboard, workouts, or history until approved.
3. **Coach Review:**
   * Open **Coach Messaging** (`/coach/chat`) $\rightarrow$ Chat with the client in real-time about their lifting experience, height/weight, and target goals.
4. **Publishing & Unlocking:**
   * In **Client Management** (or the Messaging header for that client):
     1. Assign a workout program from your Program Library.
     2. Adjust any specific exercises, rep ranges, or rest times if needed.
     3. Click **Approve & Publish**.
   * The server freezes an isolated snapshot into `client_program_bundles` and sets `approved_at = now()`.
   * The client's screen immediately removes the waiting banner and opens full access to the Dashboard, Program Schedule, Guided Workout Player, and Workout History!

---

## 8. Cloud & Google OAuth Checklist

Ensure the following settings remain active in Supabase / Google Cloud:
* **Google OAuth Provider:** Enabled in Supabase Auth $\rightarrow$ Providers $\rightarrow$ Google.
* **Authorized Callback URI in Google Cloud Console:** `https://<supabase-project-ref>.supabase.co/auth/v1/callback` (and custom domain once live).
* **Disabled Providers:** Email and Phone authentication providers are disabled (Google OAuth is the sole client authentication provider).
