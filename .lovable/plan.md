# Vendor onboarding queue — review findings and fix

## What I checked

- The admin approval RPC (`admin_review_application`) is correct: it enforces the reviewer's permission, requires a reason on rejection, and on approval creates the store (with pharmacy licence fields carried over), grants the seller or rider role, creates the rider profile, notifies the applicant, and writes an audit entry.
- Access rules on both application tables are correct: applicants see only their own application, staff see all, and only staff can review.
- The pharmacy onboarding queue at `/admin/pharmacy-applications` is a real screen, filtered to pharmacy applications, with document viewing via time-limited links.

## What is wrong

1. **The general vendor (seller) approvals queue does not exist as a screen.** The sidebar links "Seller approvals" and "Rider approvals" both land on the generic placeholder shell, so an admin cannot approve a non-pharmacy vendor or a rider at all today. The data hooks for both queues already exist and are unused.
2. **The vendor queue would double-show pharmacies.** The seller applications hook does not exclude pharmacy applications, so the same application would appear in both the vendor queue and the pharmacy queue with different review context.

## Fix

**Vendor approvals screen** (`/admin/seller-approvals`)
- Status filter tabs: Submitted, Under review, Approved, Rejected, All.
- One card per application: store name, store type, city, contact phone, business registration, description, submitted date, current status badge.
- Uploaded documents open through time-limited links, same as the pharmacy queue.
- Reviewer note box plus Approve / Mark under review / Reject actions through the existing RPC; rejection requires a note.
- Existing review note, reviewer decision and decision date shown once decided; decided applications become read-only.
- Pharmacy applications excluded from this queue, with a line pointing admins to the pharmacy queue for those.

**Rider approvals screen** (`/admin/rider-approvals`)
- Same filter tabs and review actions, using rider fields: full name, phone, city, vehicle type and plate, smartphone confirmation, emergency contact, documents.

**Persistence check after both screens exist**
- Approve and reject one application of each kind against the live app, reload, and confirm the status, note and decision timestamp persist, the store/role is created on approval, and the applicant's status page reflects the decision.

## Technical notes

- New routes `src/routes/admin_.seller-approvals.tsx` and `src/routes/admin_.rider-approvals.tsx`, built on `AdminPage`, `FilterTabs`, `Panel`, `QueryBoundary` and `EmptyState`, matching the pharmacy queue layout so the review experience is consistent.
- Reuse `useSellerApplications` / `useRiderApplications` from `src/lib/ops.ts`; add a pharmacy exclusion to the seller hook.
- All writes go through `supabase.rpc("admin_review_application", ...)` with `_kind` of `seller` or `rider`; invalidate the matching query keys plus the admin overview counts on success.
- No schema, policy or RPC changes needed.
