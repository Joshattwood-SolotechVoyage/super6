# Super 6 v0.14

This build keeps the existing Super 6 prototype competition data while adding secure Supabase authentication/account management.

New in v0.14: the Admin Secure Accounts panel can bulk-create the staged 2026/27 roster. Existing accounts are skipped, and newly created players have no PIN until the Admin resets/sets one.

# Super 6 Web v0.13

Responsive Super 6 football prediction web app.

## What changed in v0.13
- Main Username + 4-digit PIN login remains backed by Supabase.
- Admin Dashboard now has a **Secure accounts** panel.
- Admin can create a real player login with username, 4-digit PIN and league.
- Admin can reset an existing real player's PIN.
- Privileged account creation/reset happens through the `super6-admin-users` Edge Function; no service-role key is exposed in the browser.
- Competition/weekly data is still the staged local prototype and will be migrated separately.

Super 6 database objects remain isolated in the `super6` schema.
