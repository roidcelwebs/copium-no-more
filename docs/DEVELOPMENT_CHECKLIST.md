# No More Copium — Local Prototype Development Checklist

Last updated: 2026-07-27

Current repository: `https://github.com/roidceldev-spec/remix-of-everything-attached`

Current architecture: fully local browser prototype. Lovable is used only for preview, publishing, GitHub synchronization, and patch application. Supabase/Lovable Cloud runtime code is disabled and archived under `cloud-archive/supabase/`.

Detailed requirement sources:

- `docs/ONBOARDING_DISCUSSION_SPEC.md`
- `docs/COACH_MESSAGING_DISCUSSION_SPEC.md`
- `docs/JOIN_REQUESTS_DISCUSSION_SPEC.md`

Cloud-specific requirements inside those historical documents are deferred until the production Cloud rebuild. Product copy, sequencing, UI behavior, and permission rules remain authoritative unless this checklist explicitly adapts them to local-only development.

## Current project comparison

### Implemented and verified

- [x] Fully local passwordless account picker.
- [x] Visible Coach/Client role choice.
- [x] Exactly one local Coach allowed.
- [x] Coach must be created before Clients.
- [x] Local account switching.
- [x] Local Coach programs, exercises, workouts, units, and assignments.
- [x] Local Workout History.
- [x] Local Coach/Client chat on the same browser.
- [x] Local onboarding progress and chat history.
- [x] Client free text blocked before onboarding completion.
- [x] Progress Picture metadata stored locally.
- [x] Progress Picture files stored in IndexedDB.
- [x] Program covers stored in IndexedDB.
- [x] Previous Cloud source preserved under `cloud-archive/supabase/`.
- [x] Runtime Supabase and managed-auth dependencies removed.

### Existing basic onboarding

- [x] Greeting uses the Client's name.
- [x] Question 1 and its three options.
- [x] Question 2 and its two options.
- [x] Question 3 and its three options.
- [x] Question 4 and its two options.
- [x] Selected options persist as Client chat messages.
- [x] Coach questions persist as Coach chat messages.
- [x] Final two-line placeholder message.
- [x] Second placeholder opens the almost-full-screen empty popup.
- [x] Enter app completes onboarding.

## Feature 1 — Personalized onboarding and readiness sequence

Status: implemented locally in the current development patch; requires deployment and browser verification.

- [x] `0–2 times a week` personalized response.
- [x] `3–4 times a week` personalized response.
- [x] `5–6 times a week` personalized response.
- [x] Preserve exact spelling `Mirin`.
- [x] `Gym` intentionally skips a personalized response.
- [x] `Home` personalized response.
- [x] `Below 30 minutes` personalized response.
- [x] `Around one hour` personalized response.
- [x] `1.5–2 hours` personalized response.
- [x] `Beginner / not the best` personalized response.
- [x] `Experienced / correct form and technique` personalized response.
- [x] Send each personalized response immediately after the matching Client answer.
- [x] Send each next question as a separate Coach message.
- [x] Add the “Can't wait to see your progress…” readiness message.
- [x] Add “Are you ready for the unfair advantage?” as a separate Coach message.
- [x] Add exactly one option: `Hell yeah`.
- [x] Persist `Hell yeah` as a Client message.
- [x] Send the existing final placeholder sequence after `Hell yeah`.
- [x] Use deterministic onboarding message IDs to prevent duplicate messages after retries.
- [ ] Browser-test every branch.
- [ ] Refresh after every step and confirm correct resume behavior.
- [ ] Confirm no duplicate messages after retry.

## Feature 2 — Coach Messaging page shell

Status: implemented; requires deployment and browser verification.

- [x] Add fourth Coach bottom-navigation item: Messaging.
- [x] Add sections/tabs: Conversations, Automations, Broadcasts.
- [x] Move existing one-to-one chat inbox into Conversations.
- [x] Keep the header Chat icon as a shortcut to Messaging.
- [x] Add Automations landing section with Final Sequence as the next feature.
- [x] Add Broadcasts placeholder until broadcast behavior is fully specified.
- [ ] Browser-test navigation, tabs, chat detail return path, and mobile four-item layout.

## Feature 3 — Coach-controlled Final Sequence editor

Status: implemented; requires deployment and browser verification.

- [x] Add Final Sequence section under Messaging → Automations.
- [x] Add multiple messages.
- [x] Edit messages.
- [x] Delete messages with confirmation.
- [x] Reorder messages with accessible move controls.
- [x] Add plain-text lines.
- [x] Add external-link lines with visible text and URL fields.
- [x] Open external links in a new tab with `noopener noreferrer`.
- [x] Allow only valid `https://` external URLs.
- [x] Add popup-link lines that open the existing almost-full-screen popup.
- [x] Reorder lines inside a message.
- [x] Preview messages using Client chat-bubble styling.
- [x] Add manual Save changes action with confirmation.
- [x] Warn before closing the page with unsaved changes.
- [x] Save active sequence versions locally.
- [x] Capture one consistent active version when a Client enters the final sequence.
- [x] Never alter already-sent history.
- [x] Use versioned deterministic message IDs to prevent retry duplicates.
- [x] Maximum 20 messages, 20 lines per message, 2,000 characters per line, and 2,048 URL characters.
- [ ] Browser-test editing, validation, preview, save, external links, popup links, and onboarding delivery.
- [ ] Consider drag-and-drop later; accessible move-up/down controls are implemented now.
- [ ] Consider undo later; delete confirmation is implemented now.

## Feature 4 — Local image chat and Join Requests

Status: implemented; requires deployment and browser verification.

Local-only adaptation: image blobs and request metadata use IndexedDB/localStorage instead of Cloud Storage/RLS/Edge Functions. Cross-device behavior is intentionally unavailable until Cloud is rebuilt.

### Client

- [x] Replace immediate Enter app with post-final-sequence image-only waiting state.
- [x] Keep Client free text disabled while waiting.
- [x] Add camera/gallery controls.
- [x] Allow one to six images per send.
- [x] Allow unlimited sends over time within browser storage capacity.
- [x] Process metadata-stripped WebP, maximum 1920px edge and 2.5 MB each.
- [x] Store chat image blobs in IndexedDB.
- [x] Store image message metadata locally.
- [x] Create one pending Join Request after the first successful image.
- [x] Allow additional images while pending.
- [x] Show Awaiting Coach approval.
- [x] Preserve full onboarding history and images.

### Coach

- [x] Add Join Requests section to Coach Dashboard.
- [x] Show pending count.
- [x] List name, username, request time, image count, and unread state.
- [x] Label test/local preview requests clearly if a preview account is reintroduced.
- [x] Open complete conversation and images.
- [x] Allow ordinary Coach text messages while Client replies remain image-only.
- [x] Add Approve-only action.
- [x] Add approval confirmation: “Approve this Client and unlock the app?”
- [x] Make approval idempotent.
- [x] Remove approved requests from pending list.
- [x] Unlock normal Client routes after approval.
- [x] Enable Client free text after approval.
- [x] Keep image sending available after approval.

### Feature 4 browser verification

- [ ] Test one-image and six-image sends.
- [ ] Test staging removal and image-processing errors.
- [ ] Confirm first image creates one pending Join Request.
- [ ] Confirm additional images do not duplicate the request.
- [ ] Confirm pending Client has image-only replies and no free text.
- [ ] Confirm Coach sees full history and full-size images.
- [ ] Confirm Approve requires confirmation and unlocks the Client.
- [ ] Confirm approved normal chat supports both text and images.
- [ ] Confirm refresh preserves images, request state, and approval.

## Feature 5 — Broadcasts

Status: implemented; requires deployment and browser verification.

- [x] Coach can choose all Clients or selected Clients.
- [x] Immediate delivery only in the local prototype.
- [x] Every recipient receives a permanent Coach chat message and unread state.
- [x] Broadcast editor supports text, HTTPS external links, and one to six images.
- [x] Confirmation displays the recipient count before sending.
- [x] One broadcast ID produces deterministic per-Client message IDs.
- [x] Images are stored once in IndexedDB and referenced by every recipient message.
- [x] Recent local broadcast history is displayed.
- [ ] Browser-test all/selected recipients, links, images, confirmation, chat delivery, unread state, and refresh persistence.
- [ ] Scheduling remains intentionally unavailable while the prototype is local-only.

## Feature 6 — Local development utilities

Status: implemented; requires deployment and browser verification.

- [x] Coach-only Reset Client onboarding action with confirmation.
- [x] Reset removes that Client's local chat, image attachments, reads, Join Request, completion, and onboarding progress.
- [x] Export all No More Copium localStorage data and IndexedDB blobs to one JSON backup.
- [x] Validate and import a backup after destructive confirmation.
- [x] Reject unsupported, oversized, malformed, or invalid-image backup data before clearing current data.
- [x] Add a clear Local prototype indicator in Settings.
- [x] Explain that data exists only in this browser.
- [x] Add Clear all local test data with explicit destructive confirmation.
- [x] Clear all No More Copium localStorage keys and IndexedDB blobs.
- [ ] Browser-test export/download, import/restore, reset, clear, and mobile Settings scrolling.

## Feature 7 — Landing and universal UI overhaul

Status: implemented in development; requires deployment and browser verification.

- [x] Enforce the `JFL, look at this.` 1rem minimum text size universally.
- [x] Preserve larger headings and display typography.
- [x] Keep each rotating headline static for exactly 1,000ms.
- [x] Use a simultaneous 500ms outgoing/incoming vertical transition.
- [x] Remove normal-motion opacity overlap and mismatched easing.
- [x] Add a smooth multi-stop image-to-black blend to Sections 1 and 2.
- [x] Preserve Section 3 gradient.
- [x] Keep the price title at the top with `$29/month` highlighted red.
- [x] Replace six bullet points with compact bordered value cards.
- [x] Put highlighted lead and unhighlighted body on separate lines.
- [x] Add six approved minimal red icons.
- [x] Preserve exact value-card order and copy.
- [x] Replace the Section 1 white image placeholder with all three approved testimonials.
- [x] Keep testimonial proof static so it does not compete with the rotating headline.
- [x] Remove the landing transformation's colored gradient wipe.
- [x] Preserve only approved black transparent gradients on the landing experience.
- [ ] Browser-test animation timing, fades, testimonials, minimum text size, card fit, icons, and Android viewport clipping.

Detailed specifications:

- `docs/LANDING_UI_OVERHAUL_SPEC.md`
- `docs/UI_UX_OVERHAUL_MAP.md`

## Deferred production work

- [ ] Rebuild real authentication.
- [ ] Rebuild private production RLS.
- [ ] Rebuild cross-device accounts and chat.
- [ ] Rebuild private media Storage.
- [ ] Rebuild Edge Functions and Realtime.
- [ ] Migrate selected local prototype structures to the new Cloud model.
- [ ] Select and integrate an approved merchant payment provider if required.

## Local feature execution status

1. Feature 1 implemented; browser verification remains.
2. Feature 2 implemented; browser verification remains.
3. Feature 3 implemented; browser verification remains.
4. Feature 4 implemented; browser verification remains.
5. Feature 5 implemented; browser verification remains.
6. Feature 6 implemented; browser verification remains.

The next development work should come from new product requirements or targeted browser-test findings. Production Cloud work remains deferred.
