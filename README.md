# Super 6 v0.20.1

UI refinement to the Admin Dashboard summary cards.

- Submitted / Paid / Unpaid / Not entered callouts now use stronger, high-contrast labels.
- Each callout has a short plain-English explanation underneath.
- Counts remain large and colour-coded.
- No Supabase or database changes required.

# Super 6 v0.20

Hotfix for v0.17: restores the Admin renderer that was accidentally omitted during the Supabase prediction migration.

- Fixes `renderAdmin is not defined` after Admin PIN login.
- Keeps the v0.17 Supabase-backed round and prediction work unchanged.
- Full replacement upload package.

# Super 6 v0.17.1

This build keeps the existing Super 6 prototype competition data while adding secure Supabase authentication/account management.

New in v0.17: the Admin Secure Accounts panel can bulk-create the staged 2026/27 roster. Existing accounts are skipped, and newly created players have no PIN until the Admin resets/sets one.

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


## v0.17 migration step
Current round name, cutoff and six fixtures now load/save from the `super6` Supabase schema via `admin_save_round`. If no round exists, Admin starts with a blank six-fixture form and players see “No round published”. Prediction entry remains intentionally disabled until the next Supabase migration step.


## v0.17
Player prediction entry now uses the live Supabase round. Saved predictions and first-goal minute reload from Supabase on login, so the same entry follows the player between devices. Admin payment overview and results remain staged for later migration.

## v0.20
- Admin weekly entry overview now reads live Supabase entries.
- Paid/Unpaid switches now call the secure `admin_set_payment` RPC and write the audit log.
- Admin player-entry inspection now reads the live Supabase prediction.
- Overview refreshes automatically while Admin is signed in.
- Result completion/scoring remains disabled from Supabase migration until the next step.
