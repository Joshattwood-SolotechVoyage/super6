# Super 6 v0.29.1 — automatic Chumpions matchdays

This is the website-only follow-up after installing the v0.29 database stages manually.

## Chumpions League group stage
- Admin still decides each Chumpions week manually using the checkbox on the normal Super 6 round.
- The website no longer asks Admin to choose Player 1 vs Player 2 manually.
- Saving a Chumpions week displays the automatically generated round-robin matchday for Groups A-D.
- Every player meets every other player in their group once.
- Odd-sized groups show a rotating BYE.
- Matchday progress is displayed, for example `Matchday 1 / 5`.
- Group assignments lock once the rotation starts so players cannot be accidentally missed or repeated.
- Unticking an unplayed Chumpions round removes that round's generated fixtures so the same matchday can be used later.
- Existing group standings and knockout system remain in place.

## Install
The required v0.29 database stages have already been run. No additional SQL is required for this package.

Upload the website files to the GitHub repository root, replacing matching files, then wait for Cloudflare Pages to redeploy and hard-refresh the site.

If the current Chumpions round was already ticked before the automatic rotation stages were installed, open **Admin → Round** and press **Save** once. This generates the current automatic matchday.
