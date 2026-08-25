# No More Copium — Join Requests and Image-Only Pending Onboarding

Status: implemented for the local-only browser prototype; production Cloud implementation is deferred.

Last updated: 2026-07-24

Related documents:

- `docs/ONBOARDING_DISCUSSION_SPEC.md`
- `docs/COACH_MESSAGING_DISCUSSION_SPEC.md`

## Product intent

After a Client completes every onboarding question, receives the answer-dependent Coach responses, selects `Hell yeah`, and receives the full Coach-controlled Final Sequence, the Client does **not** enter normal Client mode immediately.

The Client remains in the full-screen onboarding chat in a new state:

> Awaiting Coach approval

In this state:

- Client free-text messaging remains disabled.
- The Client may upload and send images in the chat.
- The Client may send additional images while waiting.
- Coach text messages remain visible to the Client in real time.
- The Client cannot access ordinary Client routes until approved.

This feature must be treated as a generic application/join-request image-review system. It must not be used as screenshot-based financial or payment verification.

## End-of-onboarding state transition

Proposed state machine:

1. `profile_required`
2. `questions_in_progress`
3. `final_sequence_in_progress`
4. `awaiting_first_image`
5. `pending_coach_approval`
6. `approved`

Behavior:

- Completing the final sequence moves the Client to `awaiting_first_image`.
- The existing `Enter app` button is removed from this point in the flow.
- An image-only chat composer appears at the bottom.
- The first successfully committed image creates a Join Request and changes the Client to `pending_coach_approval`.
- Additional images remain allowed while pending.
- Only Coach approval changes the Client to `approved` and sets onboarding completion.

## Client onboarding chat after the Final Sequence

The bottom composer contains:

- Add image / camera-gallery control.
- Selected-image previews before sending.
- Remove-from-staging controls.
- Send images action.
- No text input.
- No free-text send button.

Approved media behavior:

- Allow unlimited image messages over time.
- Allow one to six images in a single send.
- Accept common mobile image inputs.
- Process output to metadata-stripped WebP.
- Maximum long edge: 1920px.
- Maximum processed output: 2.5 MB per image.
- Preserve orientation correctly.
- Show upload progress and retry state.
- Do not create a Join Request until at least one image and its chat metadata commit successfully.

## Client waiting experience

After the first image is sent:

- Show a persistent `Awaiting Coach approval` status in the onboarding chat.
- Keep the full onboarding and Final Sequence history visible.
- Keep all submitted images visible as image chat bubbles.
- Continue receiving Coach text messages through Realtime.
- Continue allowing additional images.
- Continue blocking Client free text.

Approval behavior:

- If approval arrives while the Client is currently viewing onboarding, redirect to the Client dashboard immediately.
- If the Client is offline or has closed the app, the next opening routes directly to the Client dashboard.
- Approval must be idempotent; repeated approval requests cannot duplicate state changes.

## Coach Dashboard — Join Requests section

Add a Coach Dashboard section titled exactly:

> Join Requests

A Client appears in this section only when:

1. The Client has reached the end of the Final Sequence.
2. The Client has successfully sent at least one image.
3. The Client has not yet been approved.

Each list item should show:

- Client name.
- Username.
- Request time.
- Number of submitted images.
- Unread-message indicator if applicable.
- Optional latest-image thumbnail if safe and useful.
- A clear `Preview` label when the request belongs to the Coach-owned Client Preview.

Client Preview requests appear in the same Join Requests list as real Clients but must be visibly labeled `Preview` so they cannot be mistaken for a real request.

Recommended ordering:

- Oldest pending request first, so requests are not forgotten.

Empty state:

> No pending join requests.

## Join Request detail

Tapping a Client opens that Client's complete conversation, including:

- Opening onboarding greeting.
- Every onboarding question.
- Every selected Client option.
- Every answer-dependent automated Coach response.
- Readiness messages and `Hell yeah`.
- The complete Coach-controlled Final Sequence.
- Every image sent by the Client.
- Any manual Coach messages sent while the Client waits.

Approved Coach actions:

- Send normal text messages to the waiting Client.
- Review full-size images.
- Navigate between images.
- Approve the Client.

There is no dedicated Reject or Request-more-images action. The Coach can ask for additional images through ordinary Coach text messages while the Client continues to have image-only replies.

Approval should require a confirmation dialog:

> Approve this Client and unlock the app?

Confirmed approval:

- Marks the Join Request approved.
- Sets onboarding completion.
- Unlocks normal Client routes.
- Enables normal Client free-text chat.
- Removes the request from the pending Join Requests list.
- Preserves the request and conversation history for audit/history purposes.

## Image messages in permanent chat

Images are permanent chat content and must still be visible after approval.

After approval, normal Client chat supports both free-text messages and image messages. The same secure chat-image pipeline is reused; approval adds text capability rather than removing image capability.

Recommended schema direction:

- Extend chat messages with a safe message kind, or add a linked chat-attachment table.
- Store attachment metadata separately from message text.
- Associate every attachment with one chat message, thread, sender account, and Client.
- Keep the original chat order deterministic.
- Generate private signed URLs for reads.

Recommended Storage architecture:

- New private bucket: `chat-images`.
- Do not reuse `progress-pictures`; chat media and progress-picture media have different ownership/lifecycle semantics.
- Upload through an authenticated Edge Function.
- Validate that the authenticated user owns the active Client account.
- Validate that Client image upload is allowed only in the appropriate onboarding/pending state, or in a future explicitly approved normal-chat media state.
- Validate dimensions, file signature, MIME type, processed size, path ownership, and message linkage.
- Never trust a Client-supplied account ID without backend ownership verification.

## Recommended Cloud records

A `client_join_requests` record should include:

- Client account ID.
- Chat thread ID.
- Status.
- Requested timestamp.
- Approved timestamp.
- Approving Coach account ID.
- Updated timestamp.

Approved statuses:

- `pending`
- `approved`

No rejection status is required.

## Security and integrity requirements

- Only the authenticated owning Client may submit onboarding images for that Client account.
- Only the one authenticated non-preview Coach may list and approve Join Requests.
- A Client cannot approve itself.
- Direct route navigation cannot bypass approval.
- Direct RPC/API calls cannot bypass approval.
- First-image upload and Join Request creation must be transactional/idempotent where practical.
- Repeated upload retries cannot create duplicate chat messages or duplicate Join Requests.
- Approval is idempotent.
- Signed image URLs must be short-lived.
- Buckets remain private.
- Image metadata must be stripped during processing.

## Relationship to current behavior

Current implemented behavior contains an `Enter app` button after the hard-coded final placeholder. When this feature is implemented:

- Remove that immediate completion behavior.
- Replace it with the image-only pending state.
- Set `onboarding_completed_at` only after Coach approval.
- Continue showing the onboarding chat until approval.

## Confirmed decisions

- Coach action is Approve only, plus ordinary Coach text messages.
- No dedicated reject or request-more-images action.
- One to six images per send, with unlimited sends over time.
- Image sending remains available in normal chat after approval.
- Client Preview appears in the normal Join Requests list with a clear `Preview` label.

## Open decisions

- Whether Clients may delete an image before approval.
- Whether the Join Requests list uses oldest-first or newest-first ordering.
- Whether a latest-image thumbnail appears in the list.
- Exact accepted input formats.

## Implementation checklist

### Client flow

- [ ] Replace `Enter app` with image-only pending onboarding.
- [ ] Add camera/gallery image staging.
- [ ] Add image preview and remove controls.
- [ ] Add authenticated image upload.
- [ ] Add permanent image chat bubbles.
- [ ] Create Join Request after first successful image.
- [ ] Allow one to six images per send and unlimited sends while pending.
- [ ] Keep free text blocked.
- [ ] Show Awaiting Coach approval status.
- [ ] Redirect immediately when approval arrives through Realtime.
- [ ] Route to dashboard on the next visit after approval.

### Coach flow

- [ ] Add Join Requests to Coach Dashboard.
- [ ] Add pending request count.
- [ ] Add pending Client list.
- [ ] Add complete conversation/image review.
- [ ] Keep normal Coach text messaging enabled.
- [ ] Add approval confirmation.
- [ ] Add idempotent approval RPC.
- [ ] Remove approved requests from the pending list.
- [ ] Label Client Preview requests clearly as `Preview`.

### Cloud

- [ ] Add Join Request table/state.
- [ ] Add image-attachment metadata.
- [ ] Create private `chat-images` bucket.
- [ ] Add authenticated media Edge Function.
- [ ] Add strict RLS/ownership RPCs.
- [ ] Add Realtime Join Request updates.
- [ ] Add signed image reads.
- [ ] Add idempotency protection.

### QA

- [ ] Client cannot send text while pending.
- [ ] Client can send one image.
- [ ] Client can send multiple images.
- [ ] Refresh does not duplicate uploads or requests.
- [ ] Coach sees request and complete history.
- [ ] Coach messages appear to waiting Client.
- [ ] Approval unlocks routes immediately.
- [ ] Offline Client enters dashboard on return after approval.
- [ ] Normal chat preserves onboarding images after approval.
- [ ] Normal approved Client chat can send both text and images.
- [ ] Client Preview can exercise the same flow and is visibly labeled in Join Requests.
