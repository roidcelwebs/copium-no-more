# Landing Archive (inactive)

**Archived:** 2026-08-25 · **Status:** INACTIVE BY DESIGN — code legacy, not routed, not imported, not bundled.

These are the **exact, unmodified original files** of the old 7-section swipe landing that used to live in `src/components/landing/` (and the old `src/routes/index.tsx`). They are kept in the repo per instruction so nothing is ever lost, but they are fully deactivated: nothing imports them, no route points to them, and the app never loads them.

## What was replaced

On 2026-08-25 the app root `/` was changed from the 7-section swipe landing to a single welcome screen:

- Text: **"You made it, brother."** / **"Welcome to No More Copium."**
- A single red **Continue** button that goes to `/access` (Google login / sign-up placeholder)
- Everything else removed: testimonials, hero, transformation, hands comparison, feature cards, pricing

## Files in this folder (original, unchanged)

| File | What it is |
| --- | --- |
| `LandingPage.tsx` | The 7 vertical swipe sections (3 testimonials → Hero → Transformation → Hands → Value/pricing) |
| `RotatingHeadline.tsx` | Rotating hero headline ("Heightmax / Dream physique / …") |
| `TransformationSection.tsx` | Before → 3-months-later transform section |
| `landing-content.ts` | The 3 testimonials (Tushar / Garret / Dylan) |
| `landing-content.test.js` | Old test guarding the original testimonial content |

## Original `src/routes/index.tsx` (exact copy, shown here because route files can't live outside `src/routes/`)

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/components/landing/LandingPage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "No More Copium" },
      {
        name: "description",
        content:
          "Build your dream physique with clear direction, personal programming, and no more copium.",
      },
      { property: "og:title", content: "No More Copium" },
      {
        property: "og:description",
        content: "Build your dream physique with clear direction, personal programming, and no more copium.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: LandingPage,
});
```

## Files still in the app that this archive used (kept intentionally)

- `src/hooks/use-vertical-section-pager.ts` — the swipe-pager hook (no longer called by the app, kept so the archive stays a faithful clone)
- `public/landing/*` — `hands-comparison.webp`, `transformation-after.webp`, etc. (no longer referenced, kept)
- Landing CSS classes in `src/styles.css` (`.landing-*`, `.testimonial-blur-in`, keyframes) — now unused, kept
- `src/components/account/GoogleSignInButton.tsx` — still used by `/access`

## How to restore (if ever needed)

1. Move the 5 files back to `src/components/landing/`.
2. Put the original `index.tsx` above back as `src/routes/index.tsx`.
3. Rebuild. Nothing else is required — the landing still works as it did.
