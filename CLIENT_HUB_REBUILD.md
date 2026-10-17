# Lunarist Client Hub rebuild

## What changed

- Replaced the legacy client commissions route/profile panel with one consolidated Client Hub (`client-hub.js`).
- Added a responsive workspace for overview, orders, saved inspiration, messages, reviews, profile settings, and the existing Eugene Card connection UI.
- Added searchable/filterable orders, order progress, delivery deadlines, status history, review eligibility, and clearer loading/error/empty states.
- Routed both `/clients` and the legacy `/commissions` URL to the new Client Hub.
- Removed the old Client Space / commission UI script modules and the old duplicate dashboard handlers from the active `index.html`.
- Excluded obsolete duplicate HTML entry-point backups and extracted `inline_*.js` scratch files from the packaged ZIP so the old dashboard implementation is not carried forward as a second page. The original supplied ZIP remains unchanged.
- Updated `inject-enhancements.js` and `.github/workflows/inject-profile-sync.yml` so rebuild/automation paths use the new Client Hub and do not reinsert the deleted legacy modules.
- Kept the Artist Commission Center and the rest of the site code in place.

## Data and security

The hub reads the existing `commissions`, `client_reviews`, `saved_projects`, `conversations`, `profiles`, and `commission_status_history` resources. Client delivery approval calls the new `client_approve_commission(uuid)` RPC rather than attempting a direct client update against the artist/admin-only commission update policy.

Migration to review and apply separately:

`supabase/migrations/20261017090000_client_hub_approval_rpc.sql`

**The migration is included but has not been applied to Supabase.** Until it is applied to the target project, the Client Hub will tell the client that the approval migration is required when they attempt to approve a delivered order. No production deploy or database mutation was performed as part of this ZIP build.

## Validation performed

- `node --check` passed for `client-hub.js`, `client-hub-eugene-card-tab.js`, `commission-command-center.js`, and `inject-enhancements.js`.
- All four inline JavaScript blocks in `index.html` passed `node --check` after extraction.
- Confirmed the active `index.html` contains one new Client Hub script include and no references to the deleted legacy dashboard handlers or scripts.

The validation here is static; it does not claim a browser-based end-to-end test or a production release.
