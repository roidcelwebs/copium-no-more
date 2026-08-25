# No More Copium — Coach Messaging Discussion Specification

Status: discussion backlog; not implemented.

Last updated: 2026-07-24

Related documents:

- `docs/ONBOARDING_DISCUSSION_SPEC.md`
- `docs/JOIN_REQUESTS_DISCUSSION_SPEC.md`

## Product goal

Add a new Coach-only bottom-navigation destination named **Messaging**. It will contain three sections/tabs:

1. **Conversations** — existing one-to-one Client conversations.
2. **Automations** — automated-message configuration, beginning with the Client-onboarding Final Sequence.
3. **Broadcasts** — future Coach messages sent to all or selected Clients.

Only the one authenticated non-preview Coach account may view or modify this configuration.

## Bottom navigation

Add a fourth Coach bottom-navigation item:

- Dashboard
- Program Manager
- Library
- Messaging

The page name and three-section structure are approved. The existing header Chat icon remains as a shortcut to Messaging → Conversations.

## Messaging page — initial feature

The first completed section will be named:

> Final Sequence

This section controls the ordered Coach messages sent when a Client reaches the final sequence of onboarding.

## Final Sequence editor

The Coach can:

- Add multiple messages.
- Edit each message.
- Delete messages.
- Choose the exact message order.
- Reorder messages without losing content.
- Preview the sequence in Client chat-bubble styling.
- Press **Save changes** to replace the active sequence.

Edits remain local to the form until the Coach presses **Save changes**. Saving requires a confirmation and atomically replaces the active sequence. There is no separate draft/publish workflow. If the Coach tries to leave with unsaved changes, show a discard-warning confirmation.

## Structured message content

Each final-sequence message should be stored as structured content rather than unsafe raw HTML.

A message contains an ordered list of content lines. Approved line types:

1. **Text line**
   - One input containing the text shown to the Client.

2. **External hyperlink line**
   - First input: the visible link text.
   - Second input: the destination URL.
   - The visible text renders blue in the Client's Coach-message bubble.
   - Tapping the blue text opens the configured URL in a new tab/window.

3. **Popup link line**
   - One input for the visible blue link text.
   - Tapping it opens the almost-full-screen in-app popup with an X.
   - Popup content remains empty for now and will be configurable in a later feature.

The Coach can add multiple lines of any approved type to the same message and reorder the lines.

## Hyperlink behavior and validation

Recommended implementation rules:

- Allow only valid `https://` and, if explicitly desired, `http://` destinations.
- Reject `javascript:`, `data:`, `file:`, malformed, and empty URLs.
- Never render Coach-entered HTML directly.
- Escape all visible text.
- Open external destinations in a new browser tab/window so onboarding state is preserved.
- Use `noopener noreferrer` for external links.
- Show the destination domain in the Coach preview/editor.
- Require visible link text and a valid URL before publishing.

External links must open in a new browser tab/window so the original onboarding state remains open.

## Runtime onboarding behavior

When a Client reaches the final sequence:

1. Load the currently published Final Sequence configuration.
2. Preserve its message and line order.
3. Insert each configured item as a real Coach chat message.
4. Render text lines normally.
5. Render hyperlink lines as blue clickable text.
6. Persist the actual sent messages so both Coach and Client see the same history later.
7. Never modify already-sent chat history when the Coach edits the template later.

Approved activation/versioning behavior:

- Unsaved form edits do not affect Clients.
- **Save changes** shows a confirmation and then creates a new active sequence version atomically.
- A Client receives one consistent active version when entering the final sequence.
- Later saved edits affect only Clients who have not yet entered the final sequence.
- Already-sent chat history never changes.
- Retries and refreshes must not duplicate sequence messages.

## Data model direction

Current local implementation:

- One active Final Sequence configuration stored in localStorage.
- Ordered structured messages and lines.
- Line type constrained to `text`, `external_link`, or `popup_link`.
- Incrementing version, updated timestamp, and atomic Save-changes replacement.
- Onboarding stores an encoded snapshot of each sent message, so later edits never alter chat history.

Future Cloud rebuild:

- Move the same structure to Coach-owned records with strict RLS or ownership-checked RPCs.
- Clients receive only the active version needed by the onboarding transaction, or the backend inserts the messages on their behalf.

## Existing placeholder interaction

The current hard-coded final message is:

```text
placeholder
placeholder
```

The second line currently opens an almost-full-screen empty popup. This behavior will remain available as the approved **Popup link line** type alongside ordinary text and external hyperlinks. The current popup remains empty until its content editor is specified later.

## Broadcasts — local implementation

Messaging → Broadcasts allows the Coach to send an immediate permanent chat message to all Clients or selected Clients.

Supported content:

- Up to 2,000 characters of text.
- Any number of validated HTTPS external links within practical UI limits.
- One to six processed WebP images.

Behavior:

- Confirmation shows the recipient count before sending.
- Each recipient receives a normal persistent Coach chat message.
- Existing unread-message behavior applies.
- Images are stored once in IndexedDB and referenced by every recipient message.
- Recent broadcast history is stored locally and shown to the Coach.
- Scheduling is intentionally unavailable because local delivery cannot run while the browser is closed.
- Cloud delivery status and production retries are deferred until the future Cloud rebuild.

## Discussion checklist

### Navigation and information architecture

- [x] Final page name: Messaging.
- [x] Existing one-to-one chats move into the Conversations section.
- [x] Keep the current header Chat icon as a shortcut to Messaging → Conversations.
- [x] Page sections/tabs: Conversations, Automations, Broadcasts.

### Final Sequence editing

- [x] Manual **Save changes** with confirmation; no separate draft/publish workflow.
- [x] Maximum 20 messages per sequence.
- [x] Maximum 20 lines per message.
- [x] Maximum 2,000 characters per line/link label and 2,048 URL characters.
- [x] Accessible move-up/move-down controls for messages and lines.
- [ ] Consider drag reorder as a later enhancement.
- [x] Delete confirmation; undo remains a possible later enhancement.
- [x] Preview uses the actual Client chat-bubble renderer.

### Hyperlinks

- [x] External links open in a new tab/window.
- [x] Only valid HTTPS external URLs are allowed.
- [ ] Internal No More Copium route links are not implemented yet.
- [x] Existing popup remains as a separate Popup link line type.

### Saving/versioning

- [x] Unsaved edits never affect live onboarding.
- [x] Save changes atomically creates/replaces the active version after confirmation.
- [x] Saved edits affect only Clients who have not entered the final sequence.
- [x] Already-sent history never changes.
- [ ] Ensure retries cannot duplicate final-sequence messages.

### Broadcasts

- [x] Recipients: all Clients or selected Clients.
- [x] Immediate delivery only in the local prototype.
- [x] Confirmation shows recipient count; sent broadcasts are not cancellable.
- [x] Broadcasts create persistent Coach chat messages and unread state.
- [x] Content supports text, validated HTTPS links, and one to six images.
- [ ] Browser verification remains.
