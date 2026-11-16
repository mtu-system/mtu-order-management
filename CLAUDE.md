# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Truck order management system for MTU (Mandiri Trans): orders flow from Marketing → Operational (unit allocation) → HSE (inspection) → departure, with GPS tracking via Tracksolid. UI text, code comments, and commit messages are in Indonesian; keep that convention.

## Branch & deploy

**Push to `main` = production deploy.** Always work and commit on the `dev` branch. Don't push or merge to `main` unless the user explicitly asks.

## Commands

```bash
npm run dev      # dev server on http://localhost:3000
npm run build    # production build (also the main type-check)
npm run lint     # eslint (flat config, eslint-config-next)
```

There is no test suite. Verify changes with `npm run build` + `npm run lint`, and by running the app.

`scripts/seed-dummy-users.mjs` creates dummy users per role (needs `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` env; idempotent).

Env vars (`.env`, gitignored): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `TRACKSOLID_*` (app key/secret/account/MD5 password/base URL), `CRON_SECRET`.

## Stack

Next.js 16 App Router, React 19, Supabase (`@supabase/ssr`), Tailwind v4, Leaflet (maps), `xlsx` (Excel export; lazy-loaded), `lucide-react` icons. Path alias `@/*` → repo root. Next 16 uses `proxy.ts` (formerly `middleware.ts`) to refresh the Supabase session cookie on each request.

## Architecture

**Role-based route trees.** Each role has its own top-level folder under `app/`: `manager`, `marketing` (also used by `marketing_admin`), `operational`, `hse`, `vm` (vendor management), plus `pending` for users who have not been approved yet. `lib/auth.ts` defines `UserRole`, `getCurrentUser()` (reads `profiles`, and rejects inactive users), `requireRole([...])` (redirects to login or to the role's home), and `getRoleHome()`. Role-specific components live in `app/<role>/components/`. Components shared across roles (dashboard shell, live map, control tower, monitoring board, unit/safety reports, toasts, confirm dialog) live in `app/components/`. Many pages look the same across roles (for example `*/live-map`, `*/control-tower`, `*/safety-report`): a thin `page.tsx` calls `requireRole` and renders a shared component.

**Data access & security.** These are the three Supabase clients:
- `lib/supabase/server.ts`: server components and route handlers (cookie session, RLS applies).
- `lib/supabase/client.ts`: browser. **Most mutations run directly from client components** through the SDK (anon/publishable key), e.g. `lib/history.ts`, `lib/sync-order-status.ts`.
- `lib/supabase/admin.ts`: service role, **bypasses RLS**, server only. It is currently used only by `app/api/cron/check-alerts`.

Because mutations come from the client, **RLS policies in `supabase/migrations/` are the real authorization layer.** `requireRole()` only gates the UI. Any new table, or any new write path for a role, needs a matching RLS policy or a `SECURITY DEFINER` RPC with explicit role checks. Existing RPCs are `approve_add_unit_request`, `approve_reduce_unit_request`, and `vm_fill_vendor_unit`. Migrations are plain SQL files named `YYYYMMDD_description.sql`, applied manually to Supabase.

**Core domain tables:** `orders` → `order_trucks` (units per order; `source` is `internal` or vendor; `status`: `waiting_hse` → `inspection` → `ready_loading` → `ready_to_depart` → `departed`/`finished`, also `failed`/`cancelled`; separate `trip_status` for GPS trip progress), `order_requirements`, `order_change_requests` (Marketing requests, Operational reviews), `inspections` (HSE), `order_history`/`unit_history`/`activity_logs` (audit trail; `changed_by` must equal `auth.uid()`), `customers`, `vehicle_types`, `no_buntut`, `gps_device_links` (plate → IMEI), `geofences`, `unit_alerts`, `profiles`.

**Order status sync.** After any `order_trucks` status change, call `syncOrderStatus(orderId)` (`lib/sync-order-status.ts`). It derives the order-level status from the current state of the internal units. It intentionally does not drive the manual "Ready to Depart" button flow. Log changes with `logOrderHistory`/`logUnitHistory` (`lib/history.ts`). Action labels are in `lib/activity-labels.ts`.

**GPS / Tracksolid.** `lib/tracksolid.ts` wraps the Tracksolid Pro API (signed requests, plus in-memory caches for token, accounts, and locations). It is server only and is called from `app/api/tracksolid/*` route handlers, which check the session and role themselves. Plates are matched to devices through `normalizePlate` (`lib/plate.ts`) and `lib/gps-match.ts`. `lib/alert-rules.ts` holds alert thresholds and `evaluateAlerts` (driving hours, overspeed, stop outside geofence, night rest). `app/api/cron/check-alerts` (protected by `Authorization: Bearer $CRON_SECRET`) evaluates alerts and writes `unit_alerts`. On the client, `alert-watcher.tsx` polls `/api/alerts` every 30s and plays a sound and shows a toast for the operational role.

**Driver safety rules** (business rules; the constants live in `lib/alert-rules.ts`, so change them there rather than hardcoding):
- Night rest is 22:00–04:00 WIB (`NIGHT_START_HOUR`/`NIGHT_END_HOUR`). Driving in this window raises an alert after a `NIGHT_GRACE_MIN` (30 min) grace period, except for units with `urgent_shipment`.
- The speed limit is 80 km/h (`SPEED_LIMIT_KMH`). The overspeed alert fires once the unit has stayed above it continuously for `OVERSPEED_MIN_SEC`, with a long variant at `OVERSPEED_LONG_SEC`.
- Driving more than 4 hours without a rest raises a red alert (`DRIVE_RED_MIN = 240`), with amber at 3.5 hours (`DRIVE_AMBER_MIN`). Separate daily totals: `DAILY_AMBER_MIN`/`DAILY_RED_MIN`.

**Reports & periods.** Supabase returns at most 1000 rows per request, so reports must use `fetchAll()` (`lib/fetch-all.ts`, which pages up to 60k rows). Report pages take a `?bulan=` param that `lib/period.ts` parses into a month, year, or all-data period. All date bucketing is in WIB (`Asia/Jakarta`, UTC+7). Do this explicitly; don't rely on the server's timezone.

## Planned (not built yet)

- **Driver login:** drivers will get their own role/login and upload loading and unloading photos for each trip (per `order_trucks` unit). This will need a new role in `UserRole`/`getRoleHome`, RLS policies so a driver only sees their own trips, and file storage (e.g. Supabase Storage with its own policies).
