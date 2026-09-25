# Super 6 v0.28 setup

## 1. Supabase
Run this file in Supabase SQL Editor:

`supabase/upgrade-v0.28-chumpions-knockouts.sql`

"No rows returned" is a successful result.

## 2. GitHub
Upload the contents of the v0.28 package to the root of the Super 6 GitHub repository, replacing matching files.

Do not upload only the ZIP file itself.

## 3. Cloudflare
Wait for the automatic Pages deployment to finish, then hard-refresh the Super 6 website.

## 4. Chumpions workflow
- Continue assigning groups and running manual Chumpions group weeks as before.
- When Admin is happy the group stage is complete, open **Admin → Chumpions** and press **Confirm groups & create Round of 16**.
- Group membership then locks.
- For each knockout stage, create the normal Super 6 round and manually tick **Chumpions League week** when you want that stage played.
- The app attaches the next knockout stage to that chosen week.
- When normal results are completed, Chumpions results calculate automatically.
- Exact knockout ties after first-goal accuracy are shown to Admin for a manual decision.
