# Super 6 v0.9 — build setup

This is the first package prepared specifically for your existing GitHub → Cloudflare Pages → Supabase workflow.

## Architecture
- GitHub: a new Super 6 repository in your existing account.
- Cloudflare Pages: deploys only the Super 6 repository.
- Supabase: your existing project can be reused safely; Super 6 lives in its own `super6` database schema.

The current UI remains in DEMO_MODE so the approved prototype keeps working while the shared backend is connected.

## Important security rules
- Never commit a Supabase secret key or legacy service-role key.
- The browser will use only the Supabase publishable key.
- Admin-only account creation and username + 4-digit PIN login will be handled server-side by Supabase Edge Functions.
- Detailed predictions stay private through Row Level Security.
- The 4-digit PIN itself will never be stored in a Super 6 table as plain text.

## Database isolation
`supabase/schema.sql` creates objects under `super6.*`, not `public.*`. This avoids naming collisions with Voyage/Voyage Go.

When we reach the database step, the Supabase dashboard must also add `super6` to the project's exposed Data API schemas.

## Current build order
1. Create the new GitHub repository and upload this package.
2. Connect that repository to a new Cloudflare Pages project.
3. Create the isolated `super6` schema in the existing Supabase project.
4. Add secure username + PIN authentication Edge Functions.
5. Replace local demo storage with live Supabase reads/writes.
6. Import current league/player/season data.
7. Test with a small group, then go live.
