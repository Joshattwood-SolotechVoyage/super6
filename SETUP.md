# Super 6 v0.27 setup

## 1. Supabase
Run this once in the Supabase SQL Editor:

`supabase/upgrade-v0.27-chumpions-group-stage.sql`

If Supabase says **No rows returned**, that is successful.

## 2. Website
Upload the contents of the v0.27 package to the root of the Super 6 GitHub repository, replacing matching files.

Cloudflare Pages should redeploy automatically.

## 3. First Chumpions setup
1. Log in as Admin.
2. Open **Chumpions**.
3. Assign the participating players to Group A, B, C or D.
4. When creating a Super 6 round that should also count for Chumpions League, tick **Chumpions League week** in the Round tab.
5. Return to **Chumpions** and manually add the head-to-head fixtures for that week.
6. Complete the normal Super 6 results as usual. Chumpions scores are calculated from the same normal weekly points.

No Edge Function changes are required.
