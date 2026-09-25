# Super 6 v0.28.3

This build adds the Chumpions League knockout stage on top of the v0.27 group-stage system.

## Chumpions League format
- 4 groups: A, B, C and D.
- Group matches use the normal Super 6 score from a week manually ticked as a **Chumpions League week**.
- Win = 3 group points, draw = 1, loss = 0.
- Group ranking remains: group points → head-to-head mini-table → total Chumpions Super 6 points → first-goal accuracy.
- Exact unresolved group-order ties remain an Admin decision.
- Top 4 from each group qualify.

## New in v0.28
- Admin gets a **Confirm groups & create Round of 16** button when the group stage is ready.
- Confirming the groups locks group membership and snapshots the top four positions in each group.
- Round of 16 is seeded automatically:
  - A1 v B4
  - B1 v A4
  - C1 v D4
  - D1 v C4
  - A2 v B3
  - B2 v A3
  - C2 v D3
  - D2 v C3
- Admin still chooses Chumpions weeks manually, round by round, with the existing checkbox.
- After the group stage is confirmed, ticking the next chosen Super 6 week automatically attaches the next unfinished knockout stage.
- Knockout stages progress automatically: Round of 16 → Quarter Finals → Semi Finals → Final.
- Knockout winner is decided by:
  1. Highest Super 6 score that week
  2. Closest first-goal prediction
  3. Admin choice if still exactly tied
- Players and Admin can both view the knockout bracket.
- The winning finalist is stored and displayed as Chumpions League Champion.
- Mobile layouts stack the bracket vertically; desktop shows a four-stage bracket.

## Existing features retained
- Normal league standings and weekly 👑 / 🥈 / 🥄 awards remain separate from Chumpions.
- Latest-week All Predictions browser remains available after results are published.
- £6 Monzo payment flow remains configured and unchanged.

## Upgrade order
1. Run `supabase/upgrade-v0.28-chumpions-knockouts.sql` in Supabase SQL Editor.
2. Upload the website files to the GitHub repository root, replacing matching files.
3. Wait for Cloudflare Pages to redeploy, then hard-refresh the site.

The v0.28 SQL is designed to be safe to re-run.


## v0.28.3 standings tidy-up
- Before any Chumpions matches are completed, group positions show as a dash rather than false tied 1st places.
- `ADMIN TIE` is hidden until played results genuinely remain inseparable after the configured tiebreaks.
- Qualification highlighting begins only after a group has a completed Chumpions result.
- Group headings now clarify that the top four qualify after the group stage.
- Admin cannot confirm a group that has no completed Chumpions match.
- No database change is required for this front-end update.
