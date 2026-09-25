# Super 6 v0.27

This build starts the **Chumpions League** as a separate competition layered on top of the normal Super 6 leagues.

## Chumpions League rules in this build
- Four groups: **A, B, C and D**.
- Admin decides manually, round by round, whether a Super 6 week also counts for Chumpions League.
- In **Admin → Round**, tick **Chumpions League week** only when that week should count.
- Admin manually creates that week's head-to-head fixtures inside **Admin → Chumpions**.
- Each head-to-head uses the player's normal counted Super 6 points from that same week.
- Group scoring: **3 points win · 1 point draw · 0 points loss**.
- Group ranking order:
  1. Group points
  2. Head-to-head mini-table between tied players
  3. Total Super 6 points scored across Chumpions group matches
  4. Cumulative first-goal accuracy across those Chumpions weeks
  5. If still tied, the app flags **Admin tie** for a manual decision later
- The **top 4 from each group** are the qualifying places for the future Round of 16.
- Normal league 👑 / 🥈 / 🥄 awards remain league-only and are not affected by Chumpions League.

## New Admin tools
- **Chumpions** tab in the Admin navigation.
- Assign any player to Group A, B, C, D or Not entered.
- Search players by partial name while setting groups.
- When the current Super 6 round is ticked as a Chumpions week, manually pair players within each group.
- Completed Super 6 results automatically fill the Chumpions head-to-head score.
- Payment/result recalculation during the existing grace window also refreshes the Chumpions result.

## Player view
- New **Chumpions** item in the top player navigation.
- Players can see their group, the latest Chumpions fixtures/results and all four live group tables.
- Current Chumpions weeks are clearly labelled.

## Existing features retained
- Latest completed-week predictions across all three normal leagues with partial-name search.
- Latest league-week 👑 / 🥈 / 🥄 badges.
- £6 Monzo payment flow and fixed payment link.
- Normal Super 6 scoring, league tables, payment grace and Admin controls.

## Upgrade order
1. Run `supabase/upgrade-v0.27-chumpions-group-stage.sql` in Supabase SQL Editor.
2. Upload all website files in this package to the GitHub repository root, replacing matching files.
3. Wait for Cloudflare Pages to redeploy, then hard-refresh the site.

No Edge Function changes are required.

### Current scope
v0.27 deliberately builds the **group stage first**. The Round of 16 / Quarter Final / Semi Final / Final bracket will be added after the group-stage workflow has been tested with real data. The final exact-tie Admin decision method can also be added later without changing the group scoring already stored.
