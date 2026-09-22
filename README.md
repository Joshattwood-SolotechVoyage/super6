# Super 6 v0.24 — Simple payment flow

This update adds the agreed **Pay £6 → I've paid → Pending → Admin confirms → Paid** flow.

## Player
- The payment card only appears after predictions have been submitted.
- Unpaid players see **Pay £6 with Monzo**.
- After opening the payment link, Super 6 asks **Did you complete the £6 payment?**
- **Yes, I've paid** changes the status to **Payment pending** and hides the payment link.
- Admin confirmation changes the status to **Paid ✓**.
- If the grace window closes without confirmation, the entry shows **Entry not counted**.
- Paid and pending players are not shown another payment button, reducing accidental double payments.

## Admin
- Dashboard now separates **Paid**, **Pending**, **Unpaid**, and **Not entered**.
- A pending player means they have told Super 6 they paid, but Admin has not confirmed it yet.
- The existing Paid checkbox remains the final confirmation.
- A new **Monzo payment link** setting is in **Admin → Round**. Paste the fixed £6 link once and save it.

## Database
Run `supabase/upgrade-v0.24-payment-flow.sql` once in Supabase SQL Editor.

The upgrade adds:
- `app_settings.payment_url`
- `payments.player_claimed_paid`
- `payments.claimed_at`
- secure `mark_my_payment_pending()` RPC

Only Admin-confirmed `paid = true` entries count in scoring. A player's pending claim never counts as payment by itself.

---

# Super 6 v0.23

UI cleanup for awards and icon meanings.

- 👑 is now reserved for the reigning winner of the latest completed normal league round.
- 🏆 marks the winner of the specific weekly result.
- 🥈 marks second place for that weekly result.
- 🥄 marks the wooden spoon for that weekly result.
- Weekly Outcome no longer duplicates the crown beside winners.
- Player/Admin headers and entry modals no longer duplicate crowns.
- Added a responsive icon key for both Admin and Player views.
- League table wooden-spoon count header now says `Spoons` rather than showing another spoon icon.
- Crown remains league-only; future cups/extra competitions should not award it.

# Super 6 v0.22.1

Results-layout hotfix.

- Admin Results no longer squeezes the score editor and Weekly Outcome side-by-side.
- Weekly Outcome gets the full desktop width.
- League awards and full ranking have wider desktop columns.
- Tablet/mobile explicitly stack the outcome sections so names, stats and points remain readable.
- No database or Supabase changes.

---

# Super 6 v0.22

This build improves the completed-round presentation and adds a persistent league-winner crown.

## What changed
- Admin **Weekly Outcome** is now stacked and spaced out instead of squeezing three league results across the page.
- Winner / 2nd / Wooden Spoon are shown in separate award cards, with the full weekly ranking beside them on desktop and below them on mobile.
- The winner of each league's latest completed fixture week gets a small **👑 crown** beside their name.
- The crown is visible in player/admin league tables, the Admin overview, player identity, and weekly result lists.
- A crown remains until the following league round is completed, at which point it moves to the new winner(s).
- This crown is intended for normal league rounds only; extra/cup competitions will not use it when those are added.

No Supabase SQL changes are required for this update.

## v0.23 — Logo & saved-app identity
- Adds the new Super 6 crest to the login screen and main header.
- Adds favicon/browser-tab icons.
- Adds Apple Touch icon for iPhone/iPad Home Screen.
- Adds a web app manifest with 192px, 512px and maskable icons for install/save-to-home-screen support.
- No Supabase/database changes required.


## v0.23.1 logo hotfix
- Main on-page logo is embedded directly inside `index.html`, so it cannot disappear because an assets folder was missed.
- Browser / Apple / PWA icons are also duplicated at repository root and referenced from there for reliable deployment.
