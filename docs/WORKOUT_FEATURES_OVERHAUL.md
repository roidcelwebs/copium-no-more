# No More Copium — Workout Builder & Workout Execution Overhaul — Complete Spec

**Created:** 2026-08-03 from massive walkthrough, maximum capacity, maximum ability
**Status:** Discussion → Batching, always refer to this file + docs/LANDING_AND_APP_OVERHAUL_TASKS.md + docs/COMPLETE_PAYMENT_STRATEGY.md
**Base commit:** 1fdd917 / 17407ec / c12f450 etc. after dark theme #080808 + red, landing 7 pages, perf deep, bug fixes
**Color change:** All red throughout app → #E50910 (Netflix red) from now on
**Theme:** Black #080808 / #0d0d0d + red #E50910, dark mode only, outlines fixed

---

## 1. Current Problems Observed

- Selecting warm-up set option does not modify intensity option — intensity still selectable, still shown to client as tag
- Rep range selectable but has no purpose / no tag shown to client
- Superset definition: you did not take rest before/after previous set — but UI does not show upcoming supersets together with current set in guided
- Set numbering: warm-up and normal sets numbered continuously 1..6, should be numbered separately (warm-ups 1..3, working sets 1..3)
- Since dark mode switch, all outlines destroyed / not bright enough
- Adding exercises: full-screen pop-up with all exercises, can create more, search, but cannot edit existing exercise via long press 1-1.5 sec pop-up edit
- Cannot rearrange order of exercises nor sets within exercise
- Cannot copy/duplicate exercise (with all sets) nor copy/duplicate set
- Warm-up set reps: coach designates reps for warm-up, but client still has to type reps done
- No pause workout feature — should be able to pause, then next day auto goes to history
- Weight done default empty — should default to lower number of suggested weight range
- No rest times after warm-up sets
- Coach notes visual clutter: empty box shown for every exercise by default — should be hidden behind toggle icon
- Last time weight display: should show how much weight client did for that exercise last time, excluding warm-up
- Workout history: client cannot edit what he did
- No re-attempt feature: after workout completed, dashboard should have small section congratulating + button "Do this workout again" with double confirmation
- Delete workout history entry
- Outlines fix, color change red → #E50910
- Static sets: static strength and static stretch new set types with time range, countdown circular bar, rest timer circular bar

---

## 2. Warm-up Set Behavior Overhaul

### 2.1 Warm-up → Intensity Removal
- Coach builder: When set type = Warm-up, Intensity select removed/hidden, cannot select. If previously intensity set, clear it.
- Client classic/guided: Do NOT show intensity tag/chip
- Data: When saving workout, if Warm-up, set intensity = undefined

### 2.2 Warm-up Reps Already Designated
- Coach: When Warm-up, allow exact reps (targetReps), hide repRangeMin/Max
- Client: For Warm-up sets, Reps done input hidden, actualReps auto-set to targetReps designated by coach. Show static "Prescribed reps: X"

### 2.3 No Rest Times After Warm-up Sets
- Coach builder: restSeconds hidden/disabled, saved as 0/undefined
- Guided: No rest panel after warm-up, directly next set
- Classic: No rest chip for warm-up

### 2.4 Suggested Weight Default Lower Number
- By default, Weight done = lower number of suggested weight range (e.g., 60-80 → default 60). Client can change.

### 2.5 Warm-up vs Normal Numbering Separately
- Two counters per exercise: warmupCounter and workingCounter
- Example 6 sets: first 3 warm-up, last 3 normal → warm-ups 1,2,3 and working 1,2,3 (not 1..6)

---

## 3. Rep Range Purpose
- Show tag "8-12 reps" for every set where rep range set by coach, if not set, no tag

---

## 4. Superset UI in Guided Workout (Major)
- Definition: Superset = no rest time before/after previous set (restSeconds ===0 or setType superset/alt)
- New Guided UI:
  - Top: Rest time + circular progress bar
  - Main: Current set card
  - Below: All upcoming supersets (no rest) in same style, in order, scrollable if too many
  - If no superset after normal set, just show one normal set
- Logic: After current index, look ahead while prev set rest ===0 or setType superset/alt, collect as upcoming

---

## 5. Outline Fix for Dark Mode
- Borders rgba(255,255,255,0.08) too dim, change to rgba(255,255,255,0.12) or #27272a for better visibility
- Research best minimalistic black + red UI

---

## 6. Edit Exercise via Long Press
- When adding exercises, full-screen pop-up, click and hold 1-1.5 sec → Edit exercise popup, edit name and all info

---

## 7. Rearrange Order
- Rearrange exercises and sets order via drag handle + long-press

---

## 8. Copy / Duplicate
- Copy/duplicate any exercise with all sets, copy goes below original, rearrangeable
- Copy/duplicate any set below original

---

## 9. Pause Workout Feature
- Pause button, save where it was, next day auto goes to history with completed sets only, if no non-warm-up set completed, no log

---

## 10. Suggested Weight Default Lower Number
- Already covered

---

## 11. No Rest Times After Warm-up Sets
- Already covered

---

## 12. Coach Notes Toggle
- Hidden behind toggle icon, not empty box for every exercise by default

---

## 13. Last Time Weight Display
- Show how much weight client did for that exercise last time, excluding warm-up sets

---

## 14. Edit History + Re-attempt + Delete
- Edit every single thing in workout history
- Dashboard congratulates what workout you did today + button "Do this workout again" with double confirmation "Are you sure?" → "Are you really sure? You already did this workout."
- Same workout goes to history twice, okay
- Delete any workout history entry

---

## 15. Color Change Red → #E50910
- All red #ef4444 → #E50910 throughout app, use this specific red from now on

---

## 16. Static Sets — New Set Types
- Static Strength: rep range → time range, show time last time, ask how much time did you get?
- Rename to static strength
- Static Stretch: same as static strength but no time range, only specific time, countdown with circular bar around number, if supersets after static stretch, timer changes to long normal bar and smaller text, below all supersets
- Rest timer: long normal bar → circular bar around number

---

## 17. Division into Batches
- Batch 1: Warm-up intensity removal + rep range tag + numbering separate + no rest after warm-up + suggested weight default + coach notes toggle + outline fix + red #E50910
- Batch 2: Edit exercise long press + rearrange exercises and sets + copy/duplicate
- Batch 3: Superset UI in guided + pause workout + last time weight display
- Batch 4: Edit history + re-attempt + delete
- Batch 5: Static strength and static stretch + time range + countdown circular bar + rest timer circular bar
