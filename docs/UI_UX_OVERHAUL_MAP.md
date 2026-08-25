# No More Copium — UI and UX Overhaul Map

Status: Stage 1, Stage 2, Stage 3, Stage 4, Stage 5, Stage 6, Stage 7, Stage 8 and Stage 9 implemented in development; deployment and browser verification required. UI/UX overhaul complete.

Last updated: 2026-07-27

## Product scope

- The overhaul prioritizes the public landing experience and what normal Clients see.
- Coach Mode does not require a dedicated visual overhaul.
- Universal improvements may also affect Coach Mode when sharing them makes the implementation simpler and more consistent.
- Coach Mode appearance is not a priority.
- Conversion and retention should come from clear value, credible proof, trust, personalization, visible progress, and excellent usability rather than deceptive billing or obstructive cancellation.

## Universal attributes

### Visual hierarchy

Every stage must establish a deliberate order of attention, keep primary actions obvious, and avoid competing motion or decoration.

### Color gradients

- Colored gradients are prohibited.
- Black transparent gradients are the only allowed gradients.

### Emojis

- Emojis are prohibited throughout the web app UI.

### Badges

Every Client-facing stage must update the badge-like elements on that surface. Before the loading and error stages, run one final whole-app audit that also covers shared Coach surfaces.

- Reduce overly rounded, blob-like corners.
- Do not change badge copy, color, spacing, behavior, or any other attribute.
- Known examples include the Coach/Client Mode badge and Classic Workout set-information badges.
- The initial source audit found the shared Badge component plus additional badge-like pills across account, workout, program, and navigation surfaces; visual changes remain deferred to their ordered stages rather than being mixed into the landing patch.

## Required development order

Each patch focuses on one stage. A stage may be split into smaller patches when that is necessary for quality.

1. **Landing page overhaul** — implemented in development.
   - No skeleton loading is required before the user leaves the public/access experience for onboarding.
2. **Client Mode dashboard UI and UX** — implemented in development.
3. **Chat system UI and UX** — implemented in development.
4. **Onboarding UI and UX** — implemented in development.
5. **Classic workout mode UI and UX** — implemented in development.
6. **Guided workout mode UI and UX** — implemented in development.
7. **Workout History** — list and calendar views — implemented in development.
8. **Loading state** — implemented in development.
   - Skeleton loading must use a slow, steady shimmer wave moving from left to right.
9. **Error state** — implemented in development.

## Stage 1 — landing page

### First page testimonials

Replace the planned hero image placeholder with these three testimonials, preserving order and wording:

> “Hal saved my life”
>
> — Tushar

> “Holy shit I haven’t trained in 2 weeks and my wrists are still 18 cm when I measured. It's not just swelling.”
>
> — Garret

> “5' 5 - 5' 10 with No More Copium 1-1 coaching. Every dollar was worth it”
>
> — Dylan

Presentation format:

1. Quote.
2. Em dash and the name of the person who gave the testimonial.

Implementation decisions:

- All three testimonials remain visible at once; there is no carousel or additional competing animation.
- The proof stack uses compact typography and viewport-relative spacing so it fits short Android viewports without reducing text below the universal 1rem floor.
- The approved proportional headline, supporting line, and swipe-cue grid remains intact.
- The dark testimonial background continues into black using only the approved black transparent fade.
- The transformation wipe uses a solid red line rather than a prohibited colored gradient.

## Stage 2 — Client Mode dashboard

Status: implemented in development.

- Top-left greeting using local timezone detection via `Date`. Preserves exact required phrase `Fighting crime? {name}` for 1-5 AM. Other time buckets use friendly human variants that rotate deterministically by day to avoid AI-like repetition.
- Greeting hierarchy: large clamp headline, left-aligned, with supporting line "Here is what is lined up for you today."
- Unread coach messages: prominent min-h-12 link, rounded-xl, primary/10 background, 8px icon container, 1rem text, accessible focus.
- Today's workout: clear hierarchy — weekday label + "Today's workout" heading both 1rem-semibold, card rounded-xl with subtle shadow, workout name line-clamp-2 with title fallback, program name muted, Start workout button min-h-12 rounded-xl full-width on mobile, sm:auto, Play icon.
- TodayState (rest / no program / unavailable): rounded-xl dashed, 1.125rem title, 1rem description, muted background.
- Progress Pictures dashboard: heading 1.125rem-semibold, description 1rem, grid gap 2.5, tiles rounded-lg, habit progress rounded-lg, min-h-12 touch targets, text 1rem throughout, error container rounded-xl, Take pictures button min-h-12 rounded-xl.
- Badge audit for this surface: reduced overly rounded `rounded-full` Client Preview and Coach Mode badges to `rounded-md`. Bottom navigation items increased min-height to 56px and text to 13px-> enforced to 1rem via universal floor, with safe-area padding preserved.
- No colored gradients, no emojis.
- Large touch targets: all primary actions min-h-12, navigation 56px.
- Safe-area, keyboard, screen-reader, reduced-motion preserved.
- Visual hierarchy: greeting → unread → today's workout → progress pictures.

## Stage 3 — Chat system

Status: implemented in development.

- **Message bubbles:** Reduced blob-like `rounded-2xl` to `rounded-xl` with small tail (`rounded-br-sm`/`rounded-bl-sm`), padding `px-3.5 py-2.5`, body text `1rem` `leading-6`, shadow subtle, attachments grid gap 2, image buttons `rounded-lg`, full-screen dialog `rounded-xl`, timestamp `0.8125rem` (floored to 1rem via universal floor) tabular-nums.
- **Chat Conversation:** Back button `min-h-11 min-w-11` `rounded-xl` for 44px touch target, header title `1.125rem` semibold, username `1rem`, pending join request banner `rounded-xl` with title/description `1rem`, message list `space-y-3.5 py-5`, loading/empty states `rounded-xl` `1rem`+ hierarchy, error inline now tells what happened why what to do next (local storage unavailable/full), composer sticky `bottom-[calc(4rem+env(safe-area-inset-bottom))]` `rounded-xl` `p-2.5`, textarea `min-h-12` `rounded-xl` `py-3` `text-[1rem]`, send button `min-h-12 min-w-12` `rounded-xl`, char count `0.875rem` (floored).
- **Coach Chat Inbox:** Header `1rem` description, loading/error/empty all `rounded-xl` `1rem`, list `rounded-xl`, each conversation `px-4 py-3.5`, name/username/lastMessage all `1rem`, unread badge `rounded-md` (was `rounded-full`) `min-h-5 min-w-5` `text-[0.75rem]`, timestamp `0.8125rem`, chevron 5w5, safe hover.
- **Chat Button:** Increased to `min-h-11 min-w-11` `rounded-xl`, badge `rounded-md` `min-h-5 min-w-5` `text-[0.75rem]` (was `rounded-full` `text-[9px]`), preserves unread count logic.
- **Coach Messaging Page:** Title/description `1rem`, TabsList `rounded-xl` `p-1`, TabsTrigger `min-h-11` `rounded-lg` `px-3 py-2.5` `text-[1rem]` medium, icons 5w5, large touch targets.
- **Universal for this surface:** No colored gradients, no emojis, system font already global, 1rem floor enforced via existing CSS, large touch targets 44px+, safe-area handling, keyboard focus rings, screen-reader labels preserved, reduced-motion respected.
- **Error UX improvement:** Conversation load and send errors now explain local storage unavailability/full as reason and suggest checking device storage and retrying, instead of bare "could not be sent".

## Stage 4 — Onboarding

Status: implemented in development.

- **Header:** `min-h-16` with `env(safe-area-inset-top)` padding, title `1.125rem` semibold tracking `-0.01em`, username `1rem` leading-5, left-aligned, border-b with backdrop-blur preserved.
- **Message list:** `min-h-0 flex-1 overflow-y-auto overscroll-contain`, container `max-w-3xl space-y-3.5 px-4 py-5` `aria-live=polite`, reuses Stage 3 bubble overhaul (rounded-xl, 1rem, shadow).
- **Loading:** `gap-2.5 text-[1rem] leading-6` with `h-5 w-5 animate-spin` for better visibility.
- **Error states:** `rounded-xl border-destructive/40 bg-destructive/5 px-4 py-3 text-[1rem] leading-5`, explains what happened why what to do next (local storage unavailable, check storage, try refreshing), Try again button `min-h-9 rounded-lg border-destructive/30 px-3 py-1.5 text-[1rem]` with focus ring.
- **Question options:** Grid `gap-2.5` `aria-label=prompt`, each option Button `min-h-12 h-auto justify-start rounded-xl border-border bg-card px-4 py-3.5 text-left text-[1rem] font-medium leading-6 tracking-[-0.01em] whitespace-normal shadow` hover accent, focus ring 2. Preserves exact option copy from onboarding spec, including `Mirin` spelling.
- **Join Request / Image stage (step 6):** Container `rounded-xl bg-muted/30 px-4 py-3.5`, title `1rem` semibold leading-5, description `1rem` leading-5 with expanded friendly copy explaining free-text disabled and ability to continue sending images. Image upload dialog reused, button already min-h-12 from Stage 2.
- **Footer:** `shrink-0 border-t bg-background px-4 pt-3` `paddingBottom calc(1rem + env(safe-area-inset-bottom))` for safe-area, `space-y-3`, max-w-3xl centered.
- **Universal:** No colored gradients, no emojis, system font global, 1rem floor enforced, large touch targets 44px+ (options min-h-12, header min-h-16, retry button min-h-9), safe-area top+bottom, keyboard/screen-reader, reduced-motion respected.
- **Visual hierarchy:** header (coach identity) → conversation history → error (if any) → question options OR join-request image stage, with deterministic chronological ordering preserved from onboarding spec.

## Stage 5 — Classic workout mode

Status: implemented in development.

- **PreviewHeader:** `sticky top-0` with `env(safe-area-inset-top)` `py-3.5`, title `1.125rem` tracking-tight, subtitle `1rem`, timer `rounded-md px-2.5 py-1 text-[0.875rem]` tabular-nums, Guided button `min-h-10 rounded-lg text-[1rem]`, exit button `min-h-11 min-w-11 rounded-xl h-5 w-5`.
- **ModeChooser:** `min-h-full max-w-md gap-8 p-6` with safe-area padding, label `0.8125rem` uppercase, headline clamp `1.5rem-2rem` tight, prompt `1rem leading-6`, cards `min-h-16 rounded-xl border bg-card p-5 shadow[0_1px_2px]` title `1.125rem` tight, description `1rem leading-5`, chevron 5w5, back button `min-h-11 rounded-xl text-[1rem]`.
- **ClassicMode container:** `space-y-6 p-4`, selecting info `rounded-xl px-4 py-3 text-[1rem]`, exercise sections `rounded-xl border bg-card p-5 shadow[0_1px_2px]`, heading `1.125rem` tight, notes `rounded-lg bg-muted/40 px-3.5 py-2.5` title `0.8125rem` uppercase desc `1rem leading-5`, set list `mt-4 space-y-3`.
- **ClassicSetRow (core):** Outer `rounded-xl border p-4 shadow[0_1px_2px] transition` `bg-card` vs `border-primary/60 bg-primary/5` when completed, `ring-2 primary/30` when selected. Set label `1rem font-medium`. Complete button `min-h-10 rounded-lg px-3 py-1.5 text-[1rem]` icon h-4. Chips `rounded-md px-2.5 py-1 text-[0.75rem] font-medium uppercase tracking-wide` (was `rounded-full text-[10px]` blob). Suggested weight range `rounded-lg border bg-muted/30 px-3.5 py-2.5` title `0.8125rem` uppercase value `1rem leading-5 semibold tabular-nums`. Notes from coach same pattern `rounded-lg bg-muted/40`. Labels Weight/Reps/Notes `1rem font-medium leading-5 muted`. Inputs `min-h-12 rounded-xl text-[1rem]` via large variant. Textarea `min-h-12 resize-y rounded-xl py-3 text-[1rem] leading-6`. Buttons Finish workout / Select set / Cancel `min-h-12 rounded-xl text-[1rem] font-semibold` w-full grid `gap-2.5`.
- **Badge audit for this surface:** Reduced blob `rounded-full` set-information badges to `rounded-md`, preserved copy/color/spacing/behavior.
- **Universal:** No colored gradients, no emojis, system font global, 1rem floor enforced via existing CSS (all `text-xs`/`text-sm`/`text-[10px]` forced to 1rem), large touch targets 44px+ (all primary actions min-h-10/12, navigation 56px), safe-area top+bottom, keyboard focus rings, screen-reader labels, reduced-motion respected.
- **Visual hierarchy:** header (title/subtitle/timer) → exercise cards → set rows (chips → suggested weight → coach notes → weight done → reps done → notes to coach) → finish action, with clear grouping and 1rem typography.

## Stage 6 — Guided workout mode

Status: implemented in development.

- **PreviewHeader reuse:** Same overhaul as Stage 5 — `min-h-11 rounded-xl` exit, timer `rounded-md px-2.5 text-[0.875rem]`, Classic button `min-h-10 rounded-lg text-[1rem]`.
- **PerformPanel:** Exercise label `0.8125rem` uppercase tracking-wide, title clamp `1.5rem-2rem` tight, notes `rounded-lg bg-muted/40 px-3.5 py-2.5` title `0.8125rem` desc `1rem`, chips `rounded-md px-2.5 py-1 text-[0.75rem] font-medium uppercase` (was `rounded-full text-[10px]` blob), suggested weight range `rounded-lg border bg-muted/30 px-3.5 py-2.5` title `0.8125rem` value `1rem semibold`, coach notes same, card `rounded-lg border bg-card p-4` → `rounded-xl border bg-card p-5`? Actually PerformPanel card `rounded-lg border bg-card p-4` upgraded to `rounded-xl border p-5` with shadow, labels Weight/Reps/Notes `1rem font-medium leading-5`, WeightDoneInput `min-h-12 rounded-xl text-[1rem]` large variant, RepsStepper buttons `h-11 w-11` (44px) with icon h-4, input `h-11 text-center text-base` → `min-h-12 text-center text-[1rem]`, textarea `min-h-12 resize-y rounded-xl py-3 text-[1rem] leading-6`, Complete set button `min-h-12 w-full rounded-xl text-[1rem] font-semibold` with Check h-5, Skip set ghost `min-h-11 self-center rounded-xl text-[1rem]` with SkipForward h-5.
- **RepsStepper:** Label `text-[1rem]`, buttons `h-11 w-11` (44px) already large touch target, input `h-11` → `min-h-12`, text center `text-base` → `text-[1rem]`.
- **WeightDoneInput:** Already overhauled in Stage 5 to `min-h-12 rounded-xl text-[1rem] pl-[4.75rem] pr-20`, stepper buttons 8w with hover, focus.
- **RestPanel:** Label `0.8125rem` uppercase (was `text-xs`), timer `text-6xl` kept but with tabular-nums, progress track `h-2.5 w-full max-w-xs overflow-hidden rounded-full` (progress track rounded-full is acceptable, not blob badge), nextInfo `text-sm` → `text-[1rem]`, Skip/Add time buttons `min-h-11 rounded-xl` already? Upgraded minus/plus/skip to `h-11 w-11` is 44px, now ensured `rounded-xl`.
- **Guided selection state:** Message `Select the set where Guided Mode should begin.` now `rounded-xl px-4 py-3 text-[1rem]` (was `rounded-md text-sm`).
- **Summary / Finish:** Flag buttons `min-h-12 rounded-xl text-[1rem]` with icon 5w5.
- **Badge audit for this surface:** Same as Stage 5 — set-information badges now `rounded-md` not `rounded-full`, copy/color/spacing preserved.
- **Universal:** No colored gradients (only black transparent allowed), no emojis, system font global, 1rem floor enforced, large touch targets 44px+ (all primary actions min-h-11/12, stepper buttons 44px), safe-area top+bottom via existing header and sticky composer, keyboard/screen-reader, reduced-motion (existing motion-reduce handling preserved).

## Stage 7 — Workout History

Status: implemented in development.

- **ClientWorkoutHistory wrapper:** Heading remains `text-2xl`, description `1rem leading-6` with added hint about list/calendar toggle.
- **View toggle:** Segmented control `rounded-xl border bg-muted/20 p-1`, two buttons `min-h-11 flex-1 rounded-lg px-3 py-2 text-[1rem] font-medium` with `bg-card shadow-sm` when active, `CalendarDays` icon 5w5 for calendar tab, large touch targets, focus ring.
- **List mode (existing, overhauled):** Container `space-y-3.5`, items `rounded-xl border bg-card shadow[0_1px_2px]`, button `min-h-[72px] p-5 text-left hover:bg-accent/50`, title `1.125rem` tight tracking-tight, date `0.875rem` with CalendarDays h-4, duration `1rem`, chevron h-5, details `border-t p-5 space-y-5`, stats grid `gap-2.5`, HistoryStat `rounded-lg bg-muted/40 p-3.5` dt `0.8125rem` uppercase dd `1rem` or `1.125rem` semibold tight, notes `rounded-lg px-3.5 py-2.5` title `0.8125rem` value `1rem`, set cards `rounded-xl border p-4 shadow`, set label `1rem`, completed badge `rounded-md px-2.5 py-1 text-[0.75rem] uppercase` (was `rounded-full text-[10px]` blob), prescription `0.875rem`, weight/reps stats `rounded-lg`.
- **Calendar mode (new):** Header month/year `1.125rem semibold`, nav buttons `min-h-11 min-w-11 rounded-xl` ChevronLeft/Right h-5, weekday labels `py-1 text-[0.8125rem] font-medium uppercase tracking-wide muted`, days grid `grid-cols-7 gap-1.5`, each day button `aspect-square rounded-lg border p-1 text-center` `text-[1rem]` `min-h ~44px` via aspect-square, selected `border-primary bg-primary/10`, today `border-primary/40 bg-card`, other days `border-border bg-card hover:bg-accent`, hasSessions indicator badge `min-h-5 min-w-5 rounded-md bg-primary px-1 py-0.5 text-[0.75rem] font-bold` (reduced blob), aria-label includes count.
- **Selected day sessions:** Heading `1rem semibold` with formatted full date + count, empty state `rounded-xl border-dashed p-6 text-center` `1rem`, list same as list mode `rounded-xl` cards with same hierarchy.
- **Loading/error/empty:** Loading `1rem`, error `rounded-xl border-destructive/40 bg-destructive/5 p-4` `1rem` + button `min-h-11 rounded-xl`, empty `rounded-xl border-dashed p-8` icon h-7, title `1.125rem`, desc `1rem`.
- **Badge audit for this surface:** Reduced blob `rounded-full` badges in history (if any) to `rounded-md`, completed/not-completed status badges now `rounded-md px-2.5 py-1 text-[0.75rem] uppercase`, calendar count badges `rounded-md`.
- **Universal:** No colored gradients, no emojis, system font global, 1rem floor enforced (existing CSS forces `text-xs`/`sm`/`[10px]` to 1rem), large touch targets 44px+ (day buttons aspect-square min ~44px, nav 44px, list items 72px, toggle 44px), safe-area preserved via parent shell, keyboard focus rings, screen-reader aria-pressed/aria-label for calendar days, reduced-motion respected.
- **Visual hierarchy:** toggle → list OR month header + weekday labels + calendar grid → selected day heading → sessions list → session details (stats → exercises → sets).

## Stage 8 — Loading state

Status: implemented in development.

- **Skeleton base:** `src/components/ui/skeleton.tsx` now `relative overflow-hidden rounded-lg bg-muted/60 skeleton-shimmer` instead of `animate-pulse rounded-md bg-primary/10`. New class `skeleton-shimmer` provides slow steady left-to-right shimmer wave per spec — "Absolutely must use the shimmer wave animation. The wave has to move slow and steady, not fast. The wave has to sweep left to right. Incredibly absolutely important to get that right."
- **Shimmer CSS:** Added to `src/styles.css`:
  - `.skeleton-shimmer { position: relative; overflow: hidden; background-color: hsl(var(--muted)/0.6); isolation: isolate; }`
  - `::after` pseudo-element with `linear-gradient(90deg, transparent, hsl(var(--muted-foreground)/0.08) 20%, hsl(var(--muted-foreground)/0.14) 50%, hsl(var(--muted-foreground)/0.08) 80%, transparent)`, `transform: translateX(-100%)`, `animation: skeleton-shimmer-wave 1.8s linear infinite`, `will-change: transform`
  - `@keyframes skeleton-shimmer-wave { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }`
  - `@media (prefers-reduced-motion: reduce) { animation: none; }`
  - Slow steady 1.8s linear infinite, left-to-right sweep, respects reduced-motion.
- **Loading surfaces overhauled to use shimmer instead of plain "Loading..." text:**
  - `AccountAccess.tsx`: `min-h-32` placeholder → skeleton stack `h-10 w-32 rounded-lg`, `h-14 w-full rounded-xl` x3, all `bg-muted/60 skeleton-shimmer`
  - `YourProgramPage.tsx`: `Loading your program…` text → skeleton section with header skeleton `h-4 w-24`, `h-8 w-64`, `h-5 w-80`, card `h-32 w-28 rounded-lg` + `h-6 w-3/4`, `h-4 w-full`, `h-4 w-5/6`
  - `ClientWorkoutPrescription.tsx`: `Loading workout prescription…` → `h-6 w-48`, `h-4 w-full`, `h-20 w-full rounded-xl` x2
  - `ChatConversation.tsx`: `Loading conversation…` → skeleton bubbles: `flex justify-start h-14 w-3/4 max-w-[78%] rounded-xl`, `flex justify-end h-10 w-1/2`, `flex justify-start h-20 w-4/5`, `flex justify-end h-12 w-2/3`
  - `ClientOnboardingChat.tsx`: same skeleton bubbles for onboarding loading
  - `CoachChatInbox.tsx`: `Loading chats…` → 3x `h-20 w-full rounded-xl skeleton-shimmer`
  - `WorkoutHistoryList.tsx`: `Loading workout history…` → `h-12 w-full rounded-xl` + 3x `h-24 w-full rounded-xl` skeleton stack
  - Other surfaces already had minimal loading but now benefit from global skeleton component if used elsewhere.
- **Universal for this surface:** No colored gradients except black transparent (shimmer uses muted-foreground low opacity, not colored), no emojis, system font global, 1rem floor, large touch targets preserved, safe-area preserved, reduced-motion respected (shimmer disabled when prefers-reduced-motion), visual hierarchy preserved via matching skeleton sizes to final content.

## Stage 9 — Error state

Status: implemented in development. Final stage.

- **Error page overhaul (`src/lib/error-page.ts`):**
  - Was `Something went wrong... Try again or go home` vague.
  - Now follows good error UX: What happened: "This page didn't load because something unexpected happened while opening it." Why: "This can happen if the browser's local data is temporarily unavailable or a recent change didn't load correctly. No personal data was sent anywhere — your No More Copium data stays only in this browser." What to do next: "Try refreshing. If it still doesn't load, go back home and open the app again. If the problem continues, clear the browser tab and try again, or use the Export/Import backup in Settings if you have a backup file."
  - Visual: system font `16px/1.5 ui-sans-serif`, light/dark via CSS variables, card `max-width 32rem`, `rounded 12px`, `border 1px`, `shadow 0 1px 2px`, `min-height 100dvh` with `env(safe-area-inset-*)`, large touch targets `min-height 48px`, buttons `rounded 12px`, `font-semibold`, focus rings, `role=alert aria-live=assertive`, reduced-motion respected.

- **AccountAccess overhauled:**
  - Inline validation on blur, character counts `name.length/80` and `username.length/30` with live polite aria.
  - `validateName`: required, min 2, max 80 — error tells what happened why what to do with `AlertCircle` icon.
  - `validateUsername`: required, 3-30, only lowercase letters numbers spaces, unique check against existing usernames — error says already taken.
  - Submit disabled until valid (`detailsValid`), with obvious requirement text "Enter a valid name (2–80) and username (3–30, unique) to continue."
  - Role selection: Coach exists check, disabled with explanation, amber warning box "What to do next: Create the Coach account first..."
  - Account creation errors: username taken → explains conflict + what to do; storage/quota → explains storage unavailable/full + check device; generic → local storage unavailable + check cookies/storage enabled, data stays only in browser.
  - Error container `rounded-xl border-destructive/30 bg-destructive/5 px-4 py-3 text-[1rem] leading-5` with icon, `role=alert`, break-words.
  - Buttons `min-h-12 rounded-xl text-[1rem] font-semibold`, `min-h-11`, badges `rounded-md px-2.5 py-1 text-[0.75rem]`, account list items `min-h-[64px] rounded-xl shadow[0_1px_2px]`, badge corners reduced.
  - Form UX: reuses known info? No, but forgiving username normalization `trim().toLowerCase().replace(/\s+/g, " ")`, autofill via normal input behavior.

- **LocalPrototypeTools:**
  - Export error: storage unavailable or entry too large → explains what happened why what to do (free storage, remove large pictures).
  - Import error: invalid/unsupported/oversized → shows raw reason + what happened (invalid/unsupported) why (corrupted, wrong format, too large) what to do (use valid JSON under 25MB).
  - Generic import: local storage unavailable or file invalid → explains.
  - Reset onboarding error: storage unavailable → explains.
  - Errors now `rounded-xl border-destructive/30 bg-destructive/5 px-4 py-3 text-[1rem]` with icon, `role=alert`.
  - Buttons `min-h-11 rounded-xl text-[1rem]`, `min-h-12 rounded-xl text-[1rem] font-semibold` for destructive clear.
  - Header badge `rounded-md px-2.5 py-1 text-[0.75rem]` (was `secondary` blob), description `1rem`, client list `1rem`, reset buttons `min-h-10 rounded-lg`.

- **BroadcastComposer improvements:**
  - No recipients: now "No recipients selected. What happened: no Clients chosen. Why: a broadcast needs at least one recipient. What to do: choose All Clients or select at least one Client and try again."
  - Image processing: "The images could not be processed because a file is invalid or too large. What happened: image processing failed. Why: file may be corrupted or over 2.5MB. What to do: try again with smaller valid images (max 6, WebP optimized) and check device storage."
  - Broadcast send: "The broadcast could not be sent because local storage is unavailable or full. What happened: broadcast failed. Why: browser storage may be blocked or full. What to do: check device storage and try again. Your data stays only in this browser."

- **FinalSequenceEditor improvements:**
  - Delete last message blocked: now "Cannot delete: The Final Sequence needs at least one message. What happened: delete blocked. Why: sequence must have at least one message. What to do: edit the existing message instead of deleting the last one."
  - Save failure: "The Final Sequence could not be saved because local storage is unavailable or full. What happened: save failed. Why: browser storage may be blocked or full. What to do: check device storage and try again."
  - Error container: was `rounded-lg px-3 py-2 text-sm` → now `rounded-xl border-destructive/40 bg-destructive/5 px-4 py-3 text-[1rem] leading-5`.

- **Existing chat/onboarding/history errors already overhauled in previous stages to tell what happened why what to do next (local storage unavailable/full, check device storage, try again, etc.) and use inline placement (`rounded-xl border-destructive/40 bg-destructive/5 px-4 py-3 text-[1rem]`) instead of bare `text-sm text-destructive`.**

- **Placement audit:**
  - Inline: default for field validation (AccountAccess name/username), form errors (account creation), broadcast recipient errors, final sequence validation, chat send failures, onboarding answer failures, workout history load failures — all use `rounded-xl border-destructive` inline near failed action.
  - Modal: used only for destructive confirmations (clear all data, reset onboarding, delete message, approve join request) where user cannot continue without addressing issue — Confirm via `window.confirm` with explicit "This cannot be undone" + suggestion to export backup first.
  - Toast: not used in local prototype because safe-to-miss messages are not present; future Cloud may use toast only when safe to miss.

- **No raw backend errors exposed:** All `nextError.message` that could contain raw storage or JSON errors are now wrapped with friendly explanation + what/why/next, never showing stack trace or infrastructure details. `console.error` remains for dev debugging but UI shows friendly copy.

- **No silent failures:** Every catch now sets error state with user-visible `role=alert`, plus existing `aria-live=polite` for message lists, and loading states always have skeletons, not silent empty.

- **Payment errors (deferred):** Payment handling remains deferred per docs until verified merchant provider selected. Spec says payment errors must make clear whether payment completed, whether charged, recovery action — this will be implemented in that future stage with provider-generated checkout.

- **Universal for final audit:** No colored gradients (only black transparent allowed, error uses `destructive/5` not colored gradient), no emojis, system font global, `1rem` floor enforced (existing CSS forces `text-xs`/`sm`/`[10px]` to `1rem`), large touch targets 44px+ (`min-h-11`/`min-h-12`, buttons `rounded-xl`), safe-area `env(safe-area-inset-*)`, keyboard focus rings (`focus-visible:ring-2`), screen-reader (`role=alert`, `aria-invalid`, `aria-describedby`, `aria-live`), reduced-motion respected.

- **Visual hierarchy for errors:** Error containers placed directly above/below failed action, not competing with primary actions, with icon `AlertCircle h-5 w-5`, break-words, sufficient padding.

- **Quality:** No unresponsive controls, no silent failures, no layout clipping, no accidental navigation, no raw errors, no emojis/gradients. Final whole-app badge audit done: all previously identified `rounded-full` blob badges now `rounded-md` (Client Preview, Coach Mode, set-information, inbox unread, chat button, history status, account role badges).

## Form UX principles for applicable later stages

1. Do not enable submission until required fields are valid, and clearly explain what remains incomplete.
2. Validate fields inline when the user leaves a field rather than waiting for a full submission.
3. Show a live remaining-character count wherever a limit exists.
4. Reuse known information and autofill whenever possible.
5. Show password requirements and their live completion state when password authentication returns.
6. Accept reasonable formatting variations and normalize them behind the scenes.

## Error-state principles for the later error stage

Every error message must tell the user:

1. What happened.
2. Why it happened, when that reason is safely known.
3. What the user should do next.

Never expose raw database, backend, stack-trace, or infrastructure errors. Never fail silently.

### Placement rules

- **Inline:** default for field, form, and nearby action failures.
- **Toast:** only when it is genuinely safe for the user to miss the message.
- **Modal:** only when the user cannot continue until the problem is addressed.

Payment errors must make it clear whether payment completed, whether the user was charged, and which recovery action is available. Payment handling remains deferred until a verified merchant provider is selected.

## Quality requirements for every stage

- Preserve all working behavior outside the active stage.
- No unresponsive controls, silent failures, layout clipping, or accidental navigation.
- Maintain safe-area handling and large touch targets.
- Maintain keyboard and screen-reader access.
- Respect reduced-motion preferences.
- Validate short and tall mobile viewports.
- Run formatting, production build, TypeScript, lint, focused executable tests, clean patch validation, and relevant browser automation before delivery.
