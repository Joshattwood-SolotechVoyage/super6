# Super 6 v0.25

This build adds:
- Player navigation at the top on desktop and mobile.
- Published same-league predictions: after Admin completes the round, players can tap **View picks** beside another counted player in their league.
- The fixed £6 Monzo payment link is preloaded: `https://monzo.me/daylehodge/6.00?h=GgbX1T&d=Super%206&account_type=personal`.
- Existing v0.24 Unpaid → Payment pending → Admin confirms → Paid flow remains unchanged.

## Upgrade
1. Run `supabase/upgrade-v0.25-published-predictions.sql` in Supabase SQL Editor.
2. Upload the website files to the GitHub repository root, replacing matching files.
3. Wait for Cloudflare Pages to redeploy, then hard-refresh the site.

The published-predictions SQL only exposes predictions once a round is `completed`, only for counted entries, and only within the signed-in player's league.
