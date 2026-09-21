# Super 6 v0.22.1

Results-layout hotfix.

- Admin Results no longer squeezes the score editor and Weekly Outcome side-by-side.
- Weekly Outcome gets the full desktop width.
- League awards and full ranking have wider desktop columns.
- Tablet/mobile explicitly stack the outcome sections so names, stats and points remain readable.
- No database or Supabase changes.

---

# Super 6 v0.22

This build improves the completed-round presentation and adds a persistent league-winner crown.

## What changed
- Admin **Weekly Outcome** is now stacked and spaced out instead of squeezing three league results across the page.
- Winner / 2nd / Wooden Spoon are shown in separate award cards, with the full weekly ranking beside them on desktop and below them on mobile.
- The winner of each league's latest completed fixture week gets a small **👑 crown** beside their name.
- The crown is visible in player/admin league tables, the Admin overview, player identity, and weekly result lists.
- A crown remains until the following league round is completed, at which point it moves to the new winner(s).
- This crown is intended for normal league rounds only; extra/cup competitions will not use it when those are added.

No Supabase SQL changes are required for this update.
