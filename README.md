# Super 6 v0.30.2

Latest front-end package, built on v0.30.1 / v0.29.3 without database resets.

Changes in v0.30.2:
- Removes any visible ADMIN TIE treatment from Chumpions group-stage tables. Equal group-match scores are draws.
- Chumpions standings stay Pos | Player | P | W | D | L | Pts; no visible S6 or H2H columns.
- Moves Chumpions Players & groups management to the bottom of the Chumpions admin page.
- Fixes normal league-table header order to Pos | Player | Pts | Correct scores | Correct results | Played | Wins | Spoons.
- Makes normal league tables substantially narrower on desktop and keeps the compact no-horizontal-scroll mobile layout.
- Bumps CSS/JS asset versions to v0.30.2 to prevent the browser/Cloudflare serving the older Chumpions renderer from cache.

# Super 6 v0.30.1

This release is the front-end companion to the v0.30 Supabase update.

## Preserved
- All v0.29.3 login fixes, including tolerant apostrophe/case/spacing username resolution.
- Existing Supabase authentication, payments, scoring, published predictions, league awards and Chumpions knockout flow.
- Existing players, leagues, accounts and Chumpions group assignments are not modified by this website package.

## v0.30.1 UI updates
- Chumpions group tables are mobile-first and display only `Pos | Player | P | W | D | L | Pts`.
- Chumpions group draws display as `DRAW`; `ADMIN TIE` is not shown in the group stage.
- The Chumpions schedule UI now reflects the double round-robin database logic.
- Normal standings use `Pos | Player | Pts | Correct scores | Correct results | Played | Wins | Spoons` and fit on mobile without horizontal scrolling.
- Admin results split each counted £6 into £5 weekly prize and £1 year-end pot.
- The £1 season pot shows week-by-week contributions and the running total.
- Weekly winner/poster output shows 1st and 2nd clearly and exposes first-goal tiebreak evidence when points were tied.

## Deploy
Upload all files in this ZIP to the GitHub repository root and replace matching files. Cloudflare Pages should redeploy automatically.
