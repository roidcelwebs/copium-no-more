# No More Copium — Landing UI Overhaul Specification

Status: revised in development; requires deployment and browser verification.

Last updated: 2026-07-27

## Scope

Landing layout changes apply only to the four-section public landing experience. The readable text-size floor and font family are universal throughout the web app.

## Universal typography

The text size used by `JFL, look at this.` establishes the minimum readable size:

- Minimum font size: `1rem` / 16px.
- Existing larger headings and display text remain larger.
- Tailwind `text-xs`, `text-sm`, responsive small-text variants, and known arbitrary values below 1rem are raised to the minimum.
- The system UI sans-serif family used by the transformation statistics is explicitly applied throughout the app, including form controls.

## Section 1 — testimonial proof and rotating headline

The previous white hero image placeholder is removed. The top of the section displays all three approved testimonials in a compact static proof stack:

1. `“Hal saved my life” — Tushar`
2. `“Holy shit I haven’t trained in 2 weeks and my wrists are still 18 cm when I measured. It's not just swelling.” — Garret`
3. `“5' 5 - 5' 10 with No More Copium 1-1 coaching. Every dollar was worth it” — Dylan`

All three remain visible without a carousel or additional competing animation. Each quote is followed by an em dash and attribution. Text remains at least 1rem.

Phrase order remains:

1. Heightmax
2. Dream physique
3. Bigger hands and wrist
4. Fix asymmetries
5. Prevent injuries
6. Fix posture

Timing:

- Each phrase is completely stationary for exactly 1,000ms.
- Replacement animation lasts exactly 500ms.
- Old phrase moves downward.
- New phrase enters from directly above and moves downward into place.
- Both move simultaneously with the same easing.
- No opacity crossfade during normal motion.
- No overlap between old and new phrase positions.
- Infinite loop.
- Reduced-motion users receive a short fade instead.

## Sections 1 and 2 — black transparent fades

The dark testimonial region in Section 1 and transformation image in Section 2 must blend gradually into the black text region with no visible box seam. Only black transparent gradients are allowed; colored gradients are prohibited.

The gradient uses a strong multi-stop fade:

- Transparent at the image side.
- Very light darkening first.
- Gradual middle blend.
- Near-black before the source image ends.
- Solid black before and across the image boundary.

Section 3 keeps its existing black transparent gradient because it was already visually acceptable. The transformation wipe is a solid red line rather than a colored gradient.

## Proportional placement system

Sections 1–3 use viewport-relative CSS grids rather than bottom-offset content piles:

- Section 1 divides its lower content region into three equal rows. The rotating title, `All with No More Copium`, and swipe cue are centered in rows 1, 2, and 3 respectively.
- Section 2 uses a 24/44/32 ratio for the status label, statistics, and action. The two-line after label remains centered below the source image on short phone viewports.
- Section 3 divides its lower region into three equal rows for the quote, supporting line, and swipe cue.
- Safe-area insets remain part of the available-height calculation.
- Section 4 is intentionally excluded because it is a vertically scrollable content page.

## Section 2 — transformation labels and statistics

- `Before` is centered below the image.
- The after label is centered as two lines: `3 months later` and `(All natural)`.
- Before statistics are `5′5″ manlet`, `Depressed`, and `Lonely`.
- After statistics are `5′10″` and `Happiness begins`.
- Feet and inches use typographic prime symbols rather than spelling out `foot`.
- Labels and statistics use the universal app font family.

## Section 4 — price, value cards, and scrolling

Title remains at the top:

> All this for just $29/month

`$29/month` remains red.

Replace bullet points with six compact long cards. Every card contains:

- A one-color minimal icon on the left.
- Red highlighted lead text beside the icon.
- Unhighlighted body text on its own line directly below the lead.
- Subtle border, rounded corners, and restrained dark background.

### Icons

1. **No AIslop**
   - `AI` inside a circle with a diagonal prohibition slash.

2. **1-1 Access to Hal**
   - Minimal chat bubble with message lines.

The local `Continue` button appears immediately after card 2. It continues to `/access`; it must not imply Google authentication while the app is a local-only prototype.

3. **Growth Plates Closed?**
   - Two long bones arranged closely in parallel with a small gap.

4. **Beginner? Struggling to stay consistent?**
   - Minimal dumbbell.

5. **Best Progress Tracking**
   - Minimal upward-trending line with one downturn/zigzag.

6. **Guided Workouts**
   - Mostly complete circular progress/guidance arc with an intentional gap and a minimal play/guide marker.

The final page scrolls internally when its content is taller than the phone viewport. A gesture that begins while this page is scrolled belongs to its internal content even if it reaches the top. Returning to Section 3 requires a separate outward gesture that starts with the final page already at its top.

All icons:

- Single red color.
- Thin consistent stroke.
- No generated illustration style.
- No gradients, shadows, or decorative complexity inside the icon.

## Verification checklist

- [ ] White hero placeholder is absent.
- [ ] All three testimonials render in the approved order with exact wording and attribution.
- [ ] Testimonial stack does not clip or overlap the rotating headline on short Android viewports.
- [ ] Landing UI contains no emojis or colored gradients.
- [ ] Phrase remains still for 1,000ms.
- [ ] Both phrases move simultaneously for 500ms.
- [ ] No headline overlap.
- [ ] Section 1 gradient blends smoothly.
- [ ] Section 2 gradient blends smoothly.
- [ ] Section 3 gradient remains unchanged.
- [ ] Sections 1–3 place content by their approved grid ratios on short and tall phones.
- [ ] No web-app text renders below 1rem.
- [ ] All app text and form controls use the universal system UI sans-serif family.
- [ ] Transformation labels stay centered below the image.
- [ ] The after label uses two lines.
- [ ] Height statistics use prime symbols and the before list has no duplicate `Manlet` item.
- [ ] Price title remains at the top.
- [ ] Six value cards render in the revised exact order.
- [ ] Each body starts on a separate line.
- [ ] Icon mapping matches the approved specification.
- [ ] The local Continue button appears after card 2 and remains usable.
- [ ] Section 4 scrolls internally on short Android viewports without clipping.
- [ ] Reaching the top of Section 4 does not jump to Section 3 until a separate outward gesture.
