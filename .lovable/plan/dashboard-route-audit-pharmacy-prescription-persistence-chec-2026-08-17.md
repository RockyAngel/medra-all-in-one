# Dashboard route audit + pharmacy/prescription persistence check

## What I found (verified in the code)

Customer side has real pages for every link: catalog, stores, product, cart, checkout, orders, wallet, favorites, notifications, account, membership, support, and the four health pages.

The role dashboards are a different story. Every sidebar link does resolve to a route (no 404s), but almost all of them land on a **generic catch-all placeholder** that only shows an empty state — the URL and title change, the content never does. Real, data-backed screens exist only for:

- `/seller` (overview) and `/seller/prescriptions`
- `/admin` (overview) and `/admin/pharmacy-applications`
- `/rider` (overview)
- `/super-admin` (overview)

Everything else in the sidebars is served by the placeholder files:

```text
seller_.$section.tsx      -> orders, products, inventory, earnings,
                             transactions, payouts, store, reviews
rider_.$section.tsx       -> available, active, history, earnings,
                             payouts, performance
admin_.$section.tsx       -> orders, deliveries, seller-approvals,
                             rider-approvals, payments, refunds, payouts,
                             sos, late-deliveries, support
super-admin_.$section.tsx -> admins, permissions, audit, commission,
                             categories, features
```

So "every nav link renders" is technically true and practically false: 26 of the 30 dashboard destinations are empty shells, even though the backend tables and RPCs behind them (payout_requests, refund_requests, ledger_entries, commission_rules, audit_logs, delivery_offers, support_tickets, feature_flags, categories, user_roles) already exist.

Pharmacy onboarding and prescription review are the two screens that are genuinely wired: the admin queue calls `admin_review_application` and the pharmacist screen calls `pharmacy_review_prescription`, and prescriptions/prescription_events changes come back live over Realtime. Two gaps I can see without running anything: the seller_applications table is **not** in the Realtime invalidation set (so the onboarding queue relies on refetch, not live updates), and pharmacy licence documents are stored in the `product-images` bucket rather than a private bucket.

## Plan

### 1. Verify the two workflows end to end (first step, before any code change)
- Query the live database for `seller_applications` (pharmacy) and `prescriptions` / `prescription_events` rows to confirm decisions are actually written and survive a reload, and that the event history is being appended immutably.
- Drive the admin queue and the pharmacist review screen in a real browser session: submit an approve, a reject with note, and a "more info needed", then hard-reload and confirm the status, note, and history persist.
- To do the browser half I need a signed-in preview session — right now the preview is signed out. Sign in as an admin/pharmacy user in the preview and the session is available to me next turn. If you'd rather not, I'll verify the same behaviour through direct database reads and report on that.

### 2. Fix what the verification turns up
Expected small fixes based on the above: add `seller_applications` to the live-update subscription so the onboarding queue updates without a reload, and move licence/regulatory documents to a private bucket with signed-URL reads only.

### 3. Replace the placeholder dashboard sections with real screens
Build them against data that already exists, keeping the current visual style, and delete each catch-all route as its sections become real. Suggested order:

1. Seller: Orders, Products, Inventory (highest daily use)
2. Rider: Available deliveries, Active delivery, History
3. Admin: Seller/Rider approvals, Refunds, Payouts, SOS, Support inbox
4. Seller/Rider: Earnings, Transactions, Payouts
5. Super Admin: Administrators, Permissions, Audit logs, Commission, Categories, Features

Each screen gets real loading / empty / error states, no demo data, and role protection through the existing `RequireRole` wrappers.

## Technical notes

- Placeholder routes to retire: `src/routes/{seller_,rider_,admin_,super-admin_}.$section.tsx`. Each becomes explicit route files (e.g. `seller_.orders.tsx`) so the sidebar link and the screen match one-to-one.
- Reads go through the existing hooks in `src/lib/dashboard.ts`, `src/lib/health.ts`, `src/lib/growth.ts`, `src/lib/support.ts`, and `src/lib/permissions.ts`; writes go through the existing RPCs (`admin_review_payout`, `admin_review_refund`, `seller_adjust_stock`, `set_commission_rule`, `set_feature_flag`, `set_admin_role`, etc.) rather than new client-side logic.
- Realtime: extend `useHealthRealtime`-style subscriptions per dashboard rather than adding page-level channels, so subscriptions stay torn down on unmount.

## Scope question

Step 3 is a lot of screens. I can start with step 1 and 2 only (verify + fix the two health workflows) and report back, or carry straight on into the seller and rider sections in the same pass — tell me which and I'll size the work accordingly.
