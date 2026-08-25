# No More Copium — Onboarding Discussion Specification

Status: discussion backlog; not all items are implemented.

Last updated: 2026-07-24

Current project source at the start of discussion:

- Repository: `https://github.com/nihalttmogs-beep/everything-attached`
- Commit: `57eccc3f0a25d0db6ed72949a45b058192adec62`
- Commit message: `Applied Cloud build patch`

## Non-negotiable behavior already designed

- Google authentication only.
- New users choose a name and unique username.
- Only the Google identity privately allowlisted by `COACH_GOOGLE_EMAIL` receives Coach access.
- Every other Google identity receives Client access.
- Every real Client and the Coach-owned Client Preview must complete onboarding once.
- The real Coach account bypasses Client onboarding.
- Onboarding uses the existing permanent Coach/Client Cloud chat, not a temporary fake conversation.
- The Client cannot type arbitrary text during onboarding.
- Each option selected by the Client is stored as a Client chat message.
- Every automated question and answer-dependent response is stored as a Coach chat message.
- Free-form Client chat remains blocked by the backend until onboarding is completed.
- Onboarding progress survives refresh, sign-out, closing the browser, and returning later.
- Incomplete Clients are redirected back to onboarding if they try to open normal Client routes.
- Completed onboarding history remains visible to both the Client and Coach in normal chat.

## Current blocking repair

Before adding further onboarding features, apply and verify:

- Patch: `APPLY_THIS_ONLY-fix-onboarding-thread-id-ambiguity-57eccc3.patch`
- Migration: `20260724143000_fix_onboarding_thread_id_ambiguity.sql`
- Purpose: fix PostgreSQL error `42702` (`thread_id` is ambiguous) in `initialize_client_onboarding` and `advance_client_onboarding`.

## Opening greeting

Coach message:

> Welcome to No More Copium, {name}.

## Question 1 — weekly training frequency

Coach question:

> How many times a week do you usually train?

### Option: `0–2 times a week`

Immediate Coach response:

> Love your honesty, brother. It doesn't matter if you're struggling with consistency. It doesn't matter if you've never worked out a day in your life. The unique program I'll send you will make sure you start small and slowly turn this into a habit.

### Option: `3–4 times a week`

Immediate Coach response:

> Three to four times a week is actually enough for you to achieve your goals. Proud of you, brother. We'll still try to progress toward training five to six times a week. However, we'll stick to three to four times a week if that's most convenient for you. After all, your training program will be uniquely personalized to you.

### Option: `5–6 times a week`

Immediate Coach response:

> Damn, brother. I'm proud and excited to work with you already. Mirin the consistency.

`Mirin` must be spelled exactly `M-I-R-I-N`.

After the immediate response, the Coach sends Question 2 as a separate message.

## Question 2 — training location

Coach question:

> Do you work out at the gym or at home with no equipment?

### Option: `Gym`

- No answer-dependent Coach response.
- Continue directly to Question 3.

### Option: `Home`

Immediate Coach response:

> I've helped clients who could only work out at home, but I still really recommend that you go to the gym. You don't have to stop working out and wait for the gym, though, because I have something really special for you.

After the response, the Coach sends Question 3 as a separate message.

## Question 3 — workout duration

Coach question:

> How long is your usual workout?

### Option: `Below 30 minutes`

Immediate Coach response:

> At least you show up, brother. We all start by just showing up.

### Option: `Around one hour`

Immediate Coach response:

> That's perfect. You'll progress to working out for longer, but one hour is still enough if that's the only convenient option for you.

### Option: `1.5–2 hours`

Immediate Coach response:

> That's perfect. After all, transforming your body in so many areas will make your workouts long.

After the immediate response, the Coach sends Question 4 as a separate message.

## Question 4 — exercise technique

Coach question:

> How is your exercise technique/form?

### Option: `Beginner / not the best`

Immediate Coach response:

> We all start with the most atrocious form on every exercise. This is not a problem at all.

### Option: `Experienced / correct form and technique`

Immediate Coach response:

> Perfect. That will help you progress even faster.

## New messages after Question 4

After the Client's Question 4 answer and its answer-dependent Coach response, send this separate Coach message:

> Can't wait to see your progress very, very soon, brother. So, are you ready to join No More Copium and get your personalized, unique training system? We can even modify your training program based on anything you let me know later on.

Then send another separate Coach message:

> Are you ready for the unfair advantage?

Show exactly one option:

- `Hell yeah`

When selected:

1. Store `Hell yeah` as a Client chat message.
2. Advance to the final sequence.

## Message ordering requirement

For Questions 1–4:

1. Client option is stored as a Client message.
2. Answer-dependent Coach response is sent immediately, if that option has one.
3. The next Coach question is sent as a separate message.

After Question 4:

1. Client answer.
2. Question 4 answer-dependent Coach response.
3. “Can't wait to see your progress…” Coach message.
4. “Are you ready for the unfair advantage?” Coach message.
5. Single `Hell yeah` option.
6. `Hell yeah` is stored as a Client message.
7. Final sequence begins.

No artificial waiting is required. Chronological ordering must be deterministic, and retries/refreshes must not duplicate messages.

## Payment context update and implementation boundary

The business ownership has changed. The current owner states that its legal review and KYC/compliance responsibilities have been handled. Prior founder-specific location, age, KYC, and personal-account circumstances must not be treated as current business facts or used to characterize the new owner.

A manual cryptocurrency-payment final sequence was proposed, including a personal/static wallet address, network-transfer instructions, screenshot-based confirmation, and Binance-account handling.

That specific manual workflow is **not approved for implementation in this project plan**. Do not implement personal-wallet collection, manual screenshot approval, or personal Binance-account payment handling.

The supported implementation direction is a verified merchant crypto-payment provider or approved merchant API that provides:

- Server-created payment orders/invoices.
- Provider-generated checkout, address, network, amount, and expiration details.
- Signed webhook verification.
- Confirmation-count and payment-status handling.
- Idempotent entitlement activation only after verified payment.
- Underpayment, overpayment, expiry, duplicate-webhook, refund, and support handling.
- No private key, seed phrase, merchant credential, or webhook secret in frontend code or GitHub.

No provider has been selected yet. Do not implement payment access until the owner identifies an approved merchant provider and the provider-neutral architecture is reviewed.

The final onboarding copy may later begin with:

> Complete the crypto payment, and we can start instantly.

But it must lead to a provider-generated secure checkout rather than a hard-coded personal wallet or screenshot-verification process.

## Existing final placeholder behavior

Until an approved merchant-provider checkout is selected, the Coach's final message remains:

```text
placeholder
placeholder
```

- First `placeholder`: ordinary text.
- Second `placeholder`: blue and clickable.
- Clicking it opens an almost-full-screen empty popup with an X.
- The popup remains empty for now.
- `Enter app` completes onboarding and opens the Client app.

## Planned Coach-controlled Final Sequence

A new Coach-only Messaging page will allow the Coach to replace the hard-coded final sequence with an explicitly published ordered list of messages. Messages may contain ordered plain-text lines and blue hyperlink lines. The final behavior, data model, publishing rules, and relationship to the existing popup are recorded in:

`docs/COACH_MESSAGING_DISCUSSION_SPEC.md`

Already-sent onboarding history must never change when the Coach edits a later template version.

## Planned Join Request and image-only approval stage

After the Final Sequence, Clients will remain in onboarding with free text disabled. They may send images. The first successful image creates a pending Coach Join Request. Only Coach approval completes onboarding and unlocks the Client app. The complete specification is stored in:

`docs/JOIN_REQUESTS_DISCUSSION_SPEC.md`

This is a generic application/join-request image-review feature, not financial or payment screenshot verification.

## Tomorrow checklist

### P0 — unblock current onboarding

- [ ] Apply the `thread_id` ambiguity patch.
- [ ] Apply the corrective migration exactly once.
- [ ] Confirm no generated duplicate migration remains.
- [ ] Confirm the repository has the expected canonical migration count.
- [ ] Confirm `initialize_client_onboarding` returns HTTP 200.
- [ ] Confirm PostgreSQL error `42702` is gone.
- [ ] Confirm the greeting and Question 1 appear.

### P1 — answer-dependent responses

- [ ] Add all three Question 1 response branches.
- [ ] Preserve exact spelling `Mirin`.
- [ ] Keep `Gym` with no response branch.
- [ ] Add the `Home` response branch.
- [ ] Add all three Question 3 response branches.
- [ ] Add both Question 4 response branches.
- [ ] Store every automated response in permanent chat.
- [ ] Keep question/response ordering deterministic.
- [ ] Make retries idempotent and prevent duplicate messages.

### P2 — final readiness sequence

- [ ] Add the “Can't wait to see your progress…” message.
- [ ] Add “Are you ready for the unfair advantage?” as a separate Coach message.
- [ ] Add the single `Hell yeah` option.
- [ ] Store `Hell yeah` as a Client message.
- [ ] Continue to the existing non-payment placeholder sequence.

### P3 — QA

- [ ] Test every Question 1 branch.
- [ ] Test both Question 2 branches.
- [ ] Confirm `Gym` skips its personalized response.
- [ ] Test every Question 3 branch.
- [ ] Test both Question 4 branches.
- [ ] Test refresh/resume after every step.
- [ ] Confirm no duplicate messages after retry.
- [ ] Confirm the Coach sees all onboarding messages.
- [ ] Confirm normal Client chat preserves the full onboarding history.
- [ ] Confirm free-form chat is blocked before completion and enabled afterward.
- [ ] Consider a Coach-only reset for Client Preview onboarding so all branches can be tested repeatedly.

### P4 — merchant crypto checkout discussion

- [ ] Current owner selects a verified merchant crypto-payment provider or approved merchant API.
- [ ] Confirm the provider supports the owner's legal entity, jurisdiction, settlement, and required currencies/networks.
- [ ] Design server-created payment orders with amount, network, address, and expiry supplied by the provider.
- [ ] Design signed webhook verification and idempotent payment-state handling.
- [ ] Define pending, confirmed, expired, underpaid, overpaid, refunded, and disputed states.
- [ ] Keep all merchant credentials and webhook secrets out of frontend code, GitHub, and ordinary chat.
- [ ] Replace the placeholder only after the provider integration and entitlement rules are approved.
