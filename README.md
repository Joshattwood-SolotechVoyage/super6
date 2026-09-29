# Super 6 v0.29.2

Small login reliability update on top of v0.29.1.

## What changed
- Player login now treats common apostrophe styles as equivalent, so `Dan O'Sullivan` and `Dan O’Sullivan` resolve to the same stored account.
- Login also ignores case differences and repeated/leading/trailing spaces when resolving the username.
- The player's display name is not changed; the resolver only finds the exact stored username before the existing secure PIN login runs.
- The PIN Edge Function and its existing rate limiting/security remain unchanged.

## Upgrade order
1. Run `super6-v0.29.2-login-name-fix.sql` in Supabase SQL Editor using **Run without RLS**.
2. Upload the website files from the v0.29.2 ZIP to the GitHub repository root, replacing matching files.
3. Wait for Cloudflare Pages to redeploy and hard-refresh the site.
