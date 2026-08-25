# No More Copium — Landing + Full App Overhaul — Master Task List

**Created:** 2026-07-30 from full walkthrough voice transcription
**Status:** Discussion → Batching, always refer to this file
**Base commit:** 0f52725 / 07bd122 latest (Stage 9 complete + onboarding hotfix + site info)
**Last verified:** All 9 UI/UX stages implemented, onboarding hotfix applied.

## User Walkthrough Summary (verbatim intent captured)

User went through app live on Lovable deploy URL and reported:

### Landing Pages (currently 4 sections)
1. **Section 1:** Top has 3 testimonials proof stack + rotating headline "Heightmax..." + "All with No More Copium" + swipe down cue. Has black transparent fade, solid red line.
2. **Section 2:** Transformation before/after: "Before" label, after shows "3 months later (All natural)", image, swipe.
3. **Section 3:** Hands comparison: "You can't naturally thicken wrist and hands." / "JFL, look at this." + top image.
4. **Section 4:** Value section titled "All this for just $29/month" + 6 value cards + Continue button.

### New Requirements — Landing

#### BATCH 1 — Three new intro testimonial pages BEFORE current first page (highest priority for emotional impact)

**Goal:** Make testimonials hit harder — one per full screen, bigger text, blur entrance.

- Create **3 new pages** inserted before current first page. Order:
  - New Page 0: First testimonial alone
  - New Page 1: Second testimonial alone
  - New Page 2: Third testimonial alone
  - New Page 3: Existing first page (with 3 testimonials together) unchanged
  - Then existing second, third, fourth pages as usual → total 7 pages now.

- Each new intro page:
  - Shows **only one testimonial** from the approved list:
    1. “Hal saved my life” — Tushar
    2. “Holy shit I haven’t trained in 2 weeks and my wrists are still 18 cm when I measured. It's not just swelling.” — Garret
    3. “5' 5 - 5' 10 with No More Copium 1-1 coaching. Every dollar was worth it” — Dylan
  - **Bigger font** than current proof stack because only one piece of text on screen. Should still respect 1rem minimum but can use clamp for huge impact, e.g. `clamp(1.5rem, 6vw, 3rem)` or similar.
  - **Quotation marks red** for styling — opening “ and closing ” should be red `#ef4444` or `text-red-500`, while quote text itself white.
  - Author name (`— Tushar` etc) already red — keep red, but position **off to left or right** as common — e.g., right-aligned under quote, or left with border-l-2 red. Make it look good, not centered necessarily.
  - **Blur effect entrance:** Text appears with short blur transition. E.g., initial `filter: blur(12px) opacity:0 translateY(8px)` → `blur(0) opacity:1 translateY(0)` over 600ms ease-out when page becomes active. Each intro page should trigger this when swiped into view.
  - At bottom, same **swipe down thingy** (ChevronDown + "Swipe down" 10px uppercase) to go to next testimonial page.
  - Background should be black (like landing), no colored gradients, only black transparent fade if needed.
  - No carousel, no competing animation — just static quote + blur-in.

- Preservation:
  - Original first page with 3 testimonials remains after these 3 intro pages.
  - Rest of landing flow unchanged.

#### BATCH 2 — Landing small fixes (after Batch 1)

1. **Section 2 font fixes:**
   - Text "Before" — change font to same font that "Swipe down" uses. Swipe down uses `text-[10px] font-medium uppercase tracking-[0.18em]` with system sans-serif. Before currently maybe different font/size. Make Before use same family/style as swipe down.
   - Text "3 months later (All natural)" — change font to font of "Swipe down" text as well. It shows after transform click. Currently maybe larger. Make font same as swipe down (10px uppercase tracking wide) or at least same family.

2. **Section 3 image replacement:**
   - User will attach replacement image for top image. Need to optimize import: WebP, eager/async decoding, object-cover, same fade as other sections. Awaiting attachment.

3. **Section 4 spacing fix:**
   - Title "All this for just $29/month" — second line "$29/month" too close to first line "All this for just". Fix with tiny increase in line-height or margin, e.g., `leading-[0.95]` → `leading-[1.05]` or `gap-1` between lines, or `mt-1`. Must be tiniest fix, not overdone.

4. **Continue button → Continue with Google:**
   - Text change: "Continue" → "Continue with Google"
   - Add Google icon — user says "Google icon with the button, like the user silhouette or the black version of the icon to fit in better." Likely means Google "G" logo, or generic user silhouette? Clarify: Should be Google G logo in black version to fit dark theme? For now, use Google G icon (black version for light button, or white for dark? Button is white bg with black text in ValueSection). So add Google icon left of text.
   - Navigation remains to `/access` (account creation) for local prototype — not real OAuth yet. Note: Real Google OAuth would require Cloud rebuild.

#### BATCH 3 — Full App Theme Overhaul Black + Red

- **Current:** App shell (coach/client) uses white background `bg-background`, light theme. Landing uses black (#000, #080808) + red (#ef4444 / red-500 / red-600).
- **New:** Apply black and red combination to **complete web app**. "No more fucking white. Fuck this white shit. It's going to be black and red like our landing pages"
- Research needed:
  - Understand main color: black (#000 / #080808 / #0d0d0d) is main background
  - Accent: red (red-500 #ef4444, red-600 #dc2626) is primary accent, used for transformation wipe, testimonial quote border, value card icons, highlighted lead text, $29/month, etc.
  - Need to research color rules: dark theme with red accent, accessible contrast, muted-foreground, card backgrounds, borders, etc.
  - Likely: `bg-background` becomes black, `bg-card` becomes dark gray (#0d0d0d / #171717), `border` becomes white/10%, `foreground` white, `muted-foreground` gray, `primary` red? Or keep primary as white? Need to strategize as UI god.
  - Must ensure all existing components still readable: buttons, inputs, dialogs, etc.
  - Must preserve existing functionality, only change theme.
  - No emojis, no colored gradients except black transparent.
  - Large touch targets, safe-area, etc. still.
  - This is big task, will affect `src/styles.css` :root and .dark variables, Tailwind tokens.

#### BATCH 4 — Performance / Caching / Preloading

User reports delay when clicking bottom navigation in coach mode, and delay in onboarding creation, etc.

- **Requirement:** As soon as user first gets into app and dashboard finishes loading, every other page in order of priority, depending on what user can see, should start loading so there is no delay when clicking any section.
- **Desired:** Every section/page user can click from current page should start loading after current page loads.
- **Caching:** Cache every static aspect of UI, any text that doesn't change, any UI element that doesn't change — put in cache memory, but don't overflow, no lag. Optimization needed.
- **Interpretation:** Implement route prefetching / preloading for TanStack Router, plus aggressive caching for static assets, maybe use `link rel="prefetch"` or `router.prefetch`? TanStack Start supports prefetching.
- Also need to ensure Service Worker / manifest caching per PWAIR? But PWAIR already governs installability.
- Must avoid lag, not overflow cache.

Potential implementation:
- Use TanStack Router `preload` or `prefetch` for coach/client routes after dashboard mount.
- Use React Query? The app uses TanStack Query? It has @tanstack/react-query.
- Cache static UI via localStorage? Or via HTTP cache headers? But request is to cache in memory (C-A-C-H-E).
- Could use `queryClient.prefetchQuery` for programs/workouts after dashboard load.
- Could also use `React.lazy` with preload.

Need to measure current delay — likely due to localStorage loads and IndexedDB.

#### BATCH 5 — Bug Fixes / Huge Bug Testing

User reports:
- In coach mode, clicking bottom nav pages shows "This page didn't load. Something went wrong on our end. Try refreshing or head back home." Try Again no response, Go Home sends to landing pages (expected? but not expected). After clicking Continue again and logging into coach account again, Program Manager, Library, Messaging work, but slow.
- In account creation flow: Click gear icon → Switch local account → Create new local account → name + username → Continue → Coach mode → onboarding delayed, unprofessional.
- In onboarding deployed via Lovable deploy URL: Clicking options 5-6 times a week, 3-4, 0-2 not working, unresponsive. "What the hell? How can this problem?"
- Needs huge bug testing, go through whole code, whole project files.

Potential root causes to investigate:
- `renderErrorPage.tsx` was recently overhauled — maybe error boundary catches errors but doesn't recover? Try Again button just reloads, but if error is in localStorage data, reload will fail again → infinite error page loop. Need to fix Try Again to actually recover.
- Go Home sends to landing pages — `renderErrorPage` has link href="/" which goes to landing, not to /access? For coach mode error, Go Home should go to /access or /coach/dashboard? Currently href="/" goes to landing, which is confusing. Should go to /access or dashboard.
- Bottom nav delay: Could be due to heavy localStorage loads, IndexedDB, or routeTree generation.
- Onboarding unresponsive: We already hotfixed with touch-manipulation and removing loading from disabled. Need to verify if fix applied in latest commit 07bd122? Latest commit after hotfix is 40fa824 Applied onboarding chat patch, then 07bd122 Update site info. So hotfix is applied. But user still reports unresponsive on Lovable deploy URL — maybe deploy URL is older than latest commit? Need to check deployment.

Need full codebase audit:
- Check all routes for errors that could trigger error boundary
- Check `src/routes/__root.tsx` error handling
- Check `src/lib/error-capture.ts`, `src/lib/lovable-error-reporting.ts`
- Check `src/components/account/AccountProvider.tsx` loading logic
- Check `src/hooks/use-mobile.tsx`, etc.
- Check for any `throw` that could cause error page

Also need to handle NID-only etc? No.

## Division into Batches — Proposed Order

**Batch 1 (Landing Intro Testimonials):** 3 new pages before current first page, red quotation marks, blur transition, bigger text, author positioning, swipe down preserved.
**Batch 2 (Landing Small Fixes):** Before font, 3 months later font, $29/month spacing, Continue → Continue with Google + icon, image replacement (awaiting attachment), plus verify Batch 1.
**Batch 3 (Theme Overhaul Black/Red):** Research color rules, update `styles.css` :root/.dark, update `components.json` tokens, update all UI components to use black/red, no white, ensure contrast, preserve functionality. Very big.
**Batch 4 (Performance/Caching):** Prefetching after dashboard load in priority order, cache static UI/text, avoid overflow/lag, optimize localStorage/IndexedDB loads, measure bottom nav delay.
**Batch 5 (Bug Fixes/Bug Testing):** Fix "This page didn't load" error, Try Again unresponsive, Go Home unexpected landing, onboarding delay + unresponsive options, full codebase audit, deploy URL testing.

Each batch will be its own patch with dry-run, SHA, Lovable instructions.

## Attachments Needed

- Replacement image for Section 3 (hands comparison) top image — user said will attach, not yet received.
- Clarification: Continue with Google — just text + icon change with same navigation to /access, or actual Google OAuth integration (requires Cloud rebuild + OAuth provider)?
- Theme: Confirm pure black (#000) background with red accent (#ef4444 / #dc2626) for entire app, or dark gray (#080808) + red? Landing uses #000, #0d0d0d, #080808, red-500, red-600.
- For caching: Confirm what static UI/text can be safely cached (e.g., program names? No, those change. But labels, icons, headings, etc. can be cached).

## Notes for Maximum Ability

- Always refer to this file before each patch.
- Preserve exact testimonial wording and order.
- Preserve exact spelling "Mirin" and other copy.
- No emojis, no colored gradients except black transparent.
- Minimum font size 1rem floor already enforced.
- Large touch targets 44px+ (min-h-11/12).
- Safe-area handling, keyboard, screen-reader, reduced-motion.
- No personal wallet screenshot flow, no bypassing KYC.
- Payment integration remains separate (Lemon Squeezy + Payoneer + bKash).
- Owner is she, only NID, will withdraw to bKash and pay cash.

## Next Steps

1. Ask user for replacement image for Section 3.
2. Confirm Continue with Google is visual only or real OAuth.
3. Start Batch 1 implementation.


---

## New Walkthrough 2026-08-03 After Dark Mode — Additional Bugs & Requests

**User in coach dashboard:**
- Below join requests, can see client who sent image (himself from client account). Clicks, taken to chat, can see image, top header behind transparent blurry — loves liquid glass effect.
- **BUG:** No option to approve this client so he can log back into that client account and use client experience. Expected Approve button in chat or dashboard join requests detail.

**Landing pages — 7 pages now (3 intro testimonials + original 4):**

- Page 1 (first intro testimonial): Good.
- Page 2 (second intro testimonial): Author name is to the left, supposed to be to the right. Fix name positioning.
- Page 3: Good.
- Page 4 (original first page with 3 testimonials together): While on fourth page, can see little bit of top part of next page (fifth page) — sliver visible. Should not see any part of next page.
- Page 5 (Transformation Before/After): Previously fixed Before font and 3 months later font to swipe down font — verify.
- Page 6 (Hands comparison): Top image replacement to new 15cm→17cm image not visible — cache issue or binary patch not applied via `patch -p1`. Need to ensure new image is deployed correctly. Image is `20260730_010408.jpg` optimized to WebP 34KB, should show 15cm left, 17cm right, red text.
- Page 7 (Value section with Continue with Google): Scrollable page. Desired behavior:
  - If scroll all the way to bottom of last page (Continue with Google button visible), then scroll back up to top, there should be NO way to be able to scroll up to previous page as well in same swipe. If you scroll back up to top and let go, then if you swipe again, then you're allowed to go back to previous page.
  - If screen is so big that whole last page is already showing (no scroll needed), then swipe up should directly go to previous page (since no scroll to do).
  - This is nested scroll ownership logic: scrollable last page should consume swipe until reaching top, then require second swipe to change page.

**Batch division for these new issues:**

**Batch 6 — Landing Batch 3 fixes:**
- Fix Page 2 author name position: left → right (align="right" was intended but currently left). Make all intro testimonial authors right-aligned per user preference.
- Fix Page 4 sliver: Ensure vertical pager track transform is exactly 100% per section, no partial visibility. Check `useVerticalSectionPager` hook — maybe `will-change-transform` and `translate3d` causing subpixel gap? Ensure each section `h-full` and `overflow-hidden`, track height exactly `SECTION_COUNT * 100%`? Also ensure `HandsSection` top image h-[64%] not causing overflow.
- Fix hands image cache: Binary patch via `patch -p1` does not handle binary. Need to provide image as separate file upload instruction for Lovable, or encode as base64 and decode via script, or use `git apply --binary`. For Lovable patch applier, recommend uploading file manually via Lovable file manager to `public/landing/hands-comparison.webp` or via our patch that creates file from base64.

**Batch 7 — Landing Batch 4 scroll behavior:**
- Implement proper scroll ownership for last page ValueSection which is `overflow-y-auto`: 
  - When at bottom and user swipes down? Actually requirement is for scrolling up.
  - Logic: If ValueSection is scrollable and not at top, consume swipe to scroll inside section, not change page.
  - If ValueSection is at top (scrollTop === 0) and user swipes up (trying to go to previous page), require that previous swipe had already reached top and let go — i.e., need two swipes: first swipe reaches top, second swipe goes to previous page. If ValueSection is not scrollable at all (scrollHeight <= clientHeight), then single swipe up goes to previous page.
  - This requires tracking scroll position and last scroll direction in `useVerticalSectionPager` or in ValueSection itself.
  - Also need to handle case where screen is big and whole last page visible: then scrollHeight <= clientHeight, so swipe up directly goes to previous page.

**Batch 8 — Coach Dashboard Approve Bug:**
- In coach dashboard below join requests, client with image visible, click to chat, can see image, header liquid glass effect loved, but no Approve option.
- Expected: Approve button should be visible in chat when joinRequestPending, and in dashboard JoinRequestsSection.
- Currently ChatConversation has Approve button when joinRequestPending, but maybe condition fails because joinRequest status is pending but account.role is client? No, in coach mode account.role is coach, joinRequestPending should be true if status pending. Check fetchJoinRequest logic.
- Also need to ensure Approve button is visible in chat header or in pending banner, not hidden behind transparent header.
- Fix: Ensure JoinRequestsSection shows pending count and approve button, and ChatConversation shows Approve Client button in pending banner, with large touch targets, rounded-xl, text-[1rem], etc.

